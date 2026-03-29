import { ToolResult, ToolDefinition, CustomToolExecutorConfig } from '../types';
import { workspaceService } from './workspaceService';
import { pyodideService } from './pyodideService';
import { readMemory, writeMemory, appendMemory } from './memoryService';

export type ToolExecutorFn = (
  args: Record<string, unknown>,
  signal?: AbortSignal
) => Promise<unknown>;

// ── web_search ───────────────────────────────────────────────────────────────

const webSearch: ToolExecutorFn = async ({ query }, signal) => {
  const q = encodeURIComponent(String(query));
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`,
    { signal }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const results: string[] = [];
  if (data.AbstractText) results.push(data.AbstractText);
  if (data.Answer) results.push(`Answer: ${data.Answer}`);
  if (data.RelatedTopics?.length) {
    const topics = (data.RelatedTopics as Array<{ Text?: string; FirstURL?: string }>)
      .slice(0, 5)
      .filter((t) => t.Text)
      .map((t) => `- ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ''}`);
    if (topics.length) results.push('Related:\n' + topics.join('\n'));
  }

  return results.length > 0 ? results.join('\n\n') : 'No results found.';
};

// ── url_fetch ────────────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  // Remove script/style blocks
  let text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

const urlFetch: ToolExecutorFn = async ({ url, format }, signal) => {
  const res = await fetch(String(url), { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (contentType.includes('text/html') && format !== 'text') {
    return htmlToText(text).slice(0, 8000); // cap output
  }
  return text.slice(0, 8000);
};

// ── js_eval ───────────────────────────────────────────────────────────────────

const jsEval: ToolExecutorFn = async ({ code }) => {
  const src = String(code);
  const result = await Promise.race([
    new Promise<unknown>((resolve, reject) => {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`"use strict"; return (${src})`);
        resolve(fn());
      } catch {
        try {
          // Try as statement block
          // eslint-disable-next-line no-new-func
          const fn2 = new Function(`"use strict"; ${src}`);
          resolve(fn2());
        } catch (e2) {
          reject(e2);
        }
      }
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Execution timed out (3s)')), 3000)
    ),
  ]);
  return result === undefined ? 'undefined' : JSON.stringify(result);
};

// ── calculator ────────────────────────────────────────────────────────────────

const calculator: ToolExecutorFn = async ({ expression }) => {
  const expr = String(expression).trim();
  if (!/^[0-9+\-*/().\s%^e,]+$/i.test(expr)) {
    throw new Error('Invalid expression: only numbers and basic operators allowed.');
  }
  // eslint-disable-next-line no-new-func
  const result = new Function(`"use strict"; return (${expr})`)();
  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Expression did not evaluate to a finite number.');
  }
  return result;
};

// ── get_datetime ──────────────────────────────────────────────────────────────

const getDatetime: ToolExecutorFn = async ({ timezone }) => {
  const tz = timezone ? String(timezone) : 'UTC';
  try {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(now);
    return { datetime: formatted, timezone: tz, iso: now.toISOString() };
  } catch {
    throw new Error(`Unknown timezone: ${tz}`);
  }
};

// ── weather_lookup ────────────────────────────────────────────────────────────

const weatherLookup: ToolExecutorFn = async ({ location }, signal) => {
  const loc = encodeURIComponent(String(location));
  const res = await fetch(`https://wttr.in/${loc}?format=j1`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const current = data?.current_condition?.[0];
  if (!current) throw new Error('No weather data returned.');
  return {
    location: String(location),
    temp_c: current.temp_C,
    temp_f: current.temp_F,
    feels_like_c: current.FeelsLikeC,
    humidity_pct: current.humidity,
    description: current.weatherDesc?.[0]?.value ?? 'Unknown',
    wind_kmph: current.windspeedKmph,
    visibility_km: current.visibility,
  };
};

// ── memory_read ──────────────────────────────────────────────────────────────

const memoryRead: ToolExecutorFn = async () => {
  const content = await readMemory();
  if (!content) return '(Memory is empty)';
  return content.length > 10000 ? content.slice(0, 10000) + '\n...[truncated]' : content;
};

// ── memory_write ─────────────────────────────────────────────────────────────

const memoryWrite: ToolExecutorFn = async ({ content }) => {
  await writeMemory(String(content));
  return `Memory replaced (${String(content).length} chars)`;
};

// ── memory_append ────────────────────────────────────────────────────────────

const memoryAppend: ToolExecutorFn = async ({ text }) => {
  await appendMemory(String(text));
  return `Appended to memory: ${String(text).slice(0, 100)}`;
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const TOOL_EXECUTORS: Record<string, ToolExecutorFn> = {
  web_search: webSearch,
  url_fetch: urlFetch,
  js_eval: jsEval,
  calculator,
  get_datetime: getDatetime,
  weather_lookup: weatherLookup,
  memory_read: memoryRead,
  memory_write: memoryWrite,
  memory_append: memoryAppend,
};

// ── Custom tool execution ─────────────────────────────────────────────────────

function interpolateTemplate(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = args[key];
    return val !== undefined ? String(val) : '';
  });
}

