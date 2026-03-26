/**
 * LangGraph 状态图 - 完整实现
 * 整合 Learn Claude Code 全部 12 节课程内容
 *
 * 本模块是 Agent 系统的核心，使用 LangGraph 框架构建状态机，
 * 实现一个具备完整功能的 AI Agent。
 *
 * @module agents/graph
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import type {
  TodoItem,      // S03: 待办事项类型
  Transcript,    // S06: 上下文摘要记录
  Task,          // S07: 任务系统
  BackgroundJob, // S08: 后台任务
  Teammate,      // S09: 团队成员
  TeamProtocol,  // S10: 团队协议
  Goal,          // S11: 目标管理
  Worktree,      // S12: 工作树隔离
  ToolCall,      // S02: 工具调用
  ToolResponse,  // S02: 工具响应
} from "../types/index.js";
import { llmNode, toolExecutionNode, shouldContinue } from "./nodes.js";

/**
 * Agent 状态类型定义
 * 这是整个系统的核心状态结构，整合了全部 12 节课的核心概念
 *
 * 设计原则：
 * - 每个字段对应一个课程的核心概念
 * - 状态是可序列化的，支持持久化
 * - 支持并发更新和增量更新
 */
export interface AgentStateType {
  /**
   * S01: 基础消息列表
   * 存储与 LLM 的完整对话历史，包括用户输入、系统提示、AI 回复、工具结果
   * 这是 Agent 的"记忆"核心
   */
  messages: BaseMessage[];

  /**
   * S03: 待办事项列表
   * 用于跟踪多步骤任务的进度
   * 状态: pending(待办) | in_progress(进行中) | completed(已完成)
   */
  todos: TodoItem[];

  /**
   * S03: 上次更新待办的时间戳
   * 用于实现"催促"(nag)功能，提醒 Agent 更新任务状态
   */
  lastTodoUpdate: number;

  /**
   * S05: 已加载的技能列表
   * 记录当前已加载的技能名称，避免重复加载
   * 技能系统采用两层加载：元数据(轻量) + 完整内容(按需)
   */
  loadedSkills: string[];

  /**
   * S05: 可用技能列表
   * 系统中所有可用的技能，用于构建系统提示
   */
  availableSkills: string[];

  /**
   * S06: 上下文摘要记录列表
   * 当上下文过长时，历史消息会被压缩成摘要存储在这里
   * 支持三级压缩：micro(微观) -> auto(自动) -> manual(手动)
   */
  transcripts: Transcript[];

  /**
   * S06: 压缩计数器
   * 记录已执行了多少次上下文压缩
   * 用于监控和调试
   */
  compactCount: number;

  /**
   * S07: 任务列表
   * 比 todos 更正式的任务管理系统
   * 支持子任务、状态跟踪、时间记录
   */
  tasks: Task[];

  /**
   * S07: 当前正在执行的任务 ID
   * 用于跟踪当前上下文中的主任务
   */
  currentTaskId?: string;

  /**
   * S08: 后台任务列表
   * 存储通过 spawn 工具创建的后台任务
   * 支持并行执行多个子任务
   */
  backgroundJobs: BackgroundJob[];

  /**
   * S09: 团队成员映射表
   * key: 成员名称, value: 成员配置
   * 用于多 Agent 协作场景
   */
  teammates: Map<string, Teammate>;

  /**
   * S10: 活跃协议列表
   * 当前正在执行的团队协议（如关闭协议、计划审批协议）
   */
  activeProtocols: TeamProtocol[];

  /**
   * S11: 目标列表
   * 高层次目标及其分解的子目标
   * 支持自主规划和目标导向的执行
   */
  goals: Goal[];

  /**
   * S11: 当前目标 ID
   * 正在执行的主要目标
   */
  currentGoalId?: string;

  /**
   * S12: 工作树列表
   * 用于任务隔离的 git worktree
   * 每个复杂任务在独立 worktree 中执行，避免冲突
   */
  worktrees: Worktree[];

  /**
   * S02: 工具调用记录
   * 记录 AI 发起的所有工具调用
   */
  toolCalls: ToolCall[];

  /**
   * S02: 工具响应记录
   * 记录工具执行的结果
   */
  toolResponses: ToolResponse[];

  /**
   * 控制流：下一个要执行的节点
   * 用于条件路由
   */
  nextNode?: string;

  /**
   * 控制流：停止标志
   * 当设为 true 时，Agent 循环结束
   */
  stop: boolean;
}

/**
 * 状态归约器 (State Reducers)
 *
 * LangGraph 使用归约器模式处理状态更新。
 * 每个字段定义一个归约函数，决定新值如何与旧值合并。
 *
 * 归约器类型：
 * 1. 追加型 (messages): 新值追加到旧值
 * 2. 替换型 (todos): 新值完全替换旧值
 * 3. 默认型 (stop): 如果没有新值，保持旧值
 */
const stateReducers = {
  /**
   * 消息归约器：追加模式
   * 新消息总是追加到历史消息列表
   */
  messages: (x: BaseMessage[] = [], y: BaseMessage[] = []) => [...x, ...y],

  /**
   * 待办归约器：替换模式
   * 新待办列表完全替换旧的
   */
  todos: (x: TodoItem[] = [], y: TodoItem[] = []) => y ?? x,
  lastTodoUpdate: (x = 0, y = 0) => y ?? x,

  /**
   * 技能归约器：替换模式
   */
  loadedSkills: (x: string[] = [], y: string[] = []) => y ?? x,
  availableSkills: (x: string[] = [], y: string[] = []) => y ?? x,

  /**
   * 上下文归约器：替换模式
   */
  transcripts: (x: Transcript[] = [], y: Transcript[] = []) => y ?? x,
  compactCount: (x = 0, y = 0) => y ?? x,

  /**
   * 任务归约器：替换模式
   */
  tasks: (x: Task[] = [], y: Task[] = []) => y ?? x,
  currentTaskId: (x?: string, y?: string) => y ?? x,

  /**
   * 后台任务归约器：替换模式
   */
  backgroundJobs: (x: BackgroundJob[] = [], y: BackgroundJob[] = []) => y ?? x,

  /**
   * 团队成员归约器：替换模式，带默认值
   */
  teammates: (x?: Map<string, Teammate>, y?: Map<string, Teammate>) => y ?? x ?? new Map(),

  /**
   * 协议归约器：替换模式
   */
  activeProtocols: (x: TeamProtocol[] = [], y: TeamProtocol[] = []) => y ?? x,

  /**
   * 目标归约器：替换模式
   */
  goals: (x: Goal[] = [], y: Goal[] = []) => y ?? x,
  currentGoalId: (x?: string, y?: string) => y ?? x,

  /**
   * 工作树归约器：替换模式
   */
  worktrees: (x: Worktree[] = [], y: Worktree[] = []) => y ?? x,

  /**
   * 工具调用归约器：替换模式
   */
  toolCalls: (x: ToolCall[] = [], y: ToolCall[] = []) => y ?? x,
  toolResponses: (x: ToolResponse[] = [], y: ToolResponse[] = []) => y ?? x,

  /**
   * 下一节点归约器：可选替换
   */
  nextNode: (x?: string, y?: string) => y ?? x,

  /**
   * 停止标志归约器：布尔替换
   */
  stop: (x = false, y?: boolean) => y ?? x,
};

/**
 * 创建 Agent 状态图
 *
 * 这是系统的核心函数，构建 LangGraph 工作流：
 *
 * 流程图（真正的 Agent 循环）：
 * ```
 * START
 *   │
 *   ▼
 * llm_call ──► 检查是否有工具调用
 *   │                │
 *   │         ┌─────┴─────┐
 *   │         ▼           ▼
 *   │    有工具调用    无工具调用
 *   │         │           │
 *   │         ▼           ▼
 *   │   tool_execution   END
 *   │         │
 *   └─────────┘
 *      (循环回来)
 * ```
 *
 * 循环逻辑：
 * 1. llm_call 调用 LLM
 * 2. 检查 LLM 响应是否包含 tool_calls
 * 3. 如果有，执行 tool_execution，然后回到 llm_call
 * 4. 如果没有，结束循环
 *
 * 这种设计实现了真正的 Agent 能力：
 * - LLM 可以决定调用工具
 * - 工具结果反馈给 LLM
 * - LLM 可以再次决定（可能调用其他工具）
 * - 直到 LLM 认为任务完成（不再调用工具）
 *
 * 节点说明：
 * - llm_call: 调用 LLM，获取响应和工具调用请求
 * - tool_execution: 执行工具调用，更新状态
 * - shouldContinue: 条件函数，决定是否继续循环
 *
 * @returns 编译后的状态图，可调用 .stream() 或 .invoke() 执行
 */
export function createAgentGraph(): any {
  // 创建状态图实例，传入归约器配置
  // 使用 any 类型绕过 LangGraph 严格的类型检查（当前版本的权宜之计）
  const workflow = new StateGraph<any>({
    channels: stateReducers as any,
  });

  // 添加节点到图中
  // 每个节点是一个异步函数，接收当前状态，返回状态更新
  workflow.addNode("llm_call", llmNode as any);
  workflow.addNode("tool_execution", toolExecutionNode as any);

  // 定义边（状态流转）
  // START 是 LangGraph 预定义的起点常量
  workflow.addEdge(START, "llm_call" as any);

  // 条件边：从 llm_call 出来后，根据 shouldContinue 决定流向
  // - 如果有工具调用：去 tool_execution
  // - 如果没有工具调用：去 END（结束）
  workflow.addConditionalEdges(
    "llm_call" as any,
    shouldContinue as any,
    {
      tool_execution: "tool_execution" as any,  // 继续执行工具
      __end__: END,                              // 结束循环
    }
  );

  // 循环边：工具执行完成后，回到 llm_call
  // 这样 LLM 可以看到工具结果，并决定下一步
  workflow.addEdge("tool_execution" as any, "llm_call" as any);

  // 编译图，生成可执行的 Agent
  return workflow.compile();
}

// 为了方便使用，从 types 模块重新导出 createInitialState
export { createInitialState } from "../types/index.js";
