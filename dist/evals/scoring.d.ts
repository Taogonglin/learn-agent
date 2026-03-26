import type { EvalResult, EvalScenario, ToolResponse } from "../types/index.js";
export interface EvaluationSubject {
    input: string;
    finalOutput: string;
    roundCount: number;
    toolResponses: ToolResponse[];
    error?: string;
}
export declare function scoreScenarioRules(subject: EvaluationSubject, scenario: EvalScenario): EvalResult;
export declare function scoreOnlineRules(subject: EvaluationSubject): EvalResult;
export declare function scoreWithLlmJudge(subject: EvaluationSubject, options?: {
    scenario?: EvalScenario;
    evaluator?: "llm_judge" | "online_llm_judge";
}): Promise<EvalResult>;
//# sourceMappingURL=scoring.d.ts.map