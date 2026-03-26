/**
 * Skill Manager
 * S05 - Two-layer skill injection
 *
 * Layer 1 (cheap): skill names in system prompt (~100 tokens/skill)
 * Layer 2 (on demand): full skill body in tool_result
 *
 * Key insight: "Don't put everything in the system prompt. Load on demand."
 */
export declare class SkillManager {
    private skillsDir;
    private cache;
    private availableSkills;
    constructor(skillsDir?: string);
    /**
     * Scan and discover available skills
     */
    discoverSkills(): Promise<void>;
    /**
     * Layer 1: Get skill metadata for system prompt (cheap)
     */
    getSkillDescriptions(): Promise<string>;
    /**
     * Get skill metadata without loading full body
     */
    private getSkillMeta;
    /**
     * Layer 2: Load full skill body (on demand)
     */
    loadSkill(name: string): Promise<string>;
    /**
     * Check if skill exists
     */
    hasSkill(name: string): boolean;
    /**
     * Get all available skill names
     */
    getAvailableSkills(): string[];
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Parse YAML frontmatter from skill file
     */
    private parseFrontmatter;
}
//# sourceMappingURL=SkillManager.d.ts.map