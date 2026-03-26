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
import * as readline from "readline";
import * as fs from "fs";
import { executeAgentRun } from "./runtime/runner.js";
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
}
catch (e) {
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
        const input = await new Promise((resolve, reject) => {
            try {
                rl.question("\n🤖 Agent> ", resolve);
            }
            catch (error) {
                reject(error);
            }
        }).catch((error) => {
            // 管道输入结束后，下一次调用 question 可能触发这个错误；
            // 将其转成一个受控的 quit 流程，而不是让进程以异常退出。
            if (error?.code === "ERR_USE_AFTER_CLOSE") {
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
        try {
            const result = await executeAgentRun({
                input,
                onDisplayMessage: (message) => {
                    console.log(message);
                },
            });
            if (result.error) {
                console.error("\n❌ Error:", result.error);
            }
            else {
                console.log(`\n✅ Task completed after ${result.roundCount} round(s)`);
            }
            console.log("─".repeat(60));
        }
        catch (error) {
            console.error("\n❌ Error:", error instanceof Error ? error.message : String(error));
        }
    }
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map