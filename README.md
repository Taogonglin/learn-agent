# Claude Code LangGraph Agent

基于 Learn Claude Code 12 节课程的完整 LangGraph Agent 实现。

## 环境配置

创建 `.env` 文件：

```bash
ANTHROPIC_AUTH_TOKEN=sk-sp-4ac51c$
ANTHROPIC_BASE_URL=https://coding$
ANTHROPIC_MODEL=kimi-k2.5
```

## 安装

```bash
npm install
```

## 运行

```bash
npm run agent
# 或
npm run dev
```

## 评估与追踪

项目现在内置了两层观测能力：

- `artifacts/traces.jsonl`: 每次 agent run 的结构化 trace
- `artifacts/evals.jsonl`: 在线/离线评估结果

如果配置了 LangSmith，还会同步上传 trace 和 feedback：

```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2...
LANGSMITH_PROJECT=claude-code-langgraph
LANGSMITH_EVAL_DATASET=claude-code-langgraph-evals
APP_ENV=dev
EVAL_JUDGE_MODEL=kimi-k2.5
EVAL_ENABLE_ONLINE_JUDGE=false
```

运行离线评估：

```bash
npm run eval
```

如果只想跑规则评估，不跑 LLM judge：

```bash
EVAL_DISABLE_JUDGE=true npm run eval
```

## 项目结构

```
src/
├── agents/
│   ├── graph.ts          # LangGraph 状态图
│   └── nodes.ts          # 图节点实现 (S01-S12)
├── skills/
│   ├── SkillManager.ts   # 技能管理 (S05)
│   ├── code-review/      # 代码审查技能
│   ├── pdf/              # PDF 处理技能
│   └── web-search/       # 网页搜索技能
├── tasks/                # 任务系统 (S07-S08)
├── worktrees/            # 工作树隔离 (S12)
├── llm/
│   └── client.ts         # LLM 客户端配置
├── tools/
│   └── index.ts          # 工具定义 (S02-S12)
├── types/
│   └── index.ts          # 类型定义
└── index.ts              # CLI 入口

skills/                   # 可加载技能文件目录
├── code-review/SKILL.md
├── pdf/SKILL.md
└── web-search/SKILL.md
```

## 12 节课集成

| 课程 | 内容 | 实现位置 |
|------|------|----------|
| S01 | Agent Loop | `graph.ts` - LangGraph 循环 |
| S02 | Tool Use | `tools/index.ts` - 基础工具定义 |
| S03 | Todo Write | `nodes.ts` - Todo 工具 + 提醒机制 |
| S04 | Subagent | `nodes.ts` - task 工具委派 |
| S05 | Skill Loading | `skills/SkillManager.ts` - 两层加载 |
| S06 | Context Compact | `nodes.ts` - 三层压缩 |
| S07 | Task System | `nodes.ts` - task_update 工具 |
| S08 | Background Tasks | `nodes.ts` - spawn/await_all |
| S09 | Agent Teams | `nodes.ts` - spawn_teammate/send_message |
| S10 | Team Protocols | `nodes.ts` - shutdown_request 处理 |
| S11 | Autonomous Agents | `nodes.ts` - set_goal/execute_next/reflect |
| S12 | Worktree Isolation | `nodes.ts` - worktree 工具 |

## 核心架构

### LangGraph 状态图

```
START → llm_call → [conditional] → tool_execution → context_management → task_tracking → llm_call
                              ↘
                               END
```

### 状态定义

包含所有 12 节课的状态：
- messages: 对话历史 (S01)
- todos: Todo 列表 (S03)
- loadedSkills: 已加载技能 (S05)
- transcripts: 压缩的上下文 (S06)
- tasks: 任务状态 (S07)
- backgroundJobs: 后台任务 (S08)
- teammates: 团队成员 (S09)
- activeProtocols: 活动协议 (S10)
- goals: 目标规划 (S11)
- worktrees: 工作树 (S12)

### 工具列表

所有工具都通过 LangChain DynamicStructuredTool 定义：

- **S02 基础**: bash, read_file, write_file, edit_file
- **S03 规划**: todo
- **S04 委派**: task
- **S05 技能**: load_skill
- **S06 压缩**: compact
- **S07 任务**: task_update
- **S08 并发**: spawn, await_all
- **S09 团队**: spawn_teammate, send_message, read_inbox
- **S11 目标**: set_goal, execute_next, reflect
- **S12 隔离**: create_worktree, execute_in_worktree

## 技能系统 (S05)

两层技能注入：

1. **Layer 1** (cheap): 技能元数据在 system prompt (~100 tokens/skill)
2. **Layer 2** (on demand): 完整技能内容在 tool_result

技能文件格式 (YAML frontmatter):

```markdown
---
name: code-review
description: Review code for quality and bugs
tags: development, quality
---

# Skill Content
...
```

## 上下文压缩 (S06)

三层压缩策略：

1. **micro_compact**: 每次执行替换旧 tool results
2. **auto_compact**: token > 50k 时自动总结
3. **compact tool**: 模型手动触发压缩

## 使用示例

```bash
# 基础任务
Agent> List files in current directory

# 使用 Todo
Agent> Create a todo list for building a web app

# 加载技能
Agent> Load the code-review skill and review src/index.ts

# 创建子代理
Agent> Use a subagent to research the best practices for TypeScript

# 设置目标
Agent> Set a goal to refactor the codebase into modules

# 团队协调
Agent> Spawn a reviewer teammate and ask them to check the PR
```

## 开发

```bash
# 构建
npm run build

# 运行编译版本
npm start

# 开发模式
npm run dev
```

## 配置

环境变量：

- `ANTHROPIC_AUTH_TOKEN`: API 密钥
- `ANTHROPIC_BASE_URL`: API 基础 URL
- `ANTHROPIC_MODEL`: 模型名称 (默认: kimi-k2.5)
- `LANGSMITH_TRACING`: 是否开启 LangSmith 追踪
- `LANGSMITH_API_KEY`: LangSmith API Key
- `LANGSMITH_PROJECT`: LangSmith 项目名
- `LANGSMITH_EVAL_DATASET`: 离线 eval 同步使用的数据集名称
- `APP_ENV`: 环境标识
- `EVAL_JUDGE_MODEL`: LLM judge 使用的模型
- `EVAL_ENABLE_ONLINE_JUDGE`: 是否在真实 CLI run 后执行在线 LLM judge
- `EVAL_DISABLE_JUDGE`: 是否在离线 eval 中禁用 LLM judge

## License

MIT

# learn-agent
