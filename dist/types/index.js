/**
 * Agent State Types
 * Integrates all 12 lessons from Learn Claude Code
 */
// ===== Initial State Factory =====
export function createInitialState(options) {
    const state = {
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
//# sourceMappingURL=index.js.map