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

// ===== S02: 基础工具 =====
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
export const bashTool = new DynamicStructuredTool({
  name: "bash",
  description: "Run a shell command. Use with caution.",
  schema: z.object({
    command: z.string().describe("The shell command to execute"),
  }),
  func: async ({ command }) => {
    // 当前为模拟实现，实际应调用 child_process.exec
    return `[Simulated] $ ${command}`;
  },
});

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
export const readFileTool = new DynamicStructuredTool({
  name: "read_file",
  description: "Read file contents",
  schema: z.object({
    path: z.string().describe("File path to read"),
    limit: z.number().optional().describe("Optional line limit"),
  }),
  func: async ({ path, limit }) => {
    // 当前为模拟实现，实际应调用 fs.readFile
    return `[Simulated] Reading ${path}${limit ? ` (limit: ${limit})` : ""}`;
  },
});

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
export const writeFileTool = new DynamicStructuredTool({
  name: "write_file",
  description: "Write content to file",
  schema: z.object({
    path: z.string().describe("File path to write"),
    content: z.string().describe("Content to write"),
  }),
  func: async ({ path, content }) => {
    // 当前为模拟实现，实际应调用 fs.writeFile
    return `[Simulated] Wrote ${content.length} bytes to ${path}`;
  },
});

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
export const editFileTool = new DynamicStructuredTool({
  name: "edit_file",
  description: "Replace exact text in file",
  schema: z.object({
    path: z.string().describe("File path to edit"),
    old_text: z.string().describe("Text to find and replace"),
    new_text: z.string().describe("Replacement text"),
  }),
  func: async ({ path }) => {
    // 当前为模拟实现，实际应读取文件并执行替换
    return `[Simulated] Edited ${path}`;
  },
});

// ===== S03: Todo 工具 =====
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
export const todoTool = new DynamicStructuredTool({
  name: "todo",
  description: "Update the todo list. Track progress on multi-step tasks.",
  schema: z.object({
    items: z.array(
      z.object({
        id: z.string().describe("Todo item ID"),
        text: z.string().describe("Todo description"),
        status: z.enum(["pending", "in_progress", "completed"]).describe("Current status"),
      })
    ),
  }),
  func: async ({ items }) => {
    // 格式化输出待办列表
    const lines = items.map((item) => {
      // 使用不同标记表示状态
      const marker = { pending: "[ ]", in_progress: "[>]", completed: "[x]" }[item.status];
      return `${marker} #${item.id}: ${item.text}`;
    });
    // 计算完成进度
    const done = items.filter((i) => i.status === "completed").length;
    lines.push(`\n(${done}/${items.length} completed)`);
    return lines.join("\n");
  },
});

// ===== S04: 子代理工具 =====
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
export const taskTool = new DynamicStructuredTool({
  name: "task",
  description: "Spawn a subagent with fresh context. Use for exploration or subtasks.",
  schema: z.object({
    prompt: z.string().describe("Task description for the subagent"),
    description: z.string().optional().describe("Short description for logging"),
  }),
  func: async ({ prompt, description }) => {
    // 当前为模拟实现，实际应创建子 Agent 实例
    return `[Subagent] Task${description ? ` (${description})` : ""}: Executing...\nPrompt: ${prompt.slice(0, 100)}...\n\nResult: Subtask completed successfully.`;
  },
});

// ===== S05: 技能加载工具 =====
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
export const loadSkillTool = new DynamicStructuredTool({
  name: "load_skill",
  description: "Load specialized knowledge by name. Available skills: code-review, pdf, web-search",
  schema: z.object({
    name: z.string().describe("Skill name to load"),
  }),
  func: async ({ name }) => {
    // 技能定义表
    const skills: Record<string, string> = {
      "code-review": "Code Review: Check for bugs, verify error handling, review tests, suggest improvements",
      pdf: "PDF Processing: Extract text using OCR, parse structure, return clean markdown",
      "web-search": "Web Search: Query search engines, extract results, summarize findings",
    };

    const skill = skills[name];
    if (!skill) {
      return `Error: Unknown skill '${name}'. Available: ${Object.keys(skills).join(", ")}`;
    }

    // 返回技能内容，包装在 skill 标签中
    return `<skill name="${name}">\n${skill}\n</skill>`;
  },
});

// ===== S06: 上下文压缩工具 =====
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
export const compactTool = new DynamicStructuredTool({
  name: "compact",
  description: "Summarize conversation and reset context. Use when approaching token limit.",
  schema: z.object({}),
  func: async () => {
    return "[Context compacted] Previous conversation summarized. Continuing with fresh context.";
  },
});

// ===== S07: 任务系统工具 =====
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
export const taskUpdateTool = new DynamicStructuredTool({
  name: "task_update",
  description: "Create or update a task. Use to track multi-step work with explicit state.",
  schema: z.object({
    id: z.string().optional().describe("Task ID (optional for create)"),
    description: z.string().optional().describe("Task description"),
    status: z.enum(["pending", "in_progress", "completed", "failed"]).optional().describe("Task status"),
  }),
  func: async ({ id, description, status }) => {
    if (description && !id) {
      // 创建新任务
      const newId = `task_${Date.now()}`;
      return `Created task ${newId}: ${description} (${status || "pending"})`;
    }
    if (id && status) {
      // 更新现有任务
      return `Updated task ${id}: status -> ${status}`;
    }
    return "Error: Provide description (for create) or id+status (for update)";
  },
});

