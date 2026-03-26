/**
 * Agent State Types
 * Integrates all 12 lessons from Learn Claude Code
 */
import { BaseMessage } from "@langchain/core/messages";
export interface TodoItem {
    id: string;
    text: string;
    status: "pending" | "in_progress" | "completed";
    createdAt: number;
    updatedAt?: number;
}
export interface Skill {
    name: string;
    meta: Record<string, string>;
    body: string;
    path: string;
}
export interface Transcript {
    id: string;
    messages: BaseMessage[];
    summary: string;
    createdAt: number;
}
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
export interface BackgroundJob {
    id: string;
    prompt: string;
    status: "running" | "completed" | "failed";
    result?: string;
    error?: string;
    createdAt: number;
    completedAt?: number;
}
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
    progress: number;
    notes: string;
    replanned: boolean;
}
export interface Worktree {
    id: string;
    path: string;
    branch: string;
    taskId: string;
    status: "active" | "cleaned";
    createdAt: number;
    cleanedAt?: number;
}
export interface AgentState {
    messages: BaseMessage[];
    todos: TodoItem[];
    lastTodoUpdate: number;
    loadedSkills: string[];
    availableSkills: string[];
    transcripts: Transcript[];
    compactCount: number;
    tasks: Task[];
    currentTaskId?: string;
    backgroundJobs: BackgroundJob[];
    teammates: Map<string, Teammate>;
    activeProtocols: TeamProtocol[];
    goals: Goal[];
    currentGoalId?: string;
    worktrees: Worktree[];
    toolCalls: ToolCall[];
    toolResponses: ToolResponse[];
    nextNode?: string;
    stop: boolean;
    [key: string]: unknown;
}
export interface ToolCall {
    id: string;
    name: string;
    args: Record<string, unknown>;
}
export interface ToolResponse {
    toolCallId: string;
    output: string;
    error?: string;
}
export declare function createInitialState(): AgentState;
//# sourceMappingURL=index.d.ts.map