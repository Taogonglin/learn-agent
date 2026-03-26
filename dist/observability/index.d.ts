import type { EvalResult } from "../types/index.js";
type RunType = "chain" | "llm" | "tool" | "retriever";
interface StartRunInput {
    id?: string;
    name: string;
    runType: RunType;
    inputs: Record<string, unknown>;
    parentRunId?: string;
    metadata?: Record<string, unknown>;
}
interface EndRunInput {
    outputs?: Record<string, unknown>;
    error?: string;
    metadata?: Record<string, unknown>;
}
interface FeedbackInput {
    runId: string;
    key: string;
    score: number;
    comment?: string;
    value?: Record<string, unknown>;
}
declare class ObservabilityService {
    private client?;
    private activeRuns;
    constructor();
    isLangSmithEnabled(): boolean;
    getProjectName(): string;
    startRun(input: StartRunInput): Promise<string>;
    endRun(runId: string, input: EndRunInput): Promise<void>;
    createFeedback(input: FeedbackInput): Promise<void>;
    recordEvaluation(runId: string, result: EvalResult): Promise<void>;
    flush(): Promise<void>;
    private appendJsonLine;
}
export declare const observability: ObservabilityService;
export {};
//# sourceMappingURL=index.d.ts.map