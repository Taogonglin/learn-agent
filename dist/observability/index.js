import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Client } from "langsmith";
const TRACE_DIR = path.resolve(process.cwd(), "artifacts");
const TRACE_FILE = path.join(TRACE_DIR, "traces.jsonl");
const EVAL_FILE = path.join(TRACE_DIR, "evals.jsonl");
class ObservabilityService {
    constructor() {
        this.activeRuns = new Map();
        if (this.isLangSmithEnabled()) {
            this.client = new Client({ apiKey: process.env.LANGSMITH_API_KEY });
        }
    }
    isLangSmithEnabled() {
        return process.env.LANGSMITH_TRACING === "true" && Boolean(process.env.LANGSMITH_API_KEY);
    }
    getProjectName() {
        return process.env.LANGSMITH_PROJECT || "claude-code-langgraph";
    }
    async startRun(input) {
        const runId = input.id || randomUUID();
        const startedAt = Date.now();
        const activeRun = {
            id: runId,
            name: input.name,
            runType: input.runType,
            startedAt,
        };
        if (input.parentRunId) {
            activeRun.parentRunId = input.parentRunId;
        }
        this.activeRuns.set(runId, activeRun);
        this.appendJsonLine(TRACE_FILE, {
            phase: "start",
            timestamp: new Date(startedAt).toISOString(),
            runId,
            parentRunId: input.parentRunId,
            runType: input.runType,
            name: input.name,
            inputs: input.inputs,
            metadata: input.metadata || {},
        });
        if (this.client) {
            const runPayload = {
                id: runId,
                name: input.name,
                inputs: input.inputs,
                run_type: input.runType,
                start_time: startedAt,
                trace_id: input.parentRunId || runId,
                project_name: this.getProjectName(),
                extra: input.metadata || {},
            };
            if (input.parentRunId) {
                runPayload.parent_run_id = input.parentRunId;
            }
            await this.client.createRun(runPayload);
        }
        return runId;
    }
    async endRun(runId, input) {
        const activeRun = this.activeRuns.get(runId);
        const endedAt = Date.now();
        const durationMs = activeRun ? endedAt - activeRun.startedAt : undefined;
        this.appendJsonLine(TRACE_FILE, {
            phase: "end",
            timestamp: new Date(endedAt).toISOString(),
            runId,
            durationMs,
            outputs: input.outputs || {},
            error: input.error,
            metadata: input.metadata || {},
        });
        if (this.client) {
            const updatePayload = {
                end_time: endedAt,
                outputs: input.outputs || {},
                extra: input.metadata || {},
            };
            if (input.error) {
                updatePayload.error = input.error;
            }
            await this.client.updateRun(runId, updatePayload);
        }
        this.activeRuns.delete(runId);
    }
    async createFeedback(input) {
        this.appendJsonLine(EVAL_FILE, {
            timestamp: new Date().toISOString(),
            runId: input.runId,
            key: input.key,
            score: input.score,
            comment: input.comment,
            value: input.value || {},
        });
        if (this.client) {
            const feedbackPayload = {
                score: input.score,
                feedbackSourceType: "app",
            };
            if (input.comment) {
                feedbackPayload.comment = input.comment;
            }
            if (input.value) {
                feedbackPayload.value = input.value;
            }
            await this.client.createFeedback(input.runId, input.key, feedbackPayload);
        }
    }
    async recordEvaluation(runId, result) {
        await this.createFeedback({
            runId,
            key: result.evaluator,
            score: result.score,
            comment: result.summary,
            value: {
                passed: result.passed,
                reasons: result.reasons,
                dimensions: result.dimensions,
                metadata: result.metadata || {},
            },
        });
    }
    async flush() {
        if (this.client) {
            await this.client.flush();
        }
    }
    appendJsonLine(filePath, payload) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf-8");
    }
}
export const observability = new ObservabilityService();
//# sourceMappingURL=index.js.map