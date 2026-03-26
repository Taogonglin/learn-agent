import { Client } from "langsmith";
function isLangSmithConfigured() {
    return process.env.LANGSMITH_TRACING === "true" && Boolean(process.env.LANGSMITH_API_KEY);
}
function getDatasetName() {
    return process.env.LANGSMITH_EVAL_DATASET || "claude-code-langgraph-evals";
}
export async function syncScenariosToLangSmith(scenarios) {
    if (!isLangSmithConfigured()) {
        return;
    }
    const client = new Client({ apiKey: process.env.LANGSMITH_API_KEY });
    const datasetName = getDatasetName();
    const hasDataset = await client.hasDataset({ datasetName });
    if (!hasDataset) {
        await client.createDataset(datasetName, {
            description: "Evaluation scenarios for claude-code-langgraph",
            dataType: "kv",
            metadata: {
                app: "claude-code-langgraph",
            },
        });
    }
    const existingScenarioIds = new Set();
    for await (const example of client.listExamples({ datasetName })) {
        const scenarioId = typeof example.metadata?.scenarioId === "string"
            ? example.metadata.scenarioId
            : undefined;
        if (scenarioId) {
            existingScenarioIds.add(scenarioId);
        }
    }
    for (const scenario of scenarios) {
        if (existingScenarioIds.has(scenario.id)) {
            continue;
        }
        await client.createExample({
            dataset_name: datasetName,
            inputs: {
                input: scenario.input,
            },
            outputs: {
                goal: scenario.goal,
            },
            metadata: {
                scenarioId: scenario.id,
                expectedTools: scenario.expectedTools,
                forbiddenTools: scenario.forbiddenTools,
                maxRounds: scenario.maxRounds,
                mustContain: scenario.mustContain,
                mustNotContain: scenario.mustNotContain,
                notes: scenario.notes || "",
            },
        });
    }
}
//# sourceMappingURL=langsmith.js.map