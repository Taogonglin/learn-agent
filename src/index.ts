#!/usr/bin/env node

/**
 * Claude Code LangGraph Agent
 * CLI Entry Point
 *
 * Integrates all 12 lessons from Learn Claude Code:
 * - S01: Agent Loop
 * - S02: Tool Use
 * - S03: Todo Write
 * - S04: Subagent
 * - S05: Skill Loading
 * - S06: Context Compact
 * - S07: Task System
 * - S08: Background Tasks
 * - S09: Agent Teams
 * - S10: Team Protocols
 * - S11: Autonomous Agents
 * - S12: Worktree Isolation
 */

import { createAgentGraph } from "./agents/graph.js";
import { createInitialState } from "./types/index.js";
import { HumanMessage } from "@langchain/core/messages";
import * as readline from "readline";
import dotenv from "dotenv";
import * as fs from "fs";

/**
 * 将单个 content block 归一化为可打印文本。
 *
 * 不同模型/SDK 返回的消息内容结构并不完全一致：
 * - 纯字符串
 * - `{ text: "..." }`
 * - `{ content: "..." }`
 *
 * 这里先处理最常见的文本字段，无法识别时返回空字符串，
 * 由上层决定是否继续尝试其他兜底逻辑。
 */
function renderContentBlock(block: unknown): string {
  if (typeof block === "string") {
    return block;
  }

  if (!block || typeof block !== "object") {
    return "";
  }

  const candidate = block as Record<string, unknown>;

  if (typeof candidate.text === "string") {
    return candidate.text;
  }

  if (typeof candidate.content === "string") {
    return candidate.content;
  }

  return "";
}

/**
 * 将 LangChain message.content 渲染成 CLI 最终输出文本。
 *
 * 设计目标：
 * 1. 正确处理字符串、内容数组、对象三种主要形态
 * 2. 避免把对象直接转成 "[object Object]"
 * 3. 对未知结构尽量保留可观察信息，便于排查模型返回格式
 */
function renderMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    // Anthropic/兼容接口常返回 block 数组，这里将多个文本块拼接展示。
    return content
      .map((item) => renderContentBlock(item))
      .filter((item) => item.trim())
      .join("\n")
      .trim();
  }

  if (content && typeof content === "object") {
    // 单对象内容先按常见 text/content 字段提取。
    const rendered = renderContentBlock(content);
    if (rendered) {
      return rendered;
    }

    try {
      // 未识别结构时使用 JSON 兜底，避免 CLI 出现 [object Object]。
      return JSON.stringify(content, null, 2);
    } catch {
      return "";
    }
  }

  return "";
}

/**
 * 工具节点当前把结果格式化为 `[tool_call_id]: result`。
 * 这里单独抽出来，方便主循环识别并决定是否直接打印。
 */
function isToolResultMessage(content: string): boolean {
  return content.startsWith("[") && content.includes("]:");
}

/**
 * 判断一条增量消息是否应该展示到 CLI。
 *
 * 过滤原则：
 * - 空内容不显示
 * - 工具结果始终显示
 * - 普通消息只显示 AI 消息，避免把用户输入再次回显到终端
 *
 * 这里兼容两类对象：
 * - LangChain 的运行时消息实例
 * - LangGraph stream 中序列化后的消息对象
 */
function shouldDisplayMessage(msg: unknown, content: string): boolean {
  if (!content.trim()) {
    return false;
  }

  if (isToolResultMessage(content)) {
    return true;
  }

  if (!msg || typeof msg !== "object") {
    return false;
  }

  const candidate = msg as Record<string, unknown>;
  const constructors = Array.isArray(candidate.id) ? candidate.id : [];

  // 运行时消息实例上通常能直接拿到 getType()。
  if (typeof candidate.getType === "function") {
    try {
      return candidate.getType() === "ai";
    } catch {
      return false;
    }
  }

  // 序列化消息可能在 type 字段里保留 AIMessage 语义。
  if (typeof candidate.type === "string" && candidate.type.toLowerCase().includes("ai")) {
    return true;
  }

  // 最后再根据 LangChain 构造器路径做一次弱匹配。
  return constructors.some((part) => String(part).includes("AIMessage"));
}

// 手动读取 .env 文件并强制设置环境变量
try {
  const envContent = fs.readFileSync(".env", "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && match[1] && match[2]) {
      const key = match[1];
      const value = match[2];
      if (value && !value.startsWith("#")) {
        process.env[key] = value.trim();
      }
    }
  });
} catch (e) {
  // .env 文件不存在时忽略
}

// readline 负责 CLI 交互式输入；即使通过管道输入，也会复用同一套问答接口。
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(`
╔═══════════════════════════════════════════════════════════╗
║       Claude Code LangGraph Agent                        ║
║       Integrated 12-Lesson Curriculum                     ║
╚═══════════════════════════════════════════════════════════╝

Model: ${process.env.ANTHROPIC_MODEL || "kimi-k2.5"}
Base URL: ${process.env.ANTHROPIC_BASE_URL || "not set"}

Features:
  ✓ S01: Agent Loop with LangGraph
  ✓ S02: Tool Use (bash, read, write, edit)
  ✓ S03: Todo Management
  ✓ S04: Subagent Delegation
  ✓ S05: Skill Loading
  ✓ S06: Context Compression
  ✓ S07: Task System
  ✓ S08: Background Tasks
  ✓ S09: Agent Teams
  ✓ S10: Team Protocols
  ✓ S11: Autonomous Goals
  ✓ S12: Worktree Isolation

Type your task or 'quit' to exit.
`);

