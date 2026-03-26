/**
 * Skill registry.
 *
 * Built-in skills are loaded from SKILL.md files bundled at build time via Vite ?raw imports.
 * Custom (workspace) skills are loaded from .agent/skills/ in the session IndexedDB workspace
 * via agentWorkspace.ts — callers must load those separately and pass as extraSkills.
 *
 * No localStorage is used here.
 */
import type { SkillDefinition, ToolDefinition } from '../types';
import { parseSkillMd, type ParsedSkill } from './skillParser';

// ── Bundled SKILL.md imports (Vite ?raw) ─────────────────────────────────────

import rawWeb from '../skills/web.skill.md?raw';
import rawCode from '../skills/code.skill.md?raw';
import rawProductivity from '../skills/productivity.skill.md?raw';
import rawWorkspace from '../skills/workspace.skill.md?raw';

// ── Parse at module load time ─────────────────────────────────────────────────

const BUILTIN_SKILL_LIST: ParsedSkill[] = [
  parseSkillMd(rawWeb),
  parseSkillMd(rawCode),
  parseSkillMd(rawProductivity),
];

const WORKSPACE_SKILL: ParsedSkill = parseSkillMd(rawWorkspace);

export const BUILTIN_SKILLS: Record<string, SkillDefinition> = Object.fromEntries(
  BUILTIN_SKILL_LIST.map((s) => [s.id, s])
);

// ── Public accessors ──────────────────────────────────────────────────────────

export function getAllBuiltinSkills(): SkillDefinition[] {
  return BUILTIN_SKILL_LIST;
}

export function getWorkspaceToolDefinitions(): ToolDefinition[] {
  return WORKSPACE_SKILL.tools;
}

export function getWorkspaceSkillDefinition(): SkillDefinition {
  return WORKSPACE_SKILL;
}

// ── Combined accessors ────────────────────────────────────────────────────────

/**
 * Get tool definitions for a list of skill IDs.
 * Pass workspace-loaded skills as extraSkills for full resolution.
 */
export function getToolsForSkills(
  skillIds: string[],
  extraSkills: SkillDefinition[] = []
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  const allSkills = [...BUILTIN_SKILL_LIST, ...extraSkills];
  for (const id of skillIds) {
    const skill = allSkills.find((s) => s.id === id);
    if (skill) {
      tools.push(...skill.tools);
    }
  }
  return tools;
}

/**
 * Collect instruction bodies from enabled skills for system prompt injection.
 * Workspace skill instructions are always included first.
 */
export function getSkillInstructions(
  skillIds: string[],
  extraSkills: SkillDefinition[] = []
): string {
  const allSkills = [...BUILTIN_SKILL_LIST, ...extraSkills];
  const parts: string[] = [];

  // Always include workspace skill instructions
  if (WORKSPACE_SKILL.instructions) {
    parts.push(WORKSPACE_SKILL.instructions);
  }

  for (const id of skillIds) {
    const skill = allSkills.find((s) => s.id === id);
    if (skill?.instructions) {
      parts.push(skill.instructions);
    }
  }

  return parts.join('\n\n---\n\n');
}
