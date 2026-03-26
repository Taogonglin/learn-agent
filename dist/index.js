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
import * as fs from "fs";
function renderContentBlock(block) {
    if (typeof block === "string") {
        return block;
    }
    if (!block || typeof block !== "object") {
        return "";
    }
    const candidate = block;
    if (typeof candidate.text === "string") {
        return candidate.text;
    }
    if (typeof candidate.content === "string") {
        return candidate.content;
    }
    return "";
}
function renderMessageContent(content) {
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .map((item) => renderContentBlock(item))
            .filter((item) => item.trim())
            .join("\n")
            .trim();
    }
    if (content && typeof content === "object") {
        const rendered = renderContentBlock(content);
        if (rendered) {
            return rendered;
        }
        try {
            return JSON.stringify(content, null, 2);
        }
        catch {
            return "";
        }
    }
    return "";
}
function isToolResultMessage(content) {
    return content.startsWith("[") && content.includes("]:");
}
function shouldDisplayMessage(msg, content) {
    if (!content.trim()) {
        return false;
    }
    if (isToolResultMessage(content)) {
        return true;
    }
    if (!msg || typeof msg !== "object") {
        return false;
    }
    const candidate = msg;
    const constructors = Array.isArray(candidate.id) ? candidate.id : [];
    if (typeof candidate.getType === "function") {
        try {
            return candidate.getType() === "ai";
        }
        catch {
            return false;
        }
    }
    if (typeof candidate.type === "string" && candidate.type.toLowerCase().includes("ai")) {
        return true;
    }
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
}
catch (e) {
    // .env 文件不存在时忽略
}
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
async function main() {
    const graph = createAgentGraph();
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
        const input = await new Promise((resolve, reject) => {
            try {
                rl.question("\n🤖 Agent> ", resolve);
            }
            catch (error) {
                reject(error);
            }
        }).catch((error) => {
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
        const initialState = createInitialState();
        initialState.messages.push(new HumanMessage({ content: input }));
        try {
            const stream = await graph.stream(initialState, {
                configurable: {
                    thread_id: `run_${Date.now()}`,
                },
            });
            let lastContent = "";
            let messageCount = 0;
            let roundCount = 0;
            for await (const update of stream) {
                // Handle different update types from LangGraph stream
                // Messages can be in update.llm_call, update.tool_execution, or update.__start__
                let state = update;
                if (update.llm_call) {
                    state = update.llm_call;
                }
                else if (update.tool_execution) {
                    state = update.tool_execution;
                }
                else if (update.__start__) {
                    state = update.__start__;
                }
                if (state && typeof state === 'object') {
                    const agentState = state;
                    if (agentState.messages && agentState.messages.length > messageCount) {
                        const newMessages = agentState.messages.slice(messageCount);
                        const newCount = agentState.messages.length - messageCount;
                        messageCount = agentState.messages.length;
                        // 检测是否是新的一轮（收到工具结果后 LLM 再次响应）
                        const hasToolResult = newMessages.some((msg) => {
                            const content = msg?.kwargs?.content || msg?.content || '';
                            return String(content).startsWith('[') && String(content).includes(']:');
                        });
                        const hasAssistantResponse = newMessages.some((msg) => {
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
                            // Handle LangChain serialized message format
                            let content = "";
                            if (typeof msg === 'object' && msg !== null) {
                                const m = msg;
                                // LangChain serialized format: { lc: 1, type: "constructor", id: [...], kwargs: { content: "..." } }
                                if (m.kwargs && "content" in m.kwargs) {
                                    content = renderMessageContent(m.kwargs.content);
                                }
                                else if ('content' in m) {
                                    content = renderMessageContent(m.content);
                                }
                            }
                            if (content !== lastContent && shouldDisplayMessage(msg, content)) {
                                console.log(content);
                                lastContent = content;
                            }
                        }
                    }
                    if (agentState.stop) {
                        console.log("\n[Agent stopped]");
                        break;
                    }
                }
            }
            console.log(`\n✅ Task completed after ${roundCount} round(s)`);
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