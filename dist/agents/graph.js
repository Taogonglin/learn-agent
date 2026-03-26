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
import { llmNode, toolExecutionNode, shouldContinue } from "./nodes.js";
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
    messages: (x = [], y = []) => [...x, ...y],
    /**
     * 待办归约器：替换模式
     * 新待办列表完全替换旧的
     */
    todos: (x = [], y = []) => y ?? x,
    lastTodoUpdate: (x = 0, y = 0) => y ?? x,
    /**
     * 技能归约器：替换模式
     */
    loadedSkills: (x = [], y = []) => y ?? x,
    availableSkills: (x = [], y = []) => y ?? x,
    /**
     * 上下文归约器：替换模式
     */
    transcripts: (x = [], y = []) => y ?? x,
    compactCount: (x = 0, y = 0) => y ?? x,
    /**
     * 任务归约器：替换模式
     */
    tasks: (x = [], y = []) => y ?? x,
    currentTaskId: (x, y) => y ?? x,
    /**
     * 后台任务归约器：替换模式
     */
    backgroundJobs: (x = [], y = []) => y ?? x,
    /**
     * 团队成员归约器：替换模式，带默认值
     */
    teammates: (x, y) => y ?? x ?? new Map(),
    /**
     * 协议归约器：替换模式
     */
    activeProtocols: (x = [], y = []) => y ?? x,
    /**
     * 目标归约器：替换模式
     */
    goals: (x = [], y = []) => y ?? x,
    currentGoalId: (x, y) => y ?? x,
    /**
     * 工作树归约器：替换模式
     */
    worktrees: (x = [], y = []) => y ?? x,
    /**
     * 工具调用归约器：替换模式
     */
    toolCalls: (x = [], y = []) => y ?? x,
    toolResponses: (x = [], y = []) => y ?? x,
    /**
     * 下一节点归约器：可选替换
     */
    nextNode: (x, y) => y ?? x,
    /**
     * 停止标志归约器：布尔替换
     */
    stop: (x = false, y) => y ?? x,
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
export function createAgentGraph() {
    // 创建状态图实例，传入归约器配置
    // 使用 any 类型绕过 LangGraph 严格的类型检查（当前版本的权宜之计）
    const workflow = new StateGraph({
        channels: stateReducers,
    });
    // 添加节点到图中
    // 每个节点是一个异步函数，接收当前状态，返回状态更新
    workflow.addNode("llm_call", llmNode);
    workflow.addNode("tool_execution", toolExecutionNode);
    // 定义边（状态流转）
    // START 是 LangGraph 预定义的起点常量
    workflow.addEdge(START, "llm_call");
    // 条件边：从 llm_call 出来后，根据 shouldContinue 决定流向
    // - 如果有工具调用：去 tool_execution
    // - 如果没有工具调用：去 END（结束）
    workflow.addConditionalEdges("llm_call", shouldContinue, {
        tool_execution: "tool_execution", // 继续执行工具
        __end__: END, // 结束循环
    });
    // 循环边：工具执行完成后，回到 llm_call
    // 这样 LLM 可以看到工具结果，并决定下一步
    workflow.addEdge("tool_execution", "llm_call");
    // 编译图，生成可执行的 Agent
    return workflow.compile();
}
// 为了方便使用，从 types 模块重新导出 createInitialState
export { createInitialState } from "../types/index.js";
//# sourceMappingURL=graph.js.map