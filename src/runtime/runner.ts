import { HumanMessage } from "@langchain/core/messages";
import { randomUUID } from "crypto";
import { createAgentGraph } from "../agents/graph.js";
import { createInitialState } from "../types/index.js";
import type { EvalResult, ToolResponse } from "../types/index.js";
import { observability } from "../observability/index.js";
import { scoreOnlineRules, scoreWithLlmJudge } from "../evals/scoring.js";

function renderContentBlock(block: unknown): string {
  if (typeof block === "string") {
    return block;
  }

  if (!block || typeof block !== "object") {
    return "";
  }

  const candidate = block as Record<string, unknown>;
  if (typeof candidate.text === "string") {
    return candidate.text;
  }
  if (typeof candidate.content === "string") {
    return candidate.content;
  }
  return "";
}

function renderMessageContent(content: unknown): string {
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
    } catch {
      return "";
    }
  }

  return "";
}

function isToolResultMessage(content: string): boolean {
  return content.startsWith("[") && content.includes("]:");
}

function shouldDisplayMessage(msg: unknown, content: string): boolean {
  if (!content.trim()) {
    return false;
  }

  if (isToolResultMessage(content)) {
    return true;
  }

  if (!msg || typeof msg !== "object") {
    return false;
  }

  const candidate = msg as Record<string, unknown>;
  const constructors = Array.isArray(candidate.id) ? candidate.id : [];

  if (typeof candidate.getType === "function") {
    try {
      return candidate.getType() === "ai";
    } catch {
      return false;
    }
  }

  if (typeof candidate.type === "string" && candidate.type.toLowerCase().includes("ai")) {
    return true;
  }

  return constructors.some((part) => String(part).includes("AIMessage"));
}

export interface AgentRunOptions {
  input: string;
  threadId?: string;
  runId?: string;
  onDisplayMessage?: (message: string) => void;
  metadata?: Record<string, unknown>;
  enableOnlineJudge?: boolean;
}

export interface AgentRunResult {
  runId: string;
  threadId: string;
  finalOutput: string;
  displayedMessages: string[];
  roundCount: number;
  toolResponses: ToolResponse[];
  evalResults: EvalResult[];
  error?: string;
}

export async function executeAgentRun(options: AgentRunOptions): Promise<AgentRunResult> {
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
  const toolResponseMap = new Map<string, ToolResponse>();
  const displayedMessages: string[] = [];

  try {
    const stream = await graph.stream(initialState as any, {
      configurable: {
        thread_id: threadId,
      },
    });

    for await (const update of stream) {
      let state: any = update;
      if ((update as any).llm_call) {
        state = (update as any).llm_call;
      } else if ((update as any).tool_execution) {
        state = (update as any).tool_execution;
      } else if ((update as Record<string, unknown>).__start__) {
        state = (update as Record<string, unknown>).__start__;
      }

      if (!state || typeof state !== "object") {
        continue;
      }

      const agentState = state as {
        messages?: unknown[];
        toolResponses?: ToolResponse[];
        stop?: boolean;
      };

      if (Array.isArray(agentState.toolResponses)) {
        for (const response of agentState.toolResponses) {
          toolResponseMap.set(response.toolCallId, response);
        }
      }

      if (agentState.messages && agentState.messages.length > messageCount) {
        const newMessages = agentState.messages.slice(messageCount);
        messageCount = agentState.messages.length;

        const hasToolResult = newMessages.some((msg: any) => {
          const content = msg?.kwargs?.content || msg?.content || "";
          return String(content).startsWith("[") && String(content).includes("]:");
        });
        const hasAssistantResponse = newMessages.some((msg: any) => msg?.kwargs?.tool_calls || msg?.tool_calls);

        if (hasToolResult || hasAssistantResponse) {
          roundCount++;
        }

        for (const msg of newMessages) {
          let content = "";
          if (typeof msg === "object" && msg !== null) {
            const m = msg as any;
            if (m.kwargs && "content" in m.kwargs) {
              content = renderMessageContent(m.kwargs.content);
            } else if ("content" in m) {
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

    const evalResults: EvalResult[] = [];
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
  } catch (error) {
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
