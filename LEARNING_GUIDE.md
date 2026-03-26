# Claude Code LangGraph Agent - 项目解读与学习路线

> 基于 Learn Claude Code 12 节课程的完整 Agent 实现

## 📋 项目概述

本项目是一个**完整的 AI Agent 系统**，使用 LangGraph 框架构建，整合了 [Learn Claude Code](https://github.com/anthropics/learn-claude-code) 全部 12 节课程的核心概念。

### 核心特性

- ✅ **12 节课全覆盖** - 从基础工具到团队协议
- ✅ **LangGraph 状态机** - 完整的 Agent 循环实现
- ✅ **22 个工具** - 覆盖编码、规划、协作全场景
- ✅ **类型安全** - TypeScript 完整类型支持
- ✅ **中文注释** - 详细的代码注释和文档

---

## 🏗️ 架构解读

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI 入口 (index.ts)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   LangGraph 状态图                            │
│                                                              │
│   START ──► llm_call ──► tool_execution ──► END              │
│                │                                        │
│                │ (conditional)                          │
│                └──────► (back to start if more tools)   │
└─────────────────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │  Tools  │  │  Skills │  │  Tasks  │
   │ (22个)  │  │ (动态)  │  │ (跟踪)  │
   └─────────┘  └─────────┘  └─────────┘
```

### 状态管理 (State Management)

Agent 状态采用 **Redux 风格**的归约器模式：

```typescript
interface AgentState {
  // S01: 对话历史
  messages: BaseMessage[];

  // S03: 待办跟踪
  todos: TodoItem[];

  // S05: 已加载技能
  loadedSkills: string[];

  // S06: 上下文摘要
  transcripts: Transcript[];

  // S07: 任务系统
  tasks: Task[];

  // S08: 后台作业
  backgroundJobs: BackgroundJob[];

  // S09/S10: 团队协作
  teammates: Map<string, Teammate>;
  activeProtocols: TeamProtocol[];

  // S11: 目标管理
  goals: Goal[];

  // S12: 工作树隔离
  worktrees: Worktree[];

  // 控制流
  stop: boolean;
}
```

**归约器原理**：
```typescript
// 追加型：消息列表追加
messages: (old, new) => [...old, ...new]

// 替换型：完全替换
status: (old, new) => new ?? old

// 默认型：保持默认值
count: (old = 0, new) => new ?? old
```

---

## 📁 文件结构详解

```
claude-code-langgraph/
├── src/
│   ├── agents/
│   │   ├── graph.ts          # 🎯 核心：LangGraph 状态图定义
│   │   └── nodes.ts          # 🎯 核心：节点实现（S01-S12）
│   │
│   ├── tools/
│   │   └── index.ts          # 🛠️ 22 个工具定义（S02-S12）
│   │
│   ├── types/
│   │   └── index.ts          # 📐 TypeScript 类型定义
│   │
│   ├── skills/
│   │   └── SkillManager.ts   # 🎓 S05：技能管理系统
│   │
│   ├── llm/
│   │   └── client.ts         # 🤖 LLM 客户端配置（kimi-k2.5）
│   │
│   ├── index.ts              # 🚀 CLI 入口
│   └── test.ts               # 🧪 测试脚本
│
├── skills/                   # 🎓 可加载技能文件
│   ├── code-review/
│   ├── pdf/
│   └── web-search/
│
├── dist/                     # 📦 编译输出
├── .env                      # 🔑 环境变量
├── package.json              # 📦 项目配置
└── LEARNING_GUIDE.md         # 📚 本文档
```

### 关键文件说明

#### 1. `src/agents/graph.ts` - 状态图核心

**作用**：定义 Agent 的工作流程和状态转换

**核心概念**：
- `StateGraph`: LangGraph 的状态机容器
- `Channels`: 状态归约器配置
- `Nodes`: 图中的处理节点
- `Edges`: 节点间的流转关系

**学习重点**：
```typescript
// 状态图构建流程
const workflow = new StateGraph<AgentState>({
  channels: stateReducers,  // 定义如何更新状态
});

workflow.addNode("llm_call", llmNode);           // 添加节点
workflow.addNode("tool_execution", toolNode);

workflow.addEdge(START, "llm_call");             // 定义流转
workflow.addEdge("llm_call", "tool_execution");

const agent = workflow.compile();                // 编译执行
```

#### 2. `src/agents/nodes.ts` - 节点实现

**作用**：实现 Agent 的具体行为逻辑

**节点说明**：

| 节点 | 对应课程 | 功能 |
|------|----------|------|
| `llmNode` | S01 + S05 | 调用 LLM，加载技能 |
| `toolExecutionNode` | S02-S12 | 执行 22 个工具 |
| `contextManagementNode` | S06 | 上下文压缩 |
| `taskTrackingNode` | S03 + S07 | 任务跟踪 |
| `shouldContinue` | - | 条件判断边 |

**学习重点**：
- 如何解析 LLM 的工具调用请求
- 工具的 switch-case 处理模式
- 状态更新和返回格式

#### 3. `src/tools/index.ts` - 工具定义

**作用**：定义所有可用工具及其 schema

**工具分类**：

| 课程 | 工具 | 用途 |
|------|------|------|
| S02 | bash, read_file, write_file, edit_file | 基础文件操作 |
| S03 | todo | 待办管理 |
| S04 | task | 子代理委派 |
| S05 | load_skill | 技能加载 |
| S06 | compact | 上下文压缩 |
| S07 | task_update | 任务系统 |
| S08 | spawn, await_all | 后台任务 |
| S09 | spawn_teammate, send_message, read_inbox | 团队协作 |
| S11 | set_goal, execute_next, reflect | 目标管理 |
| S12 | create_worktree, execute_in_worktree | 工作树隔离 |

**学习重点**：
```typescript
// DynamicStructuredTool 定义模式
export const toolName = new DynamicStructuredTool({
  name: "tool_name",              // 工具标识
  description: "工具描述",        // LLM 可见的功能说明
  schema: z.object({...}),        // 参数 schema（Zod）
  func: async (args) => {         // 执行逻辑
    return "结果";
  },
});
```

---

## 🎓 12 节课对应实现

### S01: Agent 基础循环

**核心概念**：LLM → 工具调用 → 结果 → LLM 的循环

**代码位置**：`src/agents/graph.ts`

**实现要点**：
```typescript
// 基础循环图
workflow.addEdge(START, "llm_call");
workflow.addEdge("llm_call", "tool_execution");
workflow.addEdge("tool_execution", END);
```

### S02: 工具使用

**核心概念**：Agent 通过工具与外部世界交互

**代码位置**：`src/tools/index.ts` (第 1-60 行)

**实现要点**：
- `bashTool`: 执行 shell 命令
- `readFileTool`: 读取文件
- `writeFileTool`: 写入文件
- `editFileTool`: 编辑文件

### S03: Todo 管理

**核心概念**：跟踪多步骤任务进度

**代码位置**：
- 工具：`src/tools/index.ts` (第 63-84 行)
- 节点：`src/agents/nodes.ts` (第 297-311 行)

**使用示例**：
```typescript
// Agent 调用 todo 工具
{
  items: [
    { id: "1", text: "Update graph.ts", status: "completed" },
    { id: "2", text: "Update nodes.ts", status: "in_progress" },
  ]
}
```

### S04: 子代理委派

**核心概念**：使用独立上下文处理子任务

**代码位置**：`src/tools/index.ts` (第 87-98 行)

**适用场景**：
- 探索性任务
- 独立子任务
- 需要隔离的操作

### S05: 技能系统

**核心概念**：两层加载策略（元数据 + 完整内容）

**代码位置**：`src/skills/SkillManager.ts`

**架构说明**：
```
┌─────────────────────────────────────┐
│        Layer 1: 元数据加载           │
│   - 轻量级，始终加载到系统提示        │
│   - 仅包含技能名称和简介             │
└──────────────────┬──────────────────┘
                   │ load_skill
                   ▼
┌─────────────────────────────────────┐
│        Layer 2: 完整内容             │
│   - 按需加载完整 SKILL.md           │
│   - 插入到对话上下文                │
└─────────────────────────────────────┘
```

### S06: 上下文压缩

**核心概念**：三层压缩策略管理 Token 限制

**代码位置**：`src/agents/nodes.ts` (第 269-292 行, 第 343-373 行)

**三层架构**：
| 层级 | 名称 | 触发条件 | 操作 |
|------|------|----------|------|
| Layer 1 | Micro | 每轮自动 | 旧工具结果 → 占位符 |
| Layer 2 | Auto | Token 阈值 | 生成摘要，重置上下文 |
| Layer 3 | Manual | 工具调用 | 主动触发压缩 |

### S07: 任务系统

**核心概念**：正式的任务状态管理

**代码位置**：
- 工具：`src/tools/index.ts` (第 134-153 行)
- 节点：`src/agents/nodes.ts` (第 297-311 行)

**与 Todo 的区别**：
- Todo：轻量级跟踪
- Task：正式任务系统，支持子任务、时间记录

### S08: 后台任务

**核心概念**：并行执行多个子任务

**代码位置**：`src/tools/index.ts` (第 156-175 行)

**API**：
- `spawn`: 创建后台任务（立即返回）
- `await_all`: 等待所有任务完成

### S09: 团队协作

**核心概念**：多 Agent 协作的消息机制

**代码位置**：`src/tools/index.ts` (第 178-212 行)

**工具**：
- `spawn_teammate`: 创建团队成员
- `send_message`: 发送消息
- `read_inbox`: 读取收件箱

### S10: 团队协议

**核心概念**：团队决策的共识机制

**代码位置**：`src/agents/nodes.ts` (第 174-184 行)

**协议类型**：
- Shutdown Protocol: 优雅关闭投票
- Plan Approval Protocol: 计划审批投票

### S11: 目标管理

**核心概念**：高层次目标的自主规划

**代码位置**：`src/tools/index.ts` (第 215-245 行)

**流程**：
```
set_goal → 自动分解为 sub-goals
    ↓
execute_next → 顺序执行子目标
    ↓
reflect → 定期反思调整
```

### S12: 工作树隔离

**核心概念**：Git worktree 实现任务隔离

**代码位置**：`src/tools/index.ts` (第 248-270 行)

**优势**：
- 避免任务间文件冲突
- 失败可安全回滚
- 支持并行开发

---

## 🛤️ 学习路线建议

### 阶段 1：基础理解（1-2 天）

**目标**：理解项目整体结构和核心概念

**学习内容**：
1. 阅读本文档，理解架构图
2. 浏览 `src/types/index.ts`，了解状态结构
3. 阅读 `src/agents/graph.ts`，理解状态图构建
4. 运行测试：`npm run build && node dist/test.js`

**输出**：
- 能画出 Agent 执行流程图
- 能解释每个状态字段的作用

### 阶段 2：工具掌握（2-3 天）

**目标**：掌握工具定义和使用

**学习内容**：
1. 精读 `src/tools/index.ts`
2. 理解 `DynamicStructuredTool` 的工作原理
3. 实践：添加一个新工具

**练习任务**：
```typescript
// 添加一个计算字符串 MD5 的工具
export const md5Tool = new DynamicStructuredTool({
  name: "md5",
  description: "Calculate MD5 hash of a string",
  schema: z.object({
    input: z.string().describe("String to hash"),
  }),
  func: async ({ input }) => {
    // 实现 MD5 计算
    return crypto.createHash('md5').update(input).digest('hex');
  },
});
```

### 阶段 3：节点开发（3-4 天）

**目标**：理解节点实现，能开发自定义节点

**学习内容**：
1. 精读 `src/agents/nodes.ts`
2. 理解 `llmNode` 的系统提示构建
3. 理解 `toolExecutionNode` 的工具分发逻辑

**练习任务**：
```typescript
// 添加一个日志记录节点
export async function loggingNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log(`[LOG] Messages: ${state.messages.length}, Tools: ${state.toolCalls.length}`);
  return {}; // 只记录，不修改状态
}