async function executeHttpTool(
  config: Extract<CustomToolExecutorConfig, { type: 'http' }>,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<unknown> {
  const url = interpolateTemplate(config.url, args);
  const headers: Record<string, string> = { ...config.headers };

  const init: RequestInit = { method: config.method, signal, headers };

  if (config.method !== 'GET' && config.bodyTemplate) {
    const bodyStr = interpolateTemplate(config.bodyTemplate, args);
    init.body = bodyStr;
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);

  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) return res.json();
  const text = await res.text();
  return text.slice(0, 8000);
}

async function executeJavaScriptTool(
  config: Extract<CustomToolExecutorConfig, { type: 'javascript' }>,
  args: Record<string, unknown>
): Promise<unknown> {
  const result = await Promise.race([
    new Promise<unknown>((resolve, reject) => {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('args', `"use strict"; ${config.code}`);
        resolve(fn(args));
      } catch (e) {
        reject(e);
      }
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Execution timed out (5s)')), 5000)
    ),
  ]);
  return result === undefined ? 'undefined' : result;
}

// ── Workspace tool executors (session-scoped) ─────────────────────────────────

export function createWorkspaceToolExecutors(sessionId: string): Record<string, ToolExecutorFn> {
  return {
    read_file: async ({ path }) => {
      const text = await workspaceService.readTextFile(sessionId, String(path));
      if (text === null) throw new Error(`File not found: ${path}`);
      return text.length > 10000 ? text.slice(0, 10000) + '\n...[truncated]' : text;
    },
    write_file: async ({ path, content }) => {
      await workspaceService.writeTextFile(sessionId, String(path), String(content));
      return `File written: ${path} (${String(content).length} chars)`;
    },
    list_files: async () => {
      const files = await workspaceService.listFiles(sessionId);
      if (files.length === 0) return 'Workspace is empty.';
      return files.map(f => `${f.path}  (${f.mimeType}, ${f.size} bytes)`).join('\n');
    },
    delete_file: async ({ path }) => {
      const ok = await workspaceService.deleteFile(sessionId, String(path));
      return ok ? `Deleted: ${path}` : `File not found: ${path}`;
    },
    run_python: async ({ code }, signal) => {
      const result = await pyodideService.execute(sessionId, String(code), signal);
      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr) output += (output ? '\n' : '') + '[stderr]\n' + result.stderr;
      if (result.generatedFiles.length > 0) {
        output += (output ? '\n\n' : '') + 'Generated files: ' + result.generatedFiles.map(f => f.path).join(', ');
      }
      output += `\n[Execution time: ${result.durationMs}ms]`;
      return output || '(no output)';
    },
    show_image: async ({ path }) => {
      const dataUrl = await workspaceService.readFileAsDataUrl(sessionId, String(path));
      if (!dataUrl) throw new Error(`Image not found: ${path}`);
      return { _type: 'workspace_image', path: String(path), dataUrl };
    },
  };
}

async function dispatchExecutorConfig(
  config: CustomToolExecutorConfig,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<unknown> {
  if (config.type === 'http') {
    return executeHttpTool(config, args, signal);
  } else if (config.type === 'javascript') {
    return executeJavaScriptTool(config, args);
  }
  throw new Error(`Unknown executor type: ${(config as CustomToolExecutorConfig).type}`);
}

/**
 * Execute a tool by name.
 * @param toolDef - Optional ToolDefinition with executorConfig for custom/workspace tools.
 *                  Custom tools loaded from .agent/skills/ carry their executorConfig here.
 */
export async function executeBuiltinTool(
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
  toolDef?: ToolDefinition
): Promise<ToolResult> {
  // 1. Built-in executor (hardcoded in TOOL_EXECUTORS)
  const executor = TOOL_EXECUTORS[toolName];
  if (executor) {
    const start = Date.now();
    try {
      const result = await executor(args, signal);
      return { toolCallId: '', name: toolName, result, isError: false, durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { toolCallId: '', name: toolName, result: e instanceof Error ? e.message : String(e), isError: true, durationMs: Date.now() - start };
    }
  }

  // 2. Custom tool with executorConfig from workspace SKILL.md (IndexedDB)
  if (toolDef?.executorConfig) {
    const start = Date.now();
    try {
      const result = await dispatchExecutorConfig(toolDef.executorConfig, args, signal);
      return { toolCallId: '', name: toolName, result, isError: false, durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { toolCallId: '', name: toolName, result: e instanceof Error ? e.message : String(e), isError: true, durationMs: Date.now() - start };
    }
  }

  return { toolCallId: '', name: toolName, result: `Unknown tool: ${toolName}`, isError: true };
}
