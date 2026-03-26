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
import type { AgentStateType } from "./graph.js";
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
export declare function llmNode(state: AgentStateType): Promise<Partial<AgentStateType>>;
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
export declare function toolExecutionNode(state: AgentStateType): Promise<Partial<AgentStateType>>;
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
export declare function contextManagementNode(state: AgentStateType): Promise<Partial<AgentStateType>>;
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
export declare function taskTrackingNode(state: AgentStateType): Promise<Partial<AgentStateType>>;
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
export declare function shouldContinue(state: AgentStateType): string;
//# sourceMappingURL=nodes.d.ts.map