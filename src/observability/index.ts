import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Client } from "langsmith";
import type { EvalResult } from "../types/index.js";

type RunType = "chain" | "llm" | "tool" | "retriever";

interface ActiveRun {
  id: string;
  name: string;
  runType: RunType;
  parentRunId?: string;
  startedAt: number;
}

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

const TRACE_DIR = path.resolve(process.cwd(), "artifacts");
const TRACE_FILE = path.join(TRACE_DIR, "traces.jsonl");
const EVAL_FILE = path.join(TRACE_DIR, "evals.jsonl");

class ObservabilityService {
  private client?: Client;
  private activeRuns = new Map<string, ActiveRun>();

  constructor() {
    if (this.isLangSmithEnabled()) {
      this.client = new Client({ apiKey: process.env.LANGSMITH_API_KEY! });
    }
  }

  isLangSmithEnabled(): boolean {
    return process.env.LANGSMITH_TRACING === "true" && Boolean(process.env.LANGSMITH_API_KEY);
  }

  getProjectName(): string {
    return process.env.LANGSMITH_PROJECT || "claude-code-langgraph";
  }

  async startRun(input: StartRunInput): Promise<string> {
    const runId = input.id || randomUUID();
    const startedAt = Date.now();
    const activeRun: ActiveRun = {
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
      const runPayload: Record<string, unknown> = {
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
      await this.client.createRun(runPayload as any);
    }

    return runId;
  }

  async endRun(runId: string, input: EndRunInput): Promise<void> {
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
      const updatePayload: Record<string, unknown> = {
        end_time: endedAt,
        outputs: input.outputs || {},
        extra: input.metadata || {},
      };
      if (input.error) {
        updatePayload.error = input.error;
      }
      await this.client.updateRun(runId, updatePayload as any);
    }

    this.activeRuns.delete(runId);
  }

  async createFeedback(input: FeedbackInput): Promise<void> {
    this.appendJsonLine(EVAL_FILE, {
      timestamp: new Date().toISOString(),
      runId: input.runId,
      key: input.key,
      score: input.score,
      comment: input.comment,
      value: input.value || {},
    });

    if (this.client) {
      const feedbackPayload: Record<string, unknown> = {
        score: input.score,
        feedbackSourceType: "app",
      };
      if (input.comment) {
        feedbackPayload.comment = input.comment;
      }
      if (input.value) {
        feedbackPayload.value = input.value;
      }
      await this.client.createFeedback(input.runId, input.key, feedbackPayload as any);
    }
  }

  async recordEvaluation(runId: string, result: EvalResult): Promise<void> {
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

  async flush(): Promise<void> {
    if (this.client) {
      await this.client.flush();
    }
  }

  private appendJsonLine(filePath: string, payload: Record<string, unknown>): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf-8");
  }
}

export const observability = new ObservabilityService();