// 在 graph.ts 中添加节点
workflow.addNode("logging", loggingNode as any);
workflow.addEdge("tool_execution" as any, "logging" as any);
workflow.addEdge("logging" as any, END);
```

### 阶段 4：高级特性（4-5 天）

**目标**：掌握条件边、技能系统、团队协议

**学习内容**：
1. 实现 `shouldContinue` 条件逻辑
2. 创建自定义技能（`skills/my-skill/SKILL.md`）
3. 理解团队协议的工作流程

**练习任务**：
```markdown
<!-- skills/my-skill/SKILL.md -->
---
name: my-skill
description: My custom skill for data processing
---

# Data Processing Skill

This skill helps you process CSV files...

## Guidelines
1. Always validate CSV format first
2. Handle encoding issues
3. Report statistics
```

### 阶段 5：项目实战（5-7 天）

**目标**：使用 Agent 完成实际任务

**实战项目建议**：

#### 项目 A：代码审查助手

**功能**：
- 读取代码文件
- 分析代码质量
- 生成审查报告

**涉及课程**：S02, S03, S05, S06

#### 项目 B：多文件重构工具

**功能**：
- 分析项目结构
- 规划重构步骤
- 使用工作树隔离执行

**涉及课程**：S02, S04, S07, S12

#### 项目 C：自动化测试生成

**功能**：
- 读取源代码
- 生成测试用例
- 并行执行测试

**涉及课程**：S02, S04, S08, S11

---

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <your-repo-url>
cd claude-code-langgraph

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API 密钥
```

### 2. 编译运行

```bash
# 编译 TypeScript
npm run build

# 运行测试
node dist/test.js

# 启动 CLI
npm start
```

### 3. 使用 Agent

```bash
$ npm start

╔═══════════════════════════════════════════════════════════╗
║       Claude Code LangGraph Agent                        ║
╚═══════════════════════════════════════════════════════════╝

🤖 Agent> Create a todo list for implementing user authentication

[Agent 会创建待办列表并开始执行]
```

---

## 🔧 扩展开发

### 添加新工具

1. 在 `src/tools/index.ts` 定义工具：
```typescript
export const myTool = new DynamicStructuredTool({
  name: "my_tool",
  description: "Description for LLM",
  schema: z.object({...}),
  func: async (args) => "result",
});
```

2. 添加到 `ALL_TOOLS` 数组

3. 在 `nodes.ts` 添加处理逻辑：
```typescript
case "my_tool":
  output = await handleMyTool(call.args);
  break;
```

### 添加新节点

1. 在 `nodes.ts` 实现节点函数：
```typescript
export async function myNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  // 节点逻辑
  return { /* 状态更新 */ };
}
```

2. 在 `graph.ts` 注册节点：
```typescript
workflow.addNode("my_node", myNode as any);
workflow.addEdge("previous_node" as any, "my_node" as any);
```

