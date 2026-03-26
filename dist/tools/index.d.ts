/**
 * 工具定义
 * 整合 Learn Claude Code 全部 12 节课的工具实现
 *
 * 工具是 Agent 与外部世界交互的接口，每个工具封装一个特定功能。
 * 本模块定义了 22 个工具，覆盖全部课程需求。
 *
 * 工具分类：
 * - S02: 基础工具 (4个) - bash, read_file, write_file, edit_file
 * - S03: Todo 管理 (1个) - todo
 * - S04: 子代理 (1个) - task
 * - S05: 技能加载 (1个) - load_skill
 * - S06: 上下文压缩 (1个) - compact
 * - S07: 任务系统 (1个) - task_update
 * - S08: 后台任务 (2个) - spawn, await_all
 * - S09: 团队协作 (3个) - spawn_teammate, send_message, read_inbox
 * - S11: 目标管理 (3个) - set_goal, execute_next, reflect
 * - S12: 工作树 (2个) - create_worktree, execute_in_worktree
 *
 * 总计：22 个工具
 *
 * @module tools
 */
import { z } from "zod";
import { DynamicStructuredTool, type StructuredTool } from "@langchain/core/tools";
/**
 * S02: Bash 工具
 * 执行 shell 命令，用于与系统交互
 * 警告：使用需谨慎，避免执行危险命令
 *
 * 使用场景：
 * - 运行 npm 命令
 * - 执行 git 操作
 * - 查看目录结构
 * - 运行测试
 *
 * @example
 * ```typescript
 * { command: "npm install" }
 * ```
 */
export declare const bashTool: DynamicStructuredTool<z.ZodObject<{
    command: z.ZodString;
}, z.core.$strip>, {
    command: string;
}, {
    command: string;
}, string, unknown, "bash">;
/**
 * S02: 读取文件工具
 * 读取指定路径的文件内容
 * 支持可选的行数限制
 *
 * 使用场景：
 * - 读取代码文件
 * - 查看配置文件
 * - 读取日志文件
 *
 * @example
 * ```typescript
 * { path: "src/index.ts", limit: 50 }
 * ```
 */
