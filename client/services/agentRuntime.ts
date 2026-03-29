/**
 * Core agentic loop.
 * Manages the model → tool call → tool result → model cycle.
 * No React dependencies — pure async function.
 */
import {
  Message,
  AIModel,
  AgentConfig,
  AppSettings,
  Attachment,
  AgentStatusEvent,
  ToolCall,
  ToolResult,
  ToolDefinition,
} from '../types';
import { getToolsForSkills, getWorkspaceToolDefinitions, getSkillInstructions } from './skillsRegistry';
import { listWorkspaceSkills } from './agentWorkspace';
import type { SkillDefinition } from '../types';
import { getMcpToolsForServers, mcpClientRegistry } from './mcpClient';
import { executeBuiltinTool, TOOL_EXECUTORS, ToolExecutorFn, createWorkspaceToolExecutors } from './builtinTools';
import { generateGeminiResponseStream } from './geminiService';
import { generateExternalResponseStream } from './externalApiService';
import { backendService } from './backendService';
import {
  buildOpenAIToolConfig,
  buildGeminiToolResultParts,
  buildOpenAIToolResultMessages,
} from './toolCallNormalizer';

export interface AgentRunInput {
  sessionId: string;
  userMessage: string;
  attachments: Attachment[];
  /** All prior messages in the session (excluding the empty bot placeholder) */
  history: Message[];
  model: AIModel;
  agentConfig: AgentConfig;
  appSettings: AppSettings | null;
  enableThinking: boolean;
  signal?: AbortSignal;
  onStatusUpdate: (event: AgentStatusEvent) => void;
  /** Called each time a text chunk arrives during LLM streaming */
  onStreamChunk: (content: string, reasoning?: string) => void;
  /** Called after each iteration to progressively insert tool messages into the UI */
  onToolMessages?: (msgs: Message[]) => void;
}

