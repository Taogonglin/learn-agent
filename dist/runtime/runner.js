import { HumanMessage } from "@langchain/core/messages";
import { randomUUID } from "crypto";
import { createAgentGraph } from "../agents/graph.js";
import { createInitialState } from "../types/index.js";
import { observability } from "../observability/index.js";
import { scoreOnlineRules, scoreWithLlmJudge } from "../evals/scoring.js";
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
export async function executeAgentRun(options) {
    const graph = createAgentGraph();
    const runId = options.runId || randomUUID();
    const threadId = options.threadId || `run_${Date.now()}`;
    const initialState = createInitialState({
        runId,
        traceContext: {
            tags: Object.fromEntries(Object.entries(options.metadata || {}).map(([key, value]) => [key, String(value)])),
        },
    });
    initialState.messages.push(new HumanMessage({ content: options.input }));
    await observability.startRun({
        id: runId,
        name: "agent_run",
        runType: "chain",
        inputs: {
            input: options.input,
            threadId,
        },
        metadata: {
            app: "claude-code-langgraph",
            env: process.env.APP_ENV || "dev",
            model: process.env.ANTHROPIC_MODEL || "kimi-k2.5",
            ...options.metadata,
        },
    });
    let lastContent = "";
    let messageCount = 0;
    let roundCount = 0;
    let finalOutput = "";
    const toolResponseMap = new Map();
    const displayedMessages = [];
    try {
        const stream = await graph.stream(initialState, {
            configurable: {
                thread_id: threadId,
            },
        });
        for await (const update of stream) {
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
            if (!state || typeof state !== "object") {
                continue;
            }
            const agentState = state;
            if (Array.isArray(agentState.toolResponses)) {
                for (const response of agentState.toolResponses) {
                    toolResponseMap.set(response.toolCallId, response);
                }
            }
            if (agentState.messages && agentState.messages.length > messageCount) {
                const newMessages = agentState.messages.slice(messageCount);
                messageCount = agentState.messages.length;
                const hasToolResult = newMessages.some((msg) => {
                    const content = msg?.kwargs?.content || msg?.content || "";
                    return String(content).startsWith("[") && String(content).includes("]:");
                });
                const hasAssistantResponse = newMessages.some((msg) => msg?.kwargs?.tool_calls || msg?.tool_calls);
                if (hasToolResult || hasAssistantResponse) {
                    roundCount++;
                }
                for (const msg of newMessages) {
                    let content = "";
                    if (typeof msg === "object" && msg !== null) {
                        const m = msg;
                        if (m.kwargs && "content" in m.kwargs) {
                            content = renderMessageContent(m.kwargs.content);
                        }
                        else if ("content" in m) {
                            content = renderMessageContent(m.content);
                        }
                    }
                    if (content !== lastContent && shouldDisplayMessage(msg, content)) {
                        displayedMessages.push(content);
                        options.onDisplayMessage?.(content);
                        lastContent = content;
                        if (!isToolResultMessage(content)) {
                            finalOutput = content;
                        }
                    }
                }
            }
            if (agentState.stop) {
                break;
            }
        }
        const evalResults = [];
        const allToolResponses = Array.from(toolResponseMap.values());
        const onlineRules = scoreOnlineRules({
            input: options.input,
            finalOutput,
            roundCount,
            toolResponses: allToolResponses,
        });
        evalResults.push(onlineRules);
        await observability.recordEvaluation(runId, onlineRules);
        if (options.enableOnlineJudge || process.env.EVAL_ENABLE_ONLINE_JUDGE === "true") {
            const judgeResult = await scoreWithLlmJudge({
                input: options.input,
                finalOutput,
                roundCount,
                toolResponses: allToolResponses,
            }, { evaluator: "online_llm_judge" });
            evalResults.push(judgeResult);
            await observability.recordEvaluation(runId, judgeResult);
        }
        await observability.endRun(runId, {
            outputs: {
                finalOutput,
                roundCount,
                displayedMessages,
                toolResponses: allToolResponses,
            },
            metadata: {
                threadId,
            },
        });
        await observability.flush();
        return {
            runId,
            threadId,
            finalOutput,
            displayedMessages,
            roundCount,
            toolResponses: allToolResponses,
            evalResults,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const allToolResponses = Array.from(toolResponseMap.values());
        await observability.endRun(runId, {
            error: message,
            outputs: {
                finalOutput,
                roundCount,
                displayedMessages,
                toolResponses: allToolResponses,
            },
            metadata: {
                threadId,
            },
        });
        await observability.flush();
        return {
            runId,
            threadId,
            finalOutput,
            displayedMessages,
            roundCount,
            toolResponses: allToolResponses,
            evalResults: [],
            error: message,
        };
    }
}
//# sourceMappingURL=runner.js.map