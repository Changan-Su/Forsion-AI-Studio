/**
 * SKILL.md parser and serializer.
 *
 * Format:
 *   ---
 *   id: web
 *   name: Web Access
 *   ...YAML frontmatter with tool definitions...
 *   ---
 *
 *   # Markdown body
 *   Natural language instructions injected into the agent system prompt.
 */
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  SkillDefinition,
  ToolDefinition,
  ToolParameterSchema,
  CustomSkillDefinition,
  CustomToolDefinition,
  CustomToolExecutorConfig,
} from '../types';

// ── Internal frontmatter shape ────────────────────────────────────────────────

interface SkillFrontmatter {
  id: string;
  name: string;
  description: string;
  icon: string;
  isBuiltin?: boolean;
  isWorkspace?: boolean;
  tools: RawToolEntry[];
}

interface RawToolEntry {
  name: string;
  description: string;
  executor: 'builtin' | RawExecutorConfig;
  parameters: ToolParameterSchema;
}

interface RawExecutorConfig {
  type: 'javascript' | 'http';
  code?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  bodyTemplate?: string;
}

// ── Parse ─────────────────────────────────────────────────────────────────────

function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: '', body: raw.trim() };
  }
  return { frontmatter: match[1], body: match[2].trim() };
}

function rawToolToDefinition(raw: RawToolEntry, skillId: string): ToolDefinition {
  const base: ToolDefinition = {
    name: raw.name,
    description: raw.description,
    parameters: raw.parameters ?? { type: 'object', properties: {}, required: [] },
    skillId,
    isBuiltin: raw.executor === 'builtin',
    executorType: raw.executor === 'builtin' ? 'builtin' : (raw.executor as RawExecutorConfig).type,
  };

  if (raw.executor !== 'builtin') {
    const cfg = raw.executor as RawExecutorConfig;
    if (cfg.type === 'javascript') {
      base.executorConfig = { type: 'javascript', code: cfg.code ?? '' };
    } else if (cfg.type === 'http') {
      base.executorConfig = {
        type: 'http',
        url: cfg.url ?? '',
        method: cfg.method ?? 'GET',
        headers: cfg.headers,
        bodyTemplate: cfg.bodyTemplate,
      };
    }
  }

  return base;
}

export interface ParsedSkill extends SkillDefinition {
  isWorkspace?: boolean;
}

export function parseSkillMd(raw: string): ParsedSkill {
  const { frontmatter, body } = splitFrontmatter(raw);
  const fm = parseYaml(frontmatter) as SkillFrontmatter;

  const tools: ToolDefinition[] = (fm.tools ?? []).map((t) =>
    rawToolToDefinition(t, fm.id)
  );

  return {
    id: fm.id,
    name: fm.name,
    description: fm.description,
    icon: fm.icon ?? 'Wrench',
    isBuiltin: fm.isBuiltin ?? false,
    isWorkspace: fm.isWorkspace ?? false,
    tools,
    instructions: body || undefined,
  };
}

// ── Serialize ─────────────────────────────────────────────────────────────────

function definitionToRawTool(tool: ToolDefinition): RawToolEntry {
  let executor: 'builtin' | RawExecutorConfig = 'builtin';
  if (!tool.isBuiltin && tool.executorConfig) {
    const cfg = tool.executorConfig;
    if (cfg.type === 'javascript') {
      executor = { type: 'javascript', code: (cfg as import('../types').JavaScriptExecutorConfig).code };
    } else if (cfg.type === 'http') {
      const h = cfg as import('../types').HttpExecutorConfig;
      executor = { type: 'http', url: h.url, method: h.method, headers: h.headers, bodyTemplate: h.bodyTemplate };
    }
  }
  return {
    name: tool.name,
    description: tool.description,
    executor,
    parameters: tool.parameters,
  };
}

/**
 * Serialize a SkillDefinition back to SKILL.md text.
 * Used when saving custom skills to the workspace.
 */
export function serializeSkillMd(skill: SkillDefinition): string {
  const fm: SkillFrontmatter = {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    icon: skill.icon,
    isBuiltin: skill.isBuiltin,
    tools: skill.tools.map(definitionToRawTool),
  };

  const yamlStr = stringifyYaml(fm, { lineWidth: 0 });
  const body = skill.instructions ?? '';

  return `---\n${yamlStr}---\n${body ? '\n' + body + '\n' : ''}`;
}

// ── Conversion helpers ────────────────────────────────────────────────────────

/**
 * Convert a legacy CustomSkillDefinition (localStorage format) to ParsedSkill.
 */
export function customSkillToParsed(skill: CustomSkillDefinition): ParsedSkill {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    icon: skill.icon,
    isBuiltin: false,
    tools: (skill.tools as CustomToolDefinition[]).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      skillId: t.skillId,
      isBuiltin: false,
      executorType: t.executor?.type ?? 'javascript',
      executorConfig: t.executor as CustomToolExecutorConfig | undefined,
    })),
    instructions: undefined,
  };
}

/**
 * Convert a ParsedSkill to a CustomSkillDefinition (legacy format for SkillEditor compatibility).
 */
export function parsedToCustomSkill(skill: ParsedSkill): CustomSkillDefinition {
  const now = Date.now();
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    icon: skill.icon,
    isBuiltin: false as const,
    createdAt: now,
    updatedAt: now,
    tools: skill.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      skillId: skill.id,
      isBuiltin: false,
      executor: (t.executorConfig ?? { type: 'javascript', code: '// return a value;\nreturn "";' }) as CustomToolExecutorConfig,
    })) as CustomToolDefinition[],
  };
}