// ===== S08: 后台任务工具 =====
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
export const spawnTool = new DynamicStructuredTool({
  name: "spawn",
  description: "Spawn a background task. Returns immediately with a task ID.",
  schema: z.object({
    prompt: z.string().describe("Task to execute in background"),
  }),
  func: async ({ prompt }) => {
    const id = `bg_${Date.now()}`;
    return `Spawned ${id}: ${prompt.slice(0, 50)}...`;
  },
});

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
export const awaitAllTool = new DynamicStructuredTool({
  name: "await_all",
  description: "Wait for all background tasks and return their results.",
  schema: z.object({}),
  func: async () => {
    return "All background tasks completed:\n- bg_123: Result A\n- bg_124: Result B";
  },
});

// ===== S09: 团队协作工具 =====
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
export const spawnTeammateTool = new DynamicStructuredTool({
  name: "spawn_teammate",
  description: "Spawn a new teammate with a role.",
  schema: z.object({
    name: z.string().describe("Teammate name"),
    role: z.string().describe("Teammate role (e.g., coder, reviewer)"),
  }),
  func: async ({ name, role }) => {
    return `Spawned ${name} (${role}). Inbox ready.`;
  },
});

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
export const sendMessageTool = new DynamicStructuredTool({
  name: "send_message",
  description: "Send a message to a teammate or broadcast to all.",
  schema: z.object({
    to: z.string().describe("Recipient name or 'broadcast'"),
    content: z.string().describe("Message content"),
    type: z.enum(["message", "broadcast", "shutdown_request", "shutdown_response", "plan_approval_response"]),
  }),
  func: async ({ to, content, type }) => {
    return `Sent ${type} to ${to}: ${content.slice(0, 50)}...`;
  },
});

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
export const readInboxTool = new DynamicStructuredTool({
  name: "read_inbox",
  description: "Read and clear a teammate's inbox.",
  schema: z.object({
    name: z.string().describe("Teammate name"),
  }),
  func: async ({ name }) => {
    return `[${name}'s inbox]: (no messages)`;
  },
});

// ===== S11: 目标管理工具 =====
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
export const setGoalTool = new DynamicStructuredTool({
  name: "set_goal",
  description: "Set a high-level goal and decompose it into sub-goals.",
  schema: z.object({
    description: z.string().describe("Goal description"),
  }),
  func: async ({ description }) => {
    // 按句号自动分解
    const parts = description.split(".").filter((p) => p.trim());
    return `Decomposed goal into ${parts.length} sub-goals:\n${
      parts.map((p, i) => `  - subgoal_${i}: ${p.trim()}`).join("\n")
    }`;
  },
});

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
export const executeNextTool = new DynamicStructuredTool({
  name: "execute_next",
  description: "Execute the next pending sub-goal.",
  schema: z.object({}),
  func: async () => {
    return "Executed next sub-goal. Remaining: 2";
  },
});

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
export const reflectTool = new DynamicStructuredTool({
  name: "reflect",
  description: "Reflect on progress and consider replanning.",
  schema: z.object({}),
  func: async () => {
    return "Reflection: Progress at 50%. Continue execution.";
  },
});

// ===== S12: 工作树工具 =====
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
export const createWorktreeTool = new DynamicStructuredTool({
  name: "create_worktree",
  description: "Create an isolated git worktree for a task.",
  schema: z.object({
    task_id: z.string().describe("Task ID for the worktree"),
  }),
  func: async ({ task_id }) => {
    const path = `/tmp/worktrees/${task_id}`;
    return `Created worktree for ${task_id} at ${path}`;
  },
});

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
export const executeInWorktreeTool = new DynamicStructuredTool({
  name: "execute_in_worktree",
  description: "Execute a command within an isolated worktree.",
  schema: z.object({
    task_id: z.string().describe("Task ID / worktree ID"),
    command: z.string().describe("Command to execute"),
  }),
  func: async ({ task_id, command }) => {
    return `[Worktree ${task_id}] $ ${command}\nExecuted in isolated environment`;
  },
});

// ===== 所有工具导出 =====
/**
 * 所有工具的集合
 * 用于绑定到 LLM，让模型知道可用工具
 *
 * 数组顺序不影响功能，按课程分组便于维护
 */
export const ALL_TOOLS: StructuredTool[] = [
  // S02: 基础工具
  bashTool,
  readFileTool,
  writeFileTool,
  editFileTool,

  // S03: Todo
  todoTool,

  // S04: 子代理
  taskTool,

  // S05: 技能
  loadSkillTool,

  // S06: 压缩
  compactTool,

  // S07: 任务
  taskUpdateTool,

  // S08: 后台任务
  spawnTool,
  awaitAllTool,

  // S09: 团队
  spawnTeammateTool,
  sendMessageTool,
  readInboxTool,

  // S11: 目标
  setGoalTool,
  executeNextTool,
  reflectTool,

  // S12: 工作树
  createWorktreeTool,
  executeInWorktreeTool,
];