export interface AgentRunOutput {
  finalContent: string;
  reasoning?: string;
  /** Intermediate tool-call and tool-result messages to insert into the session */
  toolMessages: Message[];
  usage?: { prompt_tokens: number; completion_tokens: number };
  iterationsUsed: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildToolCallMessage(
  toolCalls: ToolCall[],
  partialContent: string,
  modelId: string,
  iteration: number,
  reasoning?: string
): Message {
  return {
    id: makeId(),
    role: 'model',
    content: partialContent,
    timestamp: Date.now(),
    modelId,
    toolCalls,
    iterationIndex: iteration,
    reasoning,
  };
}

function buildToolResultMessage(results: ToolResult[], iteration: number): Message {
  return {
    id: makeId(),
    role: 'tool',
    content: results
      .map((r) => `[${r.name}] ${r.isError ? 'Error: ' : ''}${JSON.stringify(r.result)}`)
      .join('\n'),
    timestamp: Date.now(),
    toolResults: results,
    iterationIndex: iteration,
  };
}

/** Detect a degenerate loop: same tool + same args returned an error 3+ times */
function isDegenerate(history: Array<{ name: string; args: unknown; isError: boolean }>): boolean {
  if (history.length < 3) return false;
  const last3 = history.slice(-3);
  return (
    last3.every((h) => h.isError) &&
    last3.every((h) => h.name === last3[0].name) &&
    last3.every((h) => JSON.stringify(h.args) === JSON.stringify(last3[0].args))
  );
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeOneTool(
  call: ToolCall,
  agentConfig: AgentConfig,
  workspaceExecutors: Record<string, ToolExecutorFn>,
  allTools: ToolDefinition[],
  signal?: AbortSignal
): Promise<ToolResult> {
  // Resolve the ToolDefinition for this call (needed for executorConfig on custom tools)
  const toolDef = allTools.find((t) => t.name === call.name);

  // 1. Built-in tools (hardcoded executors)
  if (TOOL_EXECUTORS[call.name]) {
    const result = await executeBuiltinTool(call.name, call.arguments, signal, toolDef);
    return { ...result, toolCallId: call.id };
  }

  // 2. Workspace tools (session-scoped: read_file, write_file, run_python, etc.)
  if (workspaceExecutors[call.name]) {
    const start = Date.now();
    try {
      const result = await workspaceExecutors[call.name](call.arguments, signal);
      return { toolCallId: call.id, name: call.name, result, isError: false, durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { toolCallId: call.id, name: call.name, result: e instanceof Error ? e.message : String(e), isError: true, durationMs: Date.now() - start };
    }
  }

  // 3. Custom tools with executorConfig (from workspace SKILL.md)
  if (toolDef?.executorConfig) {
    const result = await executeBuiltinTool(call.name, call.arguments, signal, toolDef);
    return { ...result, toolCallId: call.id };
  }

  // 4. MCP tools — find the server that owns this tool
  const allMcpTools = getMcpToolsForServers(agentConfig.mcpServers);
  const mcpTool = allMcpTools.find((t) => t.name === call.name);
  if (mcpTool) {
    const serverId = mcpTool.skillId.replace('mcp:', '');
    const client = mcpClientRegistry.get(serverId);
    if (client && client.getStatus() === 'connected') {
      const result = await client.callTool(call.name, call.arguments, signal);
      return { ...result, toolCallId: call.id };
    }
  }

  return {
    toolCallId: call.id,
    name: call.name,
    result: `Tool "${call.name}" is not available.`,
    isError: true,
  };
}

async function executeToolCallsBatch(
  calls: ToolCall[],
  agentConfig: AgentConfig,
  workspaceExecutors: Record<string, ToolExecutorFn>,
  allTools: ToolDefinition[],
  signal?: AbortSignal
): Promise<ToolResult[]> {
  const settled = await Promise.allSettled(
    calls.map((call) => executeOneTool(call, agentConfig, workspaceExecutors, allTools, signal))
  );
  return settled.map((outcome, i) => {
    if (outcome.status === 'fulfilled') return outcome.value;
    return {
      toolCallId: calls[i].id,
      name: calls[i].name,
      result: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      isError: true,
    };
  });
}

// ── History conversion helpers ────────────────────────────────────────────────

/** Convert session Message[] to Gemini content array */
function toGeminiHistory(messages: Message[]) {
  const contents: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }> = [];

  for (const m of messages) {
    if (m.role === 'system') continue; // Gemini handles system via systemInstruction

    if (m.role === 'tool' && m.toolResults) {
      // Tool results are re-injected as user parts with functionResponse
      const parts = m.toolResults.map((r) => ({
        functionResponse: {
          name: r.name,
          response: {
            content: r.isError ? `Error: ${String(r.result)}` : JSON.stringify(r.result),
          },
        },
      }));
      contents.push({ role: 'user', parts });
      continue;
    }

    if (m.role === 'model' && m.toolCalls) {
      const parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> =
        m.toolCalls.map((tc) => ({
          functionCall: { name: tc.name, args: tc.arguments },
        }));
      if (m.content) parts.unshift({ text: m.content });
      contents.push({ role: 'model', parts });
      continue;
    }

    const role = m.role === 'user' ? 'user' : 'model';
    contents.push({ role, parts: [{ text: m.content }] });
  }

  return contents;
}

/** Convert session Message[] to OpenAI-compatible messages array */
function toOpenAIHistory(messages: Message[], enableThinking: boolean = false) {
  const result: Array<Record<string, unknown>> = [];

  for (const m of messages) {
    if (m.role === 'tool' && m.toolResults) {
      for (const r of m.toolResults) {
        result.push({
          role: 'tool',
          tool_call_id: r.toolCallId,
          content: r.isError ? `Error: ${String(r.result)}` : JSON.stringify(r.result),
        });
      }
      continue;
    }

    if (m.role === 'model' && m.toolCalls) {
      const msg: Record<string, unknown> = {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
      // Kimi/Moonshot requires reasoning_content on all assistant messages when thinking is enabled
      if (enableThinking) {
        msg.reasoning_content = m.reasoning || '';
      }
      result.push(msg);
      continue;
    }

    const role = m.role === 'user' ? 'user' : m.role === 'model' ? 'assistant' : m.role;
    const msg: Record<string, unknown> = { role, content: m.content };
    if (enableThinking && role === 'assistant' && m.reasoning) {
      msg.reasoning_content = m.reasoning;
    }
    result.push(msg);
  }

  return result;
}

// ── Main agentic loop ─────────────────────────────────────────────────────────

export async function runAgentLoop(input: AgentRunInput): Promise<AgentRunOutput> {
  const { model, agentConfig, appSettings, signal, onStatusUpdate, onStreamChunk, onToolMessages } = input;

  // Load workspace-scoped custom skills for this session
  let workspaceSkills: SkillDefinition[] = [];
  try {
    workspaceSkills = await listWorkspaceSkills(input.sessionId);
  } catch (e) {
    console.warn('[agentRuntime] Could not load workspace skills:', e);
  }

  // Build the full tool list for this session
  const tools: ToolDefinition[] = [
    ...getWorkspaceToolDefinitions(),  // workspace tools always available in agent mode
    ...getToolsForSkills(agentConfig.enabledSkillIds, workspaceSkills),
    ...getMcpToolsForServers(agentConfig.mcpServers),
  ];

  // Session-scoped workspace executors
  const workspaceExecutors = createWorkspaceToolExecutors(input.sessionId);

  // Working message history (mutable during the loop)
  const workingHistory: Message[] = [...input.history];

  // Build system prompt: user-supplied + skill instructions
  const skillInstructions = getSkillInstructions(agentConfig.enabledSkillIds, workspaceSkills);
  const systemParts: string[] = [];
  if (agentConfig.systemPrompt?.trim()) {
    systemParts.push(agentConfig.systemPrompt.trim());
  }
  if (skillInstructions) {
    systemParts.push('## Skill Instructions\n\n' + skillInstructions);
  }

  if (systemParts.length > 0) {
    workingHistory.unshift({
      id: 'system_prompt',
      role: 'system',
      content: systemParts.join('\n\n'),
      timestamp: 0,
    });
  }

  const toolMessages: Message[] = [];
  let finalContent = '';
  let finalReasoning: string | undefined;
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  const toolErrorHistory: Array<{ name: string; args: unknown; isError: boolean }> = [];

  const isGemini = model.provider === 'gemini' && !(model as any).isGlobal;
  const isGlobal = !!(model as any).isGlobal;

  for (let iteration = 0; iteration < agentConfig.maxIterations; iteration++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    onStatusUpdate({ type: 'iteration_start', iteration });

    // ── Call model ──────────────────────────────────────────────────────────

    let modelContent = '';
    let modelReasoning: string | undefined;
    let modelToolCalls: ToolCall[] | undefined;
    let iterUsage: { prompt_tokens: number; completion_tokens: number } | undefined;

    if (isGlobal) {
      const openAIHistory = toOpenAIHistory(workingHistory, input.enableThinking) as { role: string; content: string }[];
      if (iteration === 0) {
        openAIHistory.push({ role: 'user', content: input.userMessage });
      }

      const openAITools = tools.length > 0 ? buildOpenAIToolConfig(tools) : undefined;

      const result = await backendService.proxyChatCompletions(
        model.id,
        openAIHistory,
        0.7,
        input.enableThinking,
        undefined,
        onStreamChunk,
        signal,
        iteration === 0 ? input.attachments : [],
        openAITools
      );

      modelContent = result.content;
      modelReasoning = result.reasoning;
      modelToolCalls = result.toolCalls;
      iterUsage = result.usage;

    } else if (isGemini) {
      const apiKey = appSettings?.externalApiConfigs?.['google']?.apiKey;
      const geminiHistory = toGeminiHistory(workingHistory);

      const result = await generateGeminiResponseStream(
        model.apiModelId ?? model.id,
        input.userMessage,
        geminiHistory as any,
        apiKey,
        iteration === 0 ? input.attachments : [],
        onStreamChunk,
        input.enableThinking,
        signal,
        tools.length > 0 ? tools : undefined
      );

      modelContent = result.text;
      modelReasoning = result.reasoning;
      modelToolCalls = result.toolCalls;
      iterUsage = result.usage;
    } else {
      // OpenAI-compatible (user-configured external models)
      const configKey = model.configKey ?? model.id;
      const apiConfig = appSettings?.externalApiConfigs?.[configKey];
      if (!apiConfig?.apiKey) {
        throw new Error(`No API key configured for model "${model.name}"`);
      }

      const openAIHistory = toOpenAIHistory(workingHistory, input.enableThinking) as { role: string; content: string }[];
      if (iteration === 0) {
        openAIHistory.push({ role: 'user', content: input.userMessage });
      }

      const result = await generateExternalResponseStream(
        apiConfig,
        model.apiModelId ?? model.id,
        openAIHistory,
        model.defaultBaseUrl,
        iteration === 0 ? input.attachments : [],
        onStreamChunk,
        input.enableThinking,
        signal,
        tools.length > 0 ? tools : undefined
      );

      modelContent = result.content;
      modelReasoning = result.reasoning;
      modelToolCalls = result.toolCalls;
      iterUsage = result.usage;
    }

    if (iterUsage) {
      totalUsage.prompt_tokens += iterUsage.prompt_tokens;
      totalUsage.completion_tokens += iterUsage.completion_tokens;
    }

    // ── No tool calls → done ───────────────────────────────────────────────

    if (!modelToolCalls || modelToolCalls.length === 0) {
      finalContent = modelContent;
      finalReasoning = modelReasoning;
      onStatusUpdate({ type: 'iteration_end', iteration });
      break;
    }

    // ── Model wants to call tools ─────────────────────────────────────────

    const toolCallMsg = buildToolCallMessage(modelToolCalls, modelContent, model.id, iteration, modelReasoning);
    toolMessages.push(toolCallMsg);
    workingHistory.push(toolCallMsg);

    for (const tc of modelToolCalls) {
      onStatusUpdate({ type: 'tool_call_start', iteration, toolName: tc.name, toolCallId: tc.id });
    }

    const results = await executeToolCallsBatch(modelToolCalls, agentConfig, workspaceExecutors, tools, signal);

    for (const r of results) {
      onStatusUpdate({ type: 'tool_call_end', iteration, toolName: r.name, toolCallId: r.toolCallId });
      toolErrorHistory.push({ name: r.name, args: modelToolCalls.find((tc) => tc.id === r.toolCallId)?.arguments, isError: r.isError });
    }

    const resultMsg = buildToolResultMessage(results, iteration);
    toolMessages.push(resultMsg);
    workingHistory.push(resultMsg);

    // Emit tool messages progressively so the UI shows each iteration live
    onToolMessages?.([toolCallMsg, resultMsg]);

    // Degenerate loop detection
    if (isDegenerate(toolErrorHistory)) {
      finalContent = '[Agent stopped: repeated tool failures detected. Please try rephrasing your request.]';
      onStatusUpdate({ type: 'iteration_end', iteration });
      break;
    }

    onStatusUpdate({ type: 'iteration_end', iteration });

    // On subsequent iterations, inject tool results into history (Gemini needs functionResponse parts)
    if (isGemini) {
      // Gemini: the tool results are already in workingHistory as role==='tool' messages,
      // which toGeminiHistory() converts to functionResponse parts — no extra action needed.
    } else {
      // OpenAI: results are in workingHistory as role==='tool' messages — already handled by toOpenAIHistory()
    }

    // For subsequent iterations, clear userMessage (it's already in history)
    // The loop will call the model again with tool results in context
  }

  // If we exhausted max iterations without a final response
  if (!finalContent && toolMessages.length > 0) {
    finalContent = `[Agent reached maximum of ${agentConfig.maxIterations} iterations without a final answer.]`;
  }

  return {
    finalContent,
    reasoning: finalReasoning,
    toolMessages,
    usage: totalUsage.prompt_tokens > 0 ? totalUsage : undefined,
    iterationsUsed: toolMessages.length / 2, // each iteration = 1 call msg + 1 result msg
  };
}
