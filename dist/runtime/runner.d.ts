import type { EvalResult, ToolResponse } from "../types/index.js";
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
export declare function executeAgentRun(options: AgentRunOptions): Promise<AgentRunResult>;
//# sourceMappingURL=runner.d.ts.map