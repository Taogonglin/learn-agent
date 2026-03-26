/**
 * Agent State Types
 * Integrates all 12 lessons from Learn Claude Code
 */

import { BaseMessage } from "@langchain/core/messages";

// ===== S03: Todo Management =====
export interface TodoItem {
  id: string;
  text: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: number;
  updatedAt?: number;
}

// ===== S05: Skill System =====
export interface Skill {
  name: string;
  meta: Record<string, string>;
  body: string;
  path: string;
}

// ===== S06: Context Compression =====
export interface Transcript {
  id: string;
  messages: BaseMessage[];
  summary: string;
  createdAt: number;
}

// ===== S07: Task System =====
export interface Task {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  parentId?: string;
  subTasks?: Task[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// ===== S08: Background Tasks =====
export interface BackgroundJob {
  id: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  result?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

// ===== S09/S10: Team Communication =====
export interface TeamMessage {
  id: string;
  type: "message" | "broadcast" | "shutdown_request" | "shutdown_response" | "plan_approval_response";
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

export interface TeamProtocol {
  id: string;
  type: "shutdown" | "plan_approval";
  status: "pending" | "approved" | "rejected";
  initiator: string;
  votes: Map<string, boolean>;
  createdAt: number;
}

export interface Teammate {
  name: string;
  role: string;
  status: "idle" | "working";
  inbox: TeamMessage[];
  spawnedAt: number;
}

// ===== S11: Goal Management =====
export interface Goal {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  subGoals: SubGoal[];
  reflections: Reflection[];
  createdAt: number;
}

export interface SubGoal {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  parentId: string;
}

export interface Reflection {
  timestamp: number;
  progress: number; // 0-1
  notes: string;
  replanned: boolean;
}

export interface RunMetrics {
  llmCalls: number;
  toolCalls: number;
  toolFailures: number;
  rounds: number;
}

export interface TraceContext {
  parentRunId?: string;
  tags?: Record<string, string>;
}

export interface EvalDimensionScores {
  taskCompletion: number;
  toolSelectionQuality: number;
  efficiency: number;
  finalAnswerQuality: number;
}

export interface EvalResult {
  evaluator: "rules" | "llm_judge" | "online_rules" | "online_llm_judge";
  score: number;
  passed: boolean;
  summary: string;
  dimensions: EvalDimensionScores;
  reasons: string[];
  metadata?: Record<string, unknown>;
}

export interface EvalScenario {
  id: string;
  input: string;
  goal: string;
  expectedTools: string[];
  forbiddenTools: string[];
  maxRounds: number;
  mustContain: string[];
  mustNotContain: string[];
  notes?: string;
}

// ===== S12: Worktree Isolation =====
export interface Worktree {
  id: string;
  path: string;
  branch: string;
  taskId: string;
  status: "active" | "cleaned";
  createdAt: number;
  cleanedAt?: number;
}

// ===== Main Agent State =====
export interface AgentState {
  // S01: Base messages
  messages: BaseMessage[];

  // S03: Todo tracking
  todos: TodoItem[];
  lastTodoUpdate: number;

  // S05: Loaded skills
  loadedSkills: string[];
  availableSkills: string[];

  // S06: Context management
  transcripts: Transcript[];
  compactCount: number;

  // S07: Task system
  tasks: Task[];
  currentTaskId?: string;

  // S08: Background jobs
  backgroundJobs: BackgroundJob[];

  // S09/S10: Team coordination
  teammates: Map<string, Teammate>;
  activeProtocols: TeamProtocol[];

  // S11: Goal planning
  goals: Goal[];
  currentGoalId?: string;

  // S12: Worktree isolation
  worktrees: Worktree[];

  // Tool calls and responses
  toolCalls: ToolCall[];
  toolResponses: ToolResponse[];
  runId: string;
  traceContext?: TraceContext;
  metrics: RunMetrics;

  // Control flow
  nextNode?: string;
  stop: boolean;

  // Index signature for LangGraph compatibility
  [key: string]: unknown;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResponse {
  toolCallId: string;
  toolName: string;
  success: boolean;
  durationMs?: number;
  output: string;
  error?: string;
}

// ===== Initial State Factory =====
export function createInitialState(options?: {
  runId?: string;
  traceContext?: TraceContext;
}): AgentState {
  const state: AgentState = {
    messages: [],
    todos: [],
    lastTodoUpdate: 0,
    loadedSkills: [],
    availableSkills: [],
    transcripts: [],
    compactCount: 0,
    tasks: [],
    backgroundJobs: [],
    teammates: new Map(),
    activeProtocols: [],
    goals: [],
    worktrees: [],
    toolCalls: [],
    toolResponses: [],
    runId: options?.runId || `run_${Date.now()}`,
    metrics: {
      llmCalls: 0,
      toolCalls: 0,
      toolFailures: 0,
      rounds: 0,
    },
    stop: false,
  };

  if (options?.traceContext) {
    state.traceContext = options.traceContext;
  }

  return state;
}