/**
 * CLI 主循环。
 *
 * 生命周期：
 * 1. 创建 LangGraph agent
 * 2. 等待用户输入
 * 3. 将输入注入初始状态并启动 graph.stream()
 * 4. 按增量流式消费状态更新
 * 5. 提取新增消息并渲染到终端
 * 6. 一轮完成后继续等待下一条用户输入
 */
async function main() {
  const graph = createAgentGraph();

  // 非交互场景下（例如 printf ... | npm run start），stdin 结束后需要停止下一轮 question，
  // 否则 readline 会在已关闭状态上继续读取并抛 ERR_USE_AFTER_CLOSE。
  let inputClosed = false;

  process.stdin.on("end", () => {
    inputClosed = true;
  });

  rl.on("close", () => {
    inputClosed = true;
  });

  while (true) {
    if (inputClosed) {
      break;
    }

    // rl.question 是 callback 风格，这里包装成 Promise 以便使用 async/await。
    const input = await new Promise<string>((resolve, reject) => {
      try {
        rl.question("\n🤖 Agent> ", resolve);
      } catch (error) {
        reject(error);
      }
    }).catch((error) => {
      // 管道输入结束后，下一次调用 question 可能触发这个错误；
      // 将其转成一个受控的 quit 流程，而不是让进程以异常退出。
      if ((error as NodeJS.ErrnoException)?.code === "ERR_USE_AFTER_CLOSE") {
        inputClosed = true;
        return "quit";
      }

      throw error;
    });

    if (input.trim().toLowerCase() === "quit") {
      if (!inputClosed) {
        console.log("\nGoodbye! 👋\n");
        rl.close();
      }
      break;
    }

    if (!input.trim()) {
      continue;
    }

    console.log("\n" + "─".repeat(60));
    console.log("Processing...\n");

    // 每轮用户请求都从一个全新的初始状态出发，再注入本次用户消息。
    const initialState = createInitialState();
    initialState.messages.push(new HumanMessage({ content: input }));

    try {
      // 使用流式接口消费 LangGraph 状态变化，便于观察每一轮工具调用和 LLM 响应。
      const stream = await graph.stream(initialState as any, {
        configurable: {
          // thread_id 用于区分不同轮次的执行上下文。
          thread_id: `run_${Date.now()}`,
        },
      });

      // lastContent: 避免重复打印同一段内容
      // messageCount: 只处理本次 update 新增的消息
      // roundCount: 粗略统计 agent loop 轮数
      let lastContent = "";
      let messageCount = 0;
      let roundCount = 0;

      for await (const update of stream) {
        /**
         * LangGraph stream 返回的是“按节点分组”的增量对象，而不是固定单一结构。
         * 当前图里最常见的更新来源有：
         * - update.llm_call
         * - update.tool_execution
         * - update.__start__
         *
         * 这里统一抽取出包含 messages/stop 的那一层状态。
         */
        let state: any = update;
        if ((update as any).llm_call) {
          state = (update as any).llm_call;
        } else if ((update as any).tool_execution) {
          state = (update as any).tool_execution;
        } else if ((update as Record<string, unknown>).__start__) {
          state = (update as Record<string, unknown>).__start__;
        }

        if (state && typeof state === 'object') {
          const agentState = state as { messages?: unknown[]; stop?: boolean };

          if (agentState.messages && agentState.messages.length > messageCount) {
            // 只处理本次 update 相比上一次新增的消息。
            const newMessages = agentState.messages.slice(messageCount);
            messageCount = agentState.messages.length;

            // 检测 agent loop 是否进入了新一轮：
            // - 有工具结果，说明上一轮工具执行刚结束
            // - 有新的 tool_calls，说明 LLM 正在继续推进任务
            const hasToolResult = newMessages.some((msg: any) => {
              const content = msg?.kwargs?.content || msg?.content || '';
              return String(content).startsWith('[') && String(content).includes(']:');
            });

            const hasAssistantResponse = newMessages.some((msg: any) => {
              return msg?.kwargs?.tool_calls || msg?.tool_calls;
            });

            if (hasToolResult || hasAssistantResponse) {
              roundCount++;
              if (roundCount > 1) {
                console.log(`\n🔄 Agent Loop - Round ${roundCount}`);
                console.log("─".repeat(40));
              }
            }

            for (const msg of newMessages) {
              // 兼容 LangChain 消息实例和序列化消息对象两种格式。
              let content = "";
              if (typeof msg === 'object' && msg !== null) {
                const m = msg as any;

                // LangChain 常见序列化格式：
                // { lc: 1, type: "constructor", id: [...], kwargs: { content: ... } }
                if (m.kwargs && "content" in m.kwargs) {
                  content = renderMessageContent(m.kwargs.content);
                } else if ('content' in m) {
                  content = renderMessageContent(m.content);
                }
              }

              // 仅打印需要展示的消息，并跳过与上一条完全相同的重复内容。
              if (content !== lastContent && shouldDisplayMessage(msg, content)) {
                console.log(content);
                lastContent = content;
              }
            }
          }

          // 某些节点会主动设置 stop 标志，CLI 需要立即停止继续消费后续更新。
          if (agentState.stop) {
            console.log("\n[Agent stopped]");
            break;
          }
        }
      }

      console.log(`\n✅ Task completed after ${roundCount} round(s)`);
      console.log("─".repeat(60));
    } catch (error) {
      console.error("\n❌ Error:", error instanceof Error ? error.message : String(error));
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
