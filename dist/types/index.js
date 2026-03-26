/**
 * Agent State Types
 * Integrates all 12 lessons from Learn Claude Code
 */
// ===== Initial State Factory =====
export function createInitialState() {
    return {
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
        stop: false,
    };
}
//# sourceMappingURL=index.js.map