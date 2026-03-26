/**
 * Normalizes tool calling between Gemini and OpenAI-compatible API formats.
 * All functions here are pure transformations — no side effects.
 */
import { ToolDefinition, ToolCall, ToolResult } from '../types';

// ── To-model: build tool configs ─────────────────────────────────────────────

/** Build the tools param accepted by @google/genai */
export function buildGeminiToolConfig(tools: ToolDefinition[]) {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

/** Build the tools array accepted by OpenAI-compatible APIs */
export function buildOpenAIToolConfig(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// ── From-model: extract tool calls ──────────────────────────────────────────

/**
 * Extract tool calls from a completed Gemini response.
 * The response parts may contain functionCall entries.
 */
export function extractToolCallsFromGeminiParts(
  parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>
): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const part of parts) {
    if (part.functionCall) {
      calls.push({
        id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args ?? {},
      });
    }
  }
  return calls;
}

/**
 * Accumulate OpenAI tool call fragments that arrive across multiple SSE chunks.
 *
 * OpenAI streams tool call arguments in pieces:
 *   chunk 1: [{index:0, id:"call_abc", type:"function", function:{name:"web_search", arguments:""}}]
 *   chunk 2: [{index:0, function:{arguments:'{"quer'}}]
 *   chunk 3: [{index:0, function:{arguments:'y":"foo"}'}}]
 *
 * This function takes the accumulated array and returns normalized ToolCall[].
 */
export function accumulateOpenAIToolCallChunks(
  chunks: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>
): ToolCall[] {
  // Merge fragments by index
  const byIndex: Record<
    number,
    { id: string; name: string; argumentsStr: string }
  > = {};

  for (const chunk of chunks) {
    if (!byIndex[chunk.index]) {
      byIndex[chunk.index] = { id: chunk.id ?? '', name: '', argumentsStr: '' };
    }
    const entry = byIndex[chunk.index];
    if (chunk.id) entry.id = chunk.id;
    if (chunk.function?.name) entry.name += chunk.function.name;
    if (chunk.function?.arguments) entry.argumentsStr += chunk.function.arguments;
  }

  return Object.values(byIndex).map((entry) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(entry.argumentsStr || '{}');
    } catch {
      args = { _raw: entry.argumentsStr };
    }
    return { id: entry.id, name: entry.name, arguments: args };
  });
}

// ── Re-input: feed tool results back to the model ────────────────────────────

/** Build Gemini parts for tool results (sent as a 'user' role content block) */
export function buildGeminiToolResultParts(results: ToolResult[]) {
  return results.map((r) => ({
    functionResponse: {
      name: r.name,
      response: {
        content: r.isError
          ? `Error: ${String(r.result)}`
          : JSON.stringify(r.result),
      },
    },
  }));
}

/** Build OpenAI-compatible tool result messages */
export function buildOpenAIToolResultMessages(results: ToolResult[]) {
  return results.map((r) => ({
    role: 'tool' as const,
    tool_call_id: r.toolCallId,
    content: r.isError
      ? `Error: ${String(r.result)}`
      : typeof r.result === 'string'
        ? r.result
        : JSON.stringify(r.result),
  }));
}
