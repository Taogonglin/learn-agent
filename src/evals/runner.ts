import dotenv from "dotenv";
import { executeAgentRun } from "../runtime/runner.js";
import { DEFAULT_EVAL_SCENARIOS } from "./scenarios.js";
import { scoreScenarioRules, scoreWithLlmJudge } from "./scoring.js";
import { observability } from "../observability/index.js";
import { syncScenariosToLangSmith } from "./langsmith.js";

dotenv.config();

async function main() {
  console.log("=".repeat(80));
  console.log("Claude Code LangGraph Eval Runner");
  console.log("=".repeat(80));

  await syncScenariosToLangSmith(DEFAULT_EVAL_SCENARIOS);

  const results: Array<{
    id: string;
    ruleScore: number;
    judgeScore?: number;
    passed: boolean;
  }> = [];

  for (const scenario of DEFAULT_EVAL_SCENARIOS) {
    console.log(`\n[Scenario] ${scenario.id}`);
    const run = await executeAgentRun({
      input: scenario.input,
      metadata: {
        is_eval_run: true,
        scenario_id: scenario.id,
      },
    });

    if (run.error) {
      console.log(`  Error: ${run.error}`);
    }

    const ruleResult = scoreScenarioRules({
      input: scenario.input,
      finalOutput: run.finalOutput,
      roundCount: run.roundCount,
      toolResponses: run.toolResponses,
      ...(run.error ? { error: run.error } : {}),
    }, scenario);
    await observability.recordEvaluation(run.runId, ruleResult);

    let judgeScore: number | undefined;
    if ((process.env.EVAL_DISABLE_JUDGE || "false") !== "true") {
      const judgeResult = await scoreWithLlmJudge({
        input: scenario.input,
        finalOutput: run.finalOutput,
        roundCount: run.roundCount,
        toolResponses: run.toolResponses,
        ...(run.error ? { error: run.error } : {}),
      }, {
        evaluator: "llm_judge",
        scenario,
      });
      judgeScore = judgeResult.score;
      await observability.recordEvaluation(run.runId, judgeResult);
      console.log(`  Judge score: ${judgeResult.score.toFixed(2)} | ${judgeResult.summary}`);
    }

    const resultRow: {
      id: string;
      ruleScore: number;
      judgeScore?: number;
      passed: boolean;
    } = {
      id: scenario.id,
      ruleScore: ruleResult.score,
      passed: ruleResult.passed,
    };
    if (typeof judgeScore === "number") {
      resultRow.judgeScore = judgeScore;
    }
    results.push(resultRow);

    console.log(`  Rule score: ${ruleResult.score.toFixed(2)} | ${ruleResult.summary}`);
  }

  const avgRule = results.reduce((sum, item) => sum + item.ruleScore, 0) / Math.max(results.length, 1);
  const judgeScores = results.map((item) => item.judgeScore).filter((item): item is number => typeof item === "number");
  const avgJudge = judgeScores.length > 0
    ? judgeScores.reduce((sum, item) => sum + item, 0) / judgeScores.length
    : undefined;

  console.log("\n" + "-".repeat(80));
  console.log(`Average rule score: ${avgRule.toFixed(2)}`);
  if (typeof avgJudge === "number") {
    console.log(`Average judge score: ${avgJudge.toFixed(2)}`);
  }
  console.log(`Passed: ${results.filter((item) => item.passed).length}/${results.length}`);
  console.log("-".repeat(80));

  await observability.flush();
}

main().catch((error) => {
  console.error("Eval runner failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