export declare const readFileTool: DynamicStructuredTool<z.ZodObject<{
    path: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, {
    path: string;
    limit?: number | undefined;
}, {
    path: string;
    limit?: number | undefined;
}, string, unknown, "read_file">;
/**
 * S02: 写入文件工具
 * 将内容写入指定文件
 * 会覆盖已存在的文件
 *
 * 使用场景：
 * - 创建新文件
 * - 覆盖更新文件
 * - 生成代码文件
 *
 * @example
 * ```typescript
 * { path: "src/new.ts", content: "export const x = 1;" }
 * ```
 */
export declare const writeFileTool: DynamicStructuredTool<z.ZodObject<{
    path: z.ZodString;
    content: z.ZodString;
}, z.core.$strip>, {
    path: string;
    content: string;
}, {
    path: string;
    content: string;
}, string, unknown, "write_file">;
/**
 * S02: 编辑文件工具
 * 在文件中替换指定的文本片段
 * 要求 old_text 必须完全匹配
 *
 * 使用场景：
 * - 修改特定函数
 * - 更新配置值
 * - 局部代码重构
 *
 * @example
 * ```typescript
 * { path: "src/index.ts", old_text: "const x = 1;", new_text: "const x = 2;" }
 * ```
 */
export declare const editFileTool: DynamicStructuredTool<z.ZodObject<{
    path: z.ZodString;
    old_text: z.ZodString;
    new_text: z.ZodString;
}, z.core.$strip>, {
    path: string;
    old_text: string;
    new_text: string;
}, {
    path: string;
    old_text: string;
    new_text: string;
}, string, unknown, "edit_file">;
/**
 * S03: Todo 管理工具
 * 更新待办事项列表，跟踪多步骤任务进度
 *
 * 状态说明：
 * - pending: 待办，尚未开始
 * - in_progress: 进行中
 * - completed: 已完成
 *
 * 使用场景：
 * - 复杂任务分解
 * - 进度跟踪
 * - 多文件修改规划
 *
 * @example
 * ```typescript
 * {
 *   items: [
 *     { id: "1", text: "Update graph.ts", status: "completed" },
 *     { id: "2", text: "Update nodes.ts", status: "in_progress" },
 *   ]
 * }
 * ```
 */
export declare const todoTool: DynamicStructuredTool<z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        text: z.ZodString;
        status: z.ZodEnum<{
            pending: "pending";
            in_progress: "in_progress";
            completed: "completed";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>, {
    items: {
        id: string;
        text: string;
        status: "pending" | "in_progress" | "completed";
    }[];
}, {
    items: {
        id: string;
        text: string;
        status: "pending" | "in_progress" | "completed";
    }[];
}, string, unknown, "todo">;
/**
 * S04: 子代理委派工具
 * 创建子代理执行子任务，子代理有独立的上下文
 *
 * 适用场景：
 * 1. 探索性任务（不确定需要做什么）
 * 2. 独立子任务（可并行执行）
 * 3. 隔离风险（避免污染主上下文）
 *
 * 与后台任务区别：
 * - task: 同步等待结果，有上下文隔离
 * - spawn: 异步后台执行，结果稍后取回
 *
 * @example
 * ```typescript
 * {
 *   prompt: "Find all usages of function 'foo' in the codebase",
 *   description: "Find foo usages"
 * }
 * ```
 */
export declare const taskTool: DynamicStructuredTool<z.ZodObject<{
    prompt: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, {
    prompt: string;
    description?: string | undefined;
}, {
    prompt: string;
    description?: string | undefined;
}, string, unknown, "task">;
/**
 * S05: 技能加载工具
 * 动态加载专业技能知识
 *
 * 技能系统采用两层架构：
 * - Layer 1: 技能元数据（轻量，始终加载到系统提示）
 * - Layer 2: 技能完整内容（按需加载，通过此工具）
 *
 * 可用技能：
 * - code-review: 代码审查技能
 * - pdf: PDF 处理技能
 * - web-search: 网页搜索技能
 *
 * @example
 * ```typescript
 * { name: "code-review" }
 * ```
 */
export declare const loadSkillTool: DynamicStructuredTool<z.ZodObject<{
    name: z.ZodString;
}, z.core.$strip>, {
    name: string;
}, {
    name: string;
}, string, unknown, "load_skill">;
/**
 * S06: 上下文压缩工具
 * 手动触发上下文压缩，总结历史对话并重置上下文
 *
 * 使用时机：
 * - 上下文接近 token 限制
 * - 完成一个独立任务阶段
 * - 需要"忘记"早期不相关信息
 *
 * 三级压缩策略：
 * - Layer 1 (micro): 自动，静默执行
 * - Layer 2 (auto): 达到阈值自动触发
 * - Layer 3 (manual): 通过此工具手动触发
 *
 * @example
 * ```typescript
 * {}  // 无需参数
 * ```
 */
export declare const compactTool: DynamicStructuredTool<z.ZodObject<{}, z.core.$strip>, Record<string, never>, Record<string, never>, string, unknown, "compact">;
/**
 * S07: 任务更新工具
 * 创建或更新任务，支持显式状态管理
 *
 * 与 Todo 工具的区别：
 * - Todo: 轻量级，用于跟踪
 * - Task: 正式任务系统，支持子任务、时间记录
 *
 * 操作模式：
 * - 创建: 提供 description，不提供 id
 * - 更新: 提供 id 和 status
 *
 * @example
 * ```typescript
 * // 创建任务
 * { description: "Implement feature X", status: "pending" }
 *
 * // 更新任务
 * { id: "task_123", status: "completed" }
 * ```
 */
export declare const taskUpdateTool: DynamicStructuredTool<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        pending: "pending";
        in_progress: "in_progress";
        completed: "completed";
        failed: "failed";
    }>>;
}, z.core.$strip>, {
    id?: string | undefined;
    description?: string | undefined;
    status?: "pending" | "in_progress" | "completed" | "failed" | undefined;
}, {
    id?: string | undefined;
    description?: string | undefined;
    status?: "pending" | "in_progress" | "completed" | "failed" | undefined;
}, string, unknown, "task_update">;
/**
 * S08: 后台任务创建工具
 * 创建并行执行的后台任务
 *
 * 特点：
 * - 立即返回任务 ID
 * - 任务在后台并行执行
 * - 主流程继续执行
 *
 * 使用场景：
 * - 批量处理多个独立任务
 * - I/O 密集型操作
 * - 不影响主流程的任务
 *
 * @example
 * ```typescript
 * { prompt: "Search for all TODOs in codebase" }
 * ```
 */
export declare const spawnTool: DynamicStructuredTool<z.ZodObject<{
    prompt: z.ZodString;
}, z.core.$strip>, {
    prompt: string;
}, {
    prompt: string;
}, string, unknown, "spawn">;
/**
 * S08: 后台任务等待工具
 * 等待所有后台任务完成并返回结果
 *
 * 使用时机：
 * - 需要后台任务的结果才能继续
 * - 阶段结束时收集所有结果
 * - 需要确认所有任务成功
 *
 * @example
 * ```typescript
 * {}  // 无需参数
 * ```
 */
export declare const awaitAllTool: DynamicStructuredTool<z.ZodObject<{}, z.core.$strip>, Record<string, never>, Record<string, never>, string, unknown, "await_all">;
/**
 * S09: 创建团队成员工具
 * 创建新的团队成员（子 Agent）
 *
 * 角色建议：
 * - coder: 负责代码实现
 * - reviewer: 负责代码审查
 * - tester: 负责测试
 * - researcher: 负责调研
 *
 * @example
 * ```typescript
 * { name: "Alice", role: "reviewer" }
 * ```
 */
export declare const spawnTeammateTool: DynamicStructuredTool<z.ZodObject<{
    name: z.ZodString;
    role: z.ZodString;
}, z.core.$strip>, {
    name: string;
    role: string;
}, {
    name: string;
    role: string;
}, string, unknown, "spawn_teammate">;
/**
 * S09 + S10: 发送消息工具
 * 向团队成员发送消息或广播
 *
 * 消息类型：
 * - message: 普通消息
 * - broadcast: 广播给所有人
 * - shutdown_request: 关闭请求（触发 S10 协议）
 * - shutdown_response: 关闭响应
 * - plan_approval_response: 计划审批响应
 *
 * @example
 * ```typescript
 * {
 *   to: "Alice",
 *   content: "Please review the code",
 *   type: "message"
 * }
 * ```
 */
export declare const sendMessageTool: DynamicStructuredTool<z.ZodObject<{
    to: z.ZodString;
    content: z.ZodString;
    type: z.ZodEnum<{
        message: "message";
        broadcast: "broadcast";
        shutdown_request: "shutdown_request";
        shutdown_response: "shutdown_response";
        plan_approval_response: "plan_approval_response";
    }>;
}, z.core.$strip>, {
    to: string;
    content: string;
    type: "message" | "broadcast" | "shutdown_request" | "shutdown_response" | "plan_approval_response";
}, {
    to: string;
    content: string;
    type: "message" | "broadcast" | "shutdown_request" | "shutdown_response" | "plan_approval_response";
}, string, unknown, "send_message">;
/**
 * S09: 读取收件箱工具
 * 读取并清空指定成员的收件箱
 *
 * 使用场景：
 * - Agent 轮询自己的消息
 * - Lead 查看团队成员回复
 * - 处理待办消息
 *
 * @example
 * ```typescript
 * { name: "Alice" }
 * ```
 */
export declare const readInboxTool: DynamicStructuredTool<z.ZodObject<{
    name: z.ZodString;
}, z.core.$strip>, {
    name: string;
}, {
    name: string;
}, string, unknown, "read_inbox">;
/**
 * S11: 设定目标工具
 * 设定高层次目标并自动分解为子目标
 *
 * 自动分解规则：
 * - 按句号分割目标描述
 * - 每个片段成为一个子目标
 * - 子目标继承父目标状态
 *
 * 使用场景：
 * - 复杂任务的自主规划
 * - 长期目标的分解
 * - 里程碑设定
 *
 * @example
 * ```typescript
 * { description: "Implement user authentication. Add login form. Create auth API." }
 * ```
 */
export declare const setGoalTool: DynamicStructuredTool<z.ZodObject<{
    description: z.ZodString;
}, z.core.$strip>, {
    description: string;
}, {
    description: string;
}, string, unknown, "set_goal">;
/**
 * S11: 执行下一个目标工具
 * 执行队列中的下一个子目标
 *
 * 使用场景：
 * - 完成当前子目标后推进
 * - 按顺序执行子目标
 * - 自动推进任务
 *
 * @example
 * ```typescript
 * {}  // 无需参数
 * ```
 */
export declare const executeNextTool: DynamicStructuredTool<z.ZodObject<{}, z.core.$strip>, Record<string, never>, Record<string, never>, string, unknown, "execute_next">;
/**
 * S11: 反思工具
 * 反思当前进度并考虑重新规划
 *
 * 使用时机：
 * - 遇到阻碍时重新评估
 * - 定期进度检查
 * - 子目标完成后评估
 *
 * @example
 * ```typescript
 * {}  // 无需参数
 * ```
 */
export declare const reflectTool: DynamicStructuredTool<z.ZodObject<{}, z.core.$strip>, Record<string, never>, Record<string, never>, string, unknown, "reflect">;
/**
 * S12: 创建工作树工具
 * 创建隔离的 git worktree 环境
 *
 * 隔离优势：
 * - 避免任务间文件冲突
 * - 支持并行开发
 * - 失败可安全回滚
 *
 * @example
 * ```typescript
 * { task_id: "feature-123" }
 * ```
 */
export declare const createWorktreeTool: DynamicStructuredTool<z.ZodObject<{
    task_id: z.ZodString;
}, z.core.$strip>, {
    task_id: string;
}, {
    task_id: string;
}, string, unknown, "create_worktree">;
/**
 * S12: 在工作树中执行工具
 * 在指定 worktree 中执行命令
 *
 * 使用场景：
 * - 隔离环境执行危险操作
 * - 并行任务执行
 * - 测试环境隔离
 *
 * @example
 * ```typescript
 * { task_id: "feature-123", command: "npm test" }
 * ```
 */
export declare const executeInWorktreeTool: DynamicStructuredTool<z.ZodObject<{
    task_id: z.ZodString;
    command: z.ZodString;
}, z.core.$strip>, {
    task_id: string;
    command: string;
}, {
    task_id: string;
    command: string;
}, string, unknown, "execute_in_worktree">;
/**
 * 所有工具的集合
 * 用于绑定到 LLM，让模型知道可用工具
 *
 * 数组顺序不影响功能，按课程分组便于维护
 */
export declare const ALL_TOOLS: StructuredTool[];
//# sourceMappingURL=index.d.ts.map