import type { EvalResult, EvalScenario, ToolResponse } from "../types/index.js";
import { createNamedLLMClient } from "../llm/client.js";

export interface EvaluationSubject {
  input: string;
  finalOutput: string;
  roundCount: number;
  toolResponses: ToolResponse[];
  error?: string;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
}

export function scoreScenarioRules(subject: EvaluationSubject, scenario: EvalScenario): EvalResult {
  const usedTools = new Set(subject.toolResponses.map((item) => item.toolName));
  const expectedHits = scenario.expectedTools.filter((tool) => usedTools.has(tool)).length;
  const forbiddenHits = scenario.forbiddenTools.filter((tool) => usedTools.has(tool));
  const contentHitCount = scenario.mustContain.filter((snippet) => subject.finalOutput.includes(snippet)).length;
  const forbiddenContentHits = scenario.mustNotContain.filter((snippet) => subject.finalOutput.includes(snippet));
  const toolPrecision = scenario.expectedTools.length === 0
    ? usedTools.size === 0 ? 1 : 0
    : expectedHits / scenario.expectedTools.length;
  const efficiency = subject.roundCount <= scenario.maxRounds ? 1 : Math.max(0, 1 - ((subject.roundCount - scenario.maxRounds) * 0.25));
  const toolSelectionQuality = clampScore(toolPrecision - forbiddenHits.length * 0.3);
  const taskCompletion = clampScore(
    (scenario.mustContain.length === 0 ? 1 : contentHitCount / scenario.mustContain.length)
    - forbiddenContentHits.length * 0.3
    - (subject.error ? 0.4 : 0)
  );
  const finalAnswerQuality = clampScore(
    (subject.finalOutput.trim() ? 1 : 0)
    - forbiddenContentHits.length * 0.2
    - (subject.toolResponses.some((item) => item.success === false) ? 0.2 : 0)
  );
  const score = clampScore((taskCompletion + toolSelectionQuality + efficiency + finalAnswerQuality) / 4);
  const reasons: string[] = [];

  if (forbiddenHits.length > 0) {
    reasons.push(`Used forbidden tools: ${forbiddenHits.join(", ")}`);
  }
  if (subject.roundCount > scenario.maxRounds) {
    reasons.push(`Exceeded max rounds ${scenario.maxRounds}`);
  }
  if (forbiddenContentHits.length > 0) {
    reasons.push(`Final output included forbidden snippets: ${forbiddenContentHits.join(", ")}`);
  }
  if (subject.error) {
    reasons.push(`Execution error: ${subject.error}`);
  }

  return {
    evaluator: "rules",
    score,
    passed: score >= 0.7,
    summary: `rules score=${score.toFixed(2)} expected=${scenario.expectedTools.join(",") || "none"} used=${Array.from(usedTools).join(",") || "none"}`,
    dimensions: {
      taskCompletion,
      toolSelectionQuality,
      efficiency,
      finalAnswerQuality,
    },
    reasons,
    metadata: {
      scenarioId: scenario.id,
      usedTools: Array.from(usedTools),
    },
  };
}

export function scoreOnlineRules(subject: EvaluationSubject): EvalResult {
  const toolFailureRate = subject.toolResponses.length === 0
    ? 0
    : subject.toolResponses.filter((item) => !item.success).length / subject.toolResponses.length;
  const taskCompletion = clampScore(subject.finalOutput.trim() ? 1 : 0.2);
  const toolSelectionQuality = clampScore(1 - toolFailureRate);
  const efficiency = clampScore(subject.roundCount <= 3 ? 1 : 1 - (subject.roundCount - 3) * 0.15);
  const finalAnswerQuality = clampScore(subject.error ? 0.2 : subject.finalOutput.trim() ? 0.9 : 0.1);
  const score = clampScore((taskCompletion + toolSelectionQuality + efficiency + finalAnswerQuality) / 4);

  return {
    evaluator: "online_rules",
    score,
    passed: score >= 0.65,
    summary: `online rules score=${score.toFixed(2)} rounds=${subject.roundCount} tool_failures=${subject.toolResponses.filter((item) => !item.success).length}`,
    dimensions: {
      taskCompletion,
      toolSelectionQuality,
      efficiency,
      finalAnswerQuality,
    },
    reasons: subject.error ? [subject.error] : [],
    metadata: {
      toolCount: subject.toolResponses.length,
      failedToolCount: subject.toolResponses.filter((item) => !item.success).length,
    },
  };
}

export async function scoreWithLlmJudge(
  subject: EvaluationSubject,
  options?: { scenario?: EvalScenario; evaluator?: "llm_judge" | "online_llm_judge" }
): Promise<EvalResult> {
  const judgeModel = process.env.EVAL_JUDGE_MODEL || process.env.ANTHROPIC_MODEL || "kimi-k2.5";
  const model = createNamedLLMClient(judgeModel);
  const rubric = options?.scenario
    ? `Goal: ${options.scenario.goal}\nExpected tools: ${options.scenario.expectedTools.join(", ") || "none"}\nForbidden tools: ${options.scenario.forbiddenTools.join(", ") || "none"}`
    : "Judge whether the run completed the task well, chose tools well, and was efficient.";
  const prompt = `You are evaluating an AI agent run.

Return strict JSON only with this shape:
{
  "score": number,
  "summary": string,
  "taskCompletion": number,
  "toolSelectionQuality": number,
  "efficiency": number,
  "finalAnswerQuality": number,
  "reasons": string[]
}

All numeric values must be between 0 and 1.

Rubric:
${rubric}

Input:
${subject.input}

Final output:
${subject.finalOutput}

Tool responses:
${JSON.stringify(subject.toolResponses, null, 2)}

Round count: ${subject.roundCount}
Error: ${subject.error || "none"}`;

  const response = await model.invoke(prompt);
  const raw = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
  let parsed: {
    score: number;
    summary: string;
    taskCompletion: number;
    toolSelectionQuality: number;
    efficiency: number;
    finalAnswerQuality: number;
    reasons: string[];
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      score: 0,
      summary: "LLM judge returned invalid JSON",
      taskCompletion: 0,
      toolSelectionQuality: 0,
      efficiency: 0,
      finalAnswerQuality: 0,
      reasons: ["invalid judge output"],
    };
  }

  return {
    evaluator: options?.evaluator || "llm_judge",
    score: clampScore(parsed.score),
    passed: clampScore(parsed.score) >= 0.7,
    summary: parsed.summary,
    dimensions: {
      taskCompletion: clampScore(parsed.taskCompletion),
      toolSelectionQuality: clampScore(parsed.toolSelectionQuality),
      efficiency: clampScore(parsed.efficiency),
      finalAnswerQuality: clampScore(parsed.finalAnswerQuality),
    },
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons : ["missing reasons"],
    metadata: {
      scenarioId: options?.scenario?.id,
      judgeModel,
    },
  };
}
