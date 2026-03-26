/**
 * 图节点实现
 * 整合 Learn Claude Code 全部 12 节课作为 LangGraph 节点
 *
 * 每个节点对应一到多个课程的核心概念：
 * - S01: Agent 基础循环
 * - S02: 工具调用
 * - S03: Todo 管理
 * - S04: 子代理委派
 * - S05: 技能加载
 * - S06: 上下文压缩
 * - S07: 任务系统
 * - S08: 后台任务
 * - S09: 团队协作
 * - S10: 团队协议
 * - S11: 目标管理
 * - S12: 工作树隔离
 *
 * @module agents/nodes
 */

import { BaseMessage, AIMessage, HumanMessage, type ToolMessage } from "@langchain/core/messages";
import type { AgentStateType } from "./graph.js";
import type { TodoItem, BackgroundJob, TeamProtocol, Goal } from "../types/index.js";
import { createLLMWithTools, estimateMessageTokens } from "../llm/client.js";
import { ALL_TOOLS } from "../tools/index.js";
import { SkillManager } from "../skills/SkillManager.js";
import { observability } from "../observability/index.js";

// ===== 常量定义 =====

/**
 * S06: 上下文压缩阈值（字符数）
 * 当消息总字符数超过此值时触发自动压缩
 * 实际应用中应按 token 计算，这里简化为字符数
 */
const COMPACT_THRESHOLD = 50000;

/**
 * S06: 保留的最近工具结果数量
 * Micro-compact 时保留最近 N 个完整结果，旧的替换为占位符
 */
const KEEP_RECENT_TODOS = 3;

/**
 * S03: 催促提醒间隔（轮数）
 * 如果 N 轮对话内没有更新 todo，Agent 会收到提醒
 */
const NAG_AFTER_ROUNDS = 3;

function serializeMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}

// ===== 核心节点 =====

/**
 * S01 + S05: LLM 调用节点
 *
 * 这是 Agent 的"大脑"，负责：
 * 1. 构建系统提示（包含可用技能信息）
 * 2. 调用 LLM 获取响应
 * 3. 处理工具调用请求
 *
 * 系统提示结构：
 * - 基础身份说明
 * - 可用技能列表（S05: 动态加载）
 * - 使用指南（何时使用各种工具）
 *
 * @param state - 当前 Agent 状态
 * @returns 状态更新对象，包含新的消息
 */
export async function llmNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const llmRunId = await observability.startRun({
    name: "llm_call",
    runType: "llm",
    parentRunId: state.runId,
    inputs: {
      messageCount: state.messages.length,
      loadedSkills: state.loadedSkills,
    },
    metadata: {
      node: "llm_call",
      model: process.env.ANTHROPIC_MODEL || "kimi-k2.5",
      estimatedTokens: estimateMessageTokens(state.messages),
    },
  });

  // 创建绑定工具的 LLM 客户端
  // 这样 LLM 知道有哪些工具可用，可以请求调用
  const model = createLLMWithTools(ALL_TOOLS);

  // S05: 构建系统提示，包含可用技能信息
  // SkillManager 负责扫描 skills/ 目录并生成描述
  const skillManager = new SkillManager();
  const skillDescriptions = await skillManager.getSkillDescriptions();

  // 构建系统提示模板
  // 这个提示告诉 LLM 它的能力和使用方式
  const systemPrompt = `You are a coding agent with access to tools. Use them to solve tasks efficiently.

Available skills (use load_skill to access):
${skillDescriptions}

Guidelines:
- Use todo tool to track multi-step tasks
- Use task tool to delegate subtasks
- Use compact when context gets long
- Update task status explicitly`;

  // 构建完整消息列表
  // 系统提示作为第一条消息，然后是历史对话
  const messages: BaseMessage[] = [
    new HumanMessage({ content: systemPrompt }),
    ...state.messages,
  ];

  // 调用 LLM，等待响应
  // 响应可能包含文本内容和工具调用请求
  try {
    const response = await model.invoke(messages);
    const toolCalls = response.tool_calls || [];

    await observability.endRun(llmRunId, {
      outputs: {
        content: serializeMessageContent(response.content),
        toolCallCount: toolCalls.length,
        toolNames: toolCalls.map((call) => call.name),
      },
      metadata: {
        node: "llm_call",
      },
    });

    // 返回状态更新：将 LLM 响应追加到消息列表
    return {
      messages: [...state.messages, response],
      toolCalls: toolCalls.map((call) => ({
        id: call.id || "unknown",
        name: call.name,
        args: call.args as Record<string, unknown>,
      })),
      metrics: {
        ...state.metrics,
        llmCalls: state.metrics.llmCalls + 1,
      },
    };
  } catch (error) {
    await observability.endRun(llmRunId, {
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        node: "llm_call",
      },
    });
    throw error;
  }
}

/**
 * S02 + S04: 工具执行节点
 *
 * 这是 Agent 的"手脚"，负责执行 LLM 请求的工具调用。
 *
 * 在 Agent 循环中的作用：
 * 1. 接收来自 llm_call 的工具调用请求
 * 2. 执行所有请求的工具
 * 3. 将工具结果格式化为消息
 * 4. 返回更新后的状态（包含工具结果消息）
 * 5. 状态通过循环边回到 llm_call，LLM 可以看到结果并决定下一步
 *
 * 循环流程：
 * llm_call ──(有 tool_calls)──► tool_execution ──(返回结果)──► llm_call
 *                                    │
 *                             执行工具，更新状态
 *                                    │
 *                             结果作为消息追加
 *                                    │
 *                             回到 llm_call 做下一步决策
 *
 * 处理流程：
 * 1. 检查最后一条消息是否包含工具调用
 * 2. 遍历所有工具调用请求
 * 3. 根据工具名称执行对应逻辑
 * 4. 将工具结果作为新消息返回
 *
 * 工具分类：
 * - S02: 基础工具 (bash, read_file, write_file, edit_file)
 * - S03: Todo 管理
 * - S04: 子代理委派
 * - S05: 技能加载
 * - S06: 上下文压缩
 * - S07: 任务系统
 * - S08: 后台任务
 * - S09: 团队工具
 * - S11: 目标管理
 * - S12: 工作树
 *
 * @param state - 当前 Agent 状态
 * @returns 状态更新对象，包含工具执行结果和可能的状态变更
 */
export async function toolExecutionNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  // 获取最后一条消息
  const lastMessage = state.messages[state.messages.length - 1];

  // 检查是否是 AI 消息且包含工具调用
  // 如果没有工具调用，直接返回空更新
  if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls?.length) {
    return {}; // 没有工具调用需要处理
  }

  const toolExecRunId = await observability.startRun({
    name: "tool_execution",
    runType: "chain",
    parentRunId: state.runId,
    inputs: {
      toolCallCount: lastMessage.tool_calls.length,
    },
    metadata: {
      node: "tool_execution",
    },
  });

  // 提取工具调用列表
  const toolCalls = lastMessage.tool_calls;

  // 初始化响应数组和状态副本
  // 使用副本避免直接修改原状态（不可变性原则）
  const toolResponses: { toolCallId: string; toolName: string; output: string; success: boolean; durationMs?: number; error?: string }[] = [];
  const loadedSkills: string[] = [...state.loadedSkills];      // S05: 已加载技能
  const backgroundJobs: BackgroundJob[] = [...state.backgroundJobs]; // S08: 后台任务
  const activeProtocols: TeamProtocol[] = [...state.activeProtocols]; // S10: 活跃协议
  const goals: Goal[] = [...state.goals];                      // S11: 目标列表
  let toolFailureCount = 0;

  // 遍历每个工具调用
  for (const call of toolCalls) {
    let output = "";
    let toolError: string | undefined;
    let success = true;
    const startedAt = Date.now();
    const toolRunId = await observability.startRun({
      name: `tool:${call.name}`,
      runType: "tool",
      parentRunId: toolExecRunId,
      inputs: {
        toolName: call.name,
        args: call.args as Record<string, unknown>,
      },
      metadata: {
        node: "tool_execution",
        toolName: call.name,
      },
    });

    try {
      // 根据工具名称执行对应逻辑
      switch (call.name) {
        // ===== S02: 基础工具（模拟实现）=====
        case "bash":
          // bash 工具：执行 shell 命令
          // 实际实现中应该调用真实的 shell 执行器
          output = `[Simulated] $ ${(call.args as { command: string }).command}`;
          break;

        case "read_file":
          // read_file 工具：读取文件内容
          output = `[Simulated] Reading ${(call.args as { path: string }).path}`;
          break;

        case "write_file": {
          // write_file 工具：写入文件
          const args = call.args as { path: string; content: string };
          output = `[Simulated] Wrote ${args.content.length} bytes to ${args.path}`;
          break;
        }

        case "edit_file":
          // edit_file 工具：编辑文件（替换文本）
          output = `[Simulated] Edited ${(call.args as { path: string }).path}`;
          break;

        // ===== S03: Todo 工具 =====
        case "todo": {
          // todo 工具：更新待办列表
          // 支持三种状态：pending(待办), in_progress(进行中), completed(已完成)
          const args = call.args as { items: TodoItem[] };
          const lines = args.items.map((item) => {
            // 根据状态选择标记符号
            const marker = { pending: "[ ]", in_progress: "[>]", completed: "[x]" }[item.status];
            return `${marker} #${item.id}: ${item.text}`;
          });
          // 计算完成进度
          const done = args.items.filter((i) => i.status === "completed").length;
          lines.push(`\n(${done}/${args.items.length} completed)`);
          output = lines.join("\n");
          break;
        }

        // ===== S04: 子代理委派 =====
        case "task": {
          // task 工具：创建子代理执行子任务
          // 子代理有独立的上下文，适合探索性任务
          const args = call.args as { prompt: string; description?: string };
          output = `[Subagent] Task${args.description ? ` (${args.description})` : ""}: ${args.prompt.slice(0, 80)}...\n\nResult: Subtask completed.`;
          break;
        }

        // ===== S05: 技能加载 =====
        case "load_skill": {
          // load_skill 工具：动态加载专业技能
          // 技能系统采用两层加载：1) 元数据在系统提示中 2) 完整内容按需加载
          const skillName = (call.args as { name: string }).name;
          const skillManager = new SkillManager();
          output = await skillManager.loadSkill(skillName);
          // 如果加载成功，记录到已加载技能列表
          if (!output.startsWith("Error")) {
            loadedSkills.push(skillName);
          }
          break;
        }

        // ===== S06: 上下文压缩 =====
        case "compact":
          // compact 工具：手动触发上下文压缩
          // 当上下文接近 token 限制时使用
          output = "[Context compacted] Previous conversation summarized.";
          break;

        // ===== S07: 任务系统 =====
        case "task_update": {
          // task_update 工具：创建或更新任务
          // 比 todo 更正式，支持更多状态
          const args = call.args as { id?: string; description?: string; status?: string };
          if (args.description && !args.id) {
            // 创建新任务
            const newId = `task_${Date.now()}`;
            output = `Created task ${newId}: ${args.description} (${args.status || "pending"})`;
          } else if (args.id && args.status) {
            // 更新现有任务
            output = `Updated task ${args.id}: status -> ${args.status}`;
          } else {
            // 参数错误
            output = "Error: Provide description (for create) or id+status (for update)";
          }
          break;
        }

        // ===== S08: 后台任务 =====
        case "spawn": {
          // spawn 工具：创建后台任务
          // 后台任务并行执行，不阻塞主流程
          const prompt = (call.args as { prompt: string }).prompt;
          const id = `bg_${Date.now()}`;
          backgroundJobs.push({
            id,
            prompt,
            status: "running",
            createdAt: Date.now(),
          });
          output = `Spawned ${id}: ${prompt.slice(0, 50)}...`;
          break;
        }

        case "await_all": {
          // await_all 工具：等待所有后台任务完成
          const completed = backgroundJobs.filter((j) => j.status === "completed").length;
          output = `All background tasks completed (${completed}/${backgroundJobs.length})`;
          break;
        }

        // ===== S09: 团队协作 =====
        case "spawn_teammate": {
          // spawn_teammate 工具：创建新团队成员
          const args = call.args as { name: string; role: string };
          output = `Spawned ${args.name} (${args.role}). Inbox ready.`;
          break;
        }

        case "send_message": {
          // send_message 工具：发送消息给团队成员
          const args = call.args as { to: string; content: string; type: string };
          output = `Sent ${args.type} to ${args.to}: ${args.content.slice(0, 50)}...`;

          // S10: 处理关闭协议
          // 如果收到关闭请求，创建协议记录
          if (args.type === "shutdown_request") {
            activeProtocols.push({
              id: `protocol_${Date.now()}`,
              type: "shutdown",
              status: "pending",
              initiator: "lead",
              votes: new Map(),
              createdAt: Date.now(),
            });
          }
          break;
        }

        case "read_inbox": {
          // read_inbox 工具：读取团队成员的收件箱
          const name = (call.args as { name: string }).name;
          output = `[${name}'s inbox]: (no messages)`;
          break;
        }

        // ===== S11: 目标管理 =====
        case "set_goal": {
          // set_goal 工具：设定高层次目标并自动分解
          const description = (call.args as { description: string }).description;
          // 按句号分解目标为子目标
          const parts = description.split(".").filter((p) => p.trim());
          const newGoal: Goal = {
            id: `goal_${Date.now()}}`,
            description,
            status: "in_progress",
            subGoals: parts.map((part, i) => ({
              id: `subgoal_${i}`,
              description: part.trim(),
              status: "pending",
              parentId: `goal_${Date.now()}`,
            })),
            reflections: [],
            createdAt: Date.now(),
          };
          goals.push(newGoal);
          output = `Decomposed goal into ${parts.length} sub-goals:\n${
            parts.map((p, i) => `  - subgoal_${i}: ${p.trim()}`).join("\n")
          }`;
          break;
        }

        case "execute_next":
          // execute_next 工具：执行下一个子目标
          output = "Executed next sub-goal.";
          break;

        case "reflect":
          // reflect 工具：反思当前进度
          output = "Reflection: Progress on track.";
          break;

        // ===== S12: 工作树隔离 =====
        case "create_worktree": {
          // create_worktree 工具：创建隔离的 git worktree
          const taskId = (call.args as { task_id: string }).task_id;
          output = `Created worktree for ${taskId} at /tmp/worktrees/${taskId}`;
          break;
        }

        case "execute_in_worktree": {
          // execute_in_worktree 工具：在 worktree 中执行命令
          const args = call.args as { task_id: string; command: string };
          output = `[Worktree ${args.task_id}] $ ${args.command}\nExecuted in isolated environment`;
          break;
        }

        default:
          // 未知工具
          output = `Unknown tool: ${call.name}`;
      }
    } catch (error) {
      // 工具执行出错，记录错误信息
      toolError = error instanceof Error ? error.message : String(error);
      output = `Error: ${toolError}`;
      success = false;
      toolFailureCount++;
    }

    const durationMs = Date.now() - startedAt;

    const toolRunOutput: {
      outputs: { output: string; success: boolean };
      error?: string;
      metadata: { durationMs: number; toolName: string };
    } = {
      outputs: {
        output,
        success,
      },
      metadata: {
        durationMs,
        toolName: call.name,
      },
    };
    if (toolError) {
      toolRunOutput.error = toolError;
    }
    await observability.endRun(toolRunId, toolRunOutput);

    // 记录工具响应
    const toolResponse: { toolCallId: string; toolName: string; output: string; success: boolean; durationMs?: number; error?: string } = {
      toolCallId: call.id || "unknown",
      toolName: call.name,
      success,
      durationMs,
      output,
    };
    if (toolError) {
      toolResponse.error = toolError;
    }
    toolResponses.push(toolResponse);
  }

  // 将工具响应转换为消息对象
  const responseMessages = toolResponses.map(
    (r: { toolCallId: string; output: string }) => new HumanMessage({ content: `[${r.toolCallId}]: ${r.output}` })
  );

  // 返回完整的状态更新
  await observability.endRun(toolExecRunId, {
    outputs: {
      toolResponses,
    },
    metadata: {
      node: "tool_execution",
    },
  });

  return {
    messages: [...state.messages, ...responseMessages],
    toolResponses,
    loadedSkills,
    backgroundJobs,
    activeProtocols,
    goals,
    metrics: {
      ...state.metrics,
      toolCalls: state.metrics.toolCalls + toolCalls.length,
      toolFailures: state.metrics.toolFailures + toolFailureCount,
      rounds: state.metrics.rounds + 1,
    },
  };
}

/**
 * S06: 上下文管理节点 - 三层压缩策略
 *
 * 三层压缩架构：
 * - Layer 1 (Micro): 每轮静默执行，将旧工具结果替换为占位符
 * - Layer 2 (Auto): 达到 token 阈值时自动触发，生成摘要
 * - Layer 3 (Manual): 用户/Agent 主动调用 compact 工具
 *
 * 当前实现：Layer 1 + Layer 2
 *
 * @param state - 当前 Agent 状态
 * @returns 状态更新对象，可能包含压缩后的消息
 */
export async function contextManagementNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  // Layer 1: Micro-compact（静默，每轮执行）
  let messages = microCompactMessages(state.messages);

  // Layer 2: Auto-compact（token 阈值触发）
  const tokenCount = estimateMessageTokens(messages);
  if (tokenCount > COMPACT_THRESHOLD) {
    // 生成摘要（实际应调用 LLM，这里简化处理）
    const summary = await summarizeMessages(messages);
    const transcriptId = `transcript_${Date.now()}`;

    // 替换为摘要消息
    messages = [
      new HumanMessage({
        content: `[Context Summary - ${transcriptId}]: ${summary}`,
      }),
    ];

    return {
      messages,
      compactCount: state.compactCount + 1,
    };
  }

  return { messages };
}

/**
 * S03 + S07: 任务跟踪节点
 *
 * 负责：
 * 1. 监控 todo 更新频率，必要时发出催促提醒
 * 2. 自动推进任务状态
 * 3. 维护任务依赖关系
 *
 * @param state - 当前 Agent 状态
 * @returns 状态更新对象
 */
export async function taskTrackingNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  let messages = [...state.messages];

  // 检查是否需要发出催促提醒
  // 如果 3 轮对话内没有更新 todo，提醒 Agent
  const hasTodoToolInLast3Rounds = checkRecentTodoUpdates(state);
  if (state.todos.length > 0 && !hasTodoToolInLast3Rounds) {
    messages.push(
      new HumanMessage({
        content: "<reminder>Update your todos.</reminder>",
      })
    );
  }

  return { messages };
}

/**
 * 条件边：决定 Agent 循环是否继续
 *
 * 这是 Agent 循环的"交通警察"，决定执行流向：
 * - 返回 "tool_execution"：LLM 想要调用工具 → 继续循环
 * - 返回 "__end__"：任务完成或需要停止 → 结束循环
 *
 * 循环逻辑：
 * 1. Agent 启动 → llm_call 调用 LLM
 * 2. LLM 响应 → shouldContinue 检查
 * 3. 如果有 tool_calls → 去 tool_execution → 执行工具 → 回到 llm_call
 * 4. 如果没有 tool_calls → 去 END → 循环结束
 *
 * 这种设计让 Agent 可以：
 * - 多次调用工具（多轮交互）
 * - 根据工具结果调整策略
 * - 自主决定何时停止
 *
 * 判断逻辑：
 * 1. 如果 stop 标志为 true，结束循环
 * 2. 如果最后一条消息没有工具调用，结束循环（LLM 认为任务完成）
 * 3. 如果有待处理的关闭协议且已获批准，结束循环（团队决定停止）
 * 4. 否则继续到工具执行节点
 *
 * @param state - 当前 Agent 状态
 * @returns "tool_execution" 继续循环，或 "__end__" 结束循环
 */
export function shouldContinue(state: AgentStateType): string {
  // 检查停止标志
  if (state.stop) {
    return "__end__";
  }

  const lastMessage = state.messages[state.messages.length - 1];

  // 如果没有工具调用，结束循环
  if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls?.length) {
    return "__end__";
  }

  // 检查关闭协议是否已获批准
  for (const protocol of state.activeProtocols) {
    if (protocol.type === "shutdown" && protocol.status === "approved") {
      return "__end__";
    }
  }

  // 继续执行工具
  return "tool_execution";
}

// ===== 辅助函数 =====

/**
 * Layer 1: Micro-compact - 微观压缩
 *
 * 将旧的工具结果替换为占位符，只保留最近的 N 个完整结果。
 * 这是静默执行的，不需要 LLM 参与。
 *
 * @param messages - 消息列表
 * @returns 压缩后的消息列表
 */
function microCompactMessages(messages: BaseMessage[]): BaseMessage[] {
  // 找出工具结果消息
  const toolResults = messages.filter((m) => m.additional_kwargs?.tool_call_id);

  // 如果工具结果数量不多，不需要压缩
  if (toolResults.length <= KEEP_RECENT_TODOS) {
    return messages;
  }

  // 只保留最近的结果
  const toCompact = toolResults.slice(0, -KEEP_RECENT_TODOS);

  // 替换旧结果为占位符
  return messages.map((m) => {
    if (toCompact.includes(m)) {
      return new HumanMessage({
        content: "[Previous tool result - see transcript]",
        additional_kwargs: { compacted: true },
      });
    }
    return m;
  });
}

/**
 * Layer 2: Summarize messages - 生成消息摘要
 *
 * 实际实现中应该调用 LLM 生成智能摘要。
 * 这里简化处理，返回统计信息。
 *
 * @param messages - 消息列表
 * @returns 摘要字符串
 */
async function summarizeMessages(messages: BaseMessage[]): Promise<string> {
  // 统计信息
  const toolCalls = messages.filter((m) => m instanceof AIMessage && m.tool_calls?.length).length;
  return `Conversation with ${messages.length} messages, ${toolCalls} tool calls. Key tasks completed.`;
}

/**
 * 检查最近是否更新过 todo
 *
 * 简单检查：查看最近 N 轮消息中是否包含 todo 相关内容
 *
 * @param state - 当前 Agent 状态
 * @returns 如果最近有更新返回 true，否则返回 false
 */
function checkRecentTodoUpdates(state: AgentStateType): boolean {
  // 取最近的消息
  const recentMessages = state.messages.slice(-NAG_AFTER_ROUNDS * 2);
  return recentMessages.some((m) => {
    const content = m.content.toString();
    // 检查是否包含 todo 相关标记
    return content.includes("todo") || content.includes("[ ]") || content.includes("[x]");
  });
}