### 添加新技能

1. 创建目录 `skills/my-skill/`

2. 创建 `SKILL.md`：
```markdown
---
name: my-skill
description: Skill description
---

# Skill Content

Detailed instructions...
```

3. 在 `SkillManager.ts` 注册技能

---

## 📚 参考资源

### 官方文档
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)
- [LangChain JS](https://js.langchain.com/)
- [Learn Claude Code](https://github.com/anthropics/learn-claude-code)

### 核心概念
- **StateGraph**: LangGraph 的状态机实现
- **Reducers**: 状态更新函数
- **Tool Binding**: LLM 工具调用机制
- **Worktree**: Git 的隔离工作目录

### 调试技巧

```typescript
// 开启详细日志
const graph = createAgentGraph();
const stream = await graph.stream(state, {
  configurable: { thread_id: "debug_1" },
});

for await (const update of stream) {
  console.log("Update:", JSON.stringify(update, null, 2));
}
```

---

## 🤝 贡献指南

欢迎提交 PR 改进项目：

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/xxx`
3. 提交变更：`git commit -m "Add xxx"`
4. 推送分支：`git push origin feature/xxx`
5. 创建 Pull Request

---

## 📝 学习笔记模板

建议按以下模板记录学习笔记：

```markdown
## Day X: 学习主题

### 今日目标
- [ ] 目标 1
- [ ] 目标 2

### 学习内容
1. 概念 A
   - 要点 1
   - 要点 2

### 代码实践
```typescript
// 今日写的代码
```

### 遇到的问题
1. 问题描述 → 解决方案

### 明日计划
- 继续学习...
```

---

## 🎯 能力自检清单

完成学习后，你应该能够：

- [ ] 解释 LangGraph 的核心概念（StateGraph、Channels、Nodes、Edges）
- [ ] 独立创建新的工具并集成到 Agent
- [ ] 设计并实现自定义节点
- [ ] 使用 Todo 和 Task 系统管理复杂任务
- [ ] 实现上下文压缩策略
- [ ] 配置和使用技能系统
- [ ] 理解团队协议的工作原理
- [ ] 使用工作树隔离任务执行
- [ ] 调试和优化 Agent 性能

---

## 💡 进阶方向

掌握本项目后，可以探索：

1. **多 Agent 系统** - 实现真正的团队协作
2. **持久化存储** - 使用数据库保存状态
3. **Web UI** - 为 Agent 添加可视化界面
4. **自定义 LLM** - 接入其他模型提供商
5. **性能优化** - 流式输出、并行执行优化

---

**Happy Coding! 🚀**

如有问题，欢迎提交 Issue 讨论。
