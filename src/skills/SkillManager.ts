/**
 * Skill Manager
 * S05 - Two-layer skill injection
 *
 * Layer 1 (cheap): skill names in system prompt (~100 tokens/skill)
 * Layer 2 (on demand): full skill body in tool_result
 *
 * Key insight: "Don't put everything in the system prompt. Load on demand."
 */

import * as fs from "fs/promises";
import * as path from "path";
import { Skill } from "../types/index.js";

export class SkillManager {
  private skillsDir: string;
  private cache: Map<string, Skill> = new Map();
  private availableSkills: string[] = [];

  constructor(skillsDir: string = "./skills") {
    this.skillsDir = skillsDir;
  }

  /**
   * Scan and discover available skills
   */
  async discoverSkills(): Promise<void> {
    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });

      this.availableSkills = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(this.skillsDir, entry.name, "SKILL.md");
          try {
            await fs.access(skillPath);
            this.availableSkills.push(entry.name);
          } catch {
            // No SKILL.md, skip
          }
        }
      }
    } catch {
      // Directory doesn't exist
      this.availableSkills = [];
    }
  }

  /**
   * Layer 1: Get skill metadata for system prompt (cheap)
   */
  async getSkillDescriptions(): Promise<string> {
    if (this.availableSkills.length === 0) {
      await this.discoverSkills();
    }

    if (this.availableSkills.length === 0) {
      return "(no skills available)";
    }

    const descriptions: string[] = [];
    for (const name of this.availableSkills) {
      const meta = await this.getSkillMeta(name);
      const desc = meta.description || "No description";
      const tags = meta.tags ? ` [${meta.tags}]` : "";
      descriptions.push(`  - ${name}: ${desc}${tags}`);
    }

    return descriptions.join("\n");
  }

  /**
   * Get skill metadata without loading full body
   */
  private async getSkillMeta(name: string): Promise<Record<string, string>> {
    const skillPath = path.join(this.skillsDir, name, "SKILL.md");

    try {
      const content = await fs.readFile(skillPath, "utf-8");
      const { meta } = this.parseFrontmatter(content);
      return meta;
    } catch {
      return {};
    }
  }

  /**
   * Layer 2: Load full skill body (on demand)
   */
  async loadSkill(name: string): Promise<string> {
    // Check cache first
    if (this.cache.has(name)) {
      const skill = this.cache.get(name)!;
      return `<skill name="${name}">\n${skill.body}\n</skill>`;
    }

    // Load from disk
    const skillPath = path.join(this.skillsDir, name, "SKILL.md");

    try {
      const content = await fs.readFile(skillPath, "utf-8");
      const { meta, body } = this.parseFrontmatter(content);

      const skill: Skill = {
        name,
        meta,
        body,
        path: skillPath,
      };

      this.cache.set(name, skill);

      return `<skill name="${name}">\n${body}\n</skill>`;
    } catch (error) {
      return `Error: Skill '${name}' not found. Available: ${this.availableSkills.join(", ")}`;
    }
  }

  /**
   * Check if skill exists
   */
  hasSkill(name: string): boolean {
    return this.availableSkills.includes(name) || this.cache.has(name);
  }

  /**
   * Get all available skill names
   */
  getAvailableSkills(): string[] {
    return [...this.availableSkills];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Parse YAML frontmatter from skill file
   */
  private parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
    const match = content.match(/^---\n(.*?)\n---\n(.*)/s);

    if (!match || !match[1] || !match[2]) {
      return { meta: {}, body: content };
    }

    const meta: Record<string, string> = {};
    const metaText = match[1].trim();

    for (const line of metaText.split("\n")) {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex > 0) {
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        meta[key] = value;
      }
    }

    return { meta, body: match[2].trim() };
  }
}
