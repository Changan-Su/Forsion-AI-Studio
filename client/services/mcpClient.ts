/**
 * MCP (Model Context Protocol) client using HTTP/SSE transport.
 * This is the only transport that works in the browser without a relay.
 *
 * Protocol flow:
 *   1. Open EventSource to the server URL (SSE stream)
 *   2. Server emits an "endpoint" event containing the POST URL for requests
 *   3. Send JSON-RPC 2.0 requests via POST to that URL
 *   4. Receive responses via "message" events on the SSE stream (matched by id)
 */
import { McpServerConfig, ToolDefinition, ToolResult, ToolParameterSchema } from '../types';

const CONNECT_TIMEOUT_MS = 5000;
const CALL_TIMEOUT_MS = 15000;

type JsonRpcId = number | string;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

function normalizeMcpSchema(schema: McpToolSchema['inputSchema']): ToolParameterSchema {
  return {
    type: 'object',
    properties: (schema?.properties ?? {}) as Record<string, ToolParameterSchema>,
    required: schema?.required ?? [],
  };
}

export class McpClient {
  private es: EventSource | null = null;
  private postUrl: string | null = null;
  private pending = new Map<JsonRpcId, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  private nextId = 1;
  private _status: McpServerConfig['status'] = 'disconnected';
  private _errorMessage: string | undefined;

  constructor(private config: McpServerConfig) {}

  getStatus(): McpServerConfig['status'] {
    return this._status;
  }

  getErrorMessage(): string | undefined {
    return this._errorMessage;
  }

  async connect(): Promise<void> {
    if (this._status === 'connected') return;
    this._status = 'connecting';
    this._errorMessage = undefined;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.es?.close();
        this._status = 'error';
        this._errorMessage = 'Connection timed out';
        reject(new Error('MCP connect timeout'));
      }, CONNECT_TIMEOUT_MS);

      this.es = new EventSource(this.config.url);

      this.es.addEventListener('endpoint', (e: MessageEvent) => {
        clearTimeout(timer);
        this.postUrl = e.data.trim();
        this._status = 'connected';
        resolve();
      });

      this.es.addEventListener('message', (e: MessageEvent) => {
        try {
          const msg: JsonRpcResponse = JSON.parse(e.data);
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            if (msg.error) {
              handler.reject(new Error(msg.error.message));
            } else {
              handler.resolve(msg.result);
            }
          }
        } catch {
          // ignore malformed messages
        }
      });

      this.es.onerror = () => {
        clearTimeout(timer);
        this._status = 'error';
        this._errorMessage = 'SSE connection error';
        // Reject any pending calls
        for (const h of this.pending.values()) {
          h.reject(new Error('SSE connection lost'));
        }
        this.pending.clear();
        reject(new Error('SSE connection error'));
      };
    });

    // Send initialize handshake
    await this._rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'forsion-ai-studio', version: '1.0' },
    });
  }

  async listTools(): Promise<ToolDefinition[]> {
    const result = (await this._rpc('tools/list', {})) as { tools: McpToolSchema[] };
    return (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description ?? '',
      parameters: normalizeMcpSchema(t.inputSchema),
      skillId: `mcp:${this.config.id}`,
      isBuiltin: false,
    }));
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const start = Date.now();
    try {
      const result = (await Promise.race([
        this._rpc('tools/call', { name, arguments: args }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tool call timed out')), CALL_TIMEOUT_MS)
        ),
        ...(signal
          ? [
              new Promise<never>((_, reject) => {
                signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
              }),
            ]
          : []),
      ])) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

      const text = (result.content ?? [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('\n');

      return {
        toolCallId: '',
        name,
        result: text,
        isError: result.isError ?? false,
        durationMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return {
        toolCallId: '',
        name,
        result: e instanceof Error ? e.message : String(e),
        isError: true,
        durationMs: Date.now() - start,
      };
    }
  }

  disconnect(): void {
    this.es?.close();
    this.es = null;
    this.postUrl = null;
    this._status = 'disconnected';
    for (const h of this.pending.values()) {
      h.reject(new Error('Client disconnected'));
    }
    this.pending.clear();
  }

  private async _rpc(method: string, params: unknown): Promise<unknown> {
    if (!this.postUrl) throw new Error('MCP client not connected');
    const id = this.nextId++;
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      fetch(this.postUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      }).catch((e) => {
        this.pending.delete(id);
        reject(e);
      });
    });
  }
}

// ── Registry of active clients ────────────────────────────────────────────────

export const mcpClientRegistry = new Map<string, McpClient>();

export async function connectMcpServer(config: McpServerConfig): Promise<McpClient> {
  const existing = mcpClientRegistry.get(config.id);
  if (existing && existing.getStatus() === 'connected') return existing;
  existing?.disconnect();

  const client = new McpClient(config);
  mcpClientRegistry.set(config.id, client);
  await client.connect();
  return client;
}

export function disconnectMcpServer(serverId: string): void {
  const client = mcpClientRegistry.get(serverId);
  if (client) {
    client.disconnect();
    mcpClientRegistry.delete(serverId);
  }
}

/** Return all tools available from currently-connected MCP servers */
export function getMcpToolsForServers(serverConfigs: McpServerConfig[]): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  for (const cfg of serverConfigs) {
    if (!cfg.enabled) continue;
    const cached = cfg.discoveredTools;
    if (cached?.length) {
      tools.push(...cached);
    } else {
      const client = mcpClientRegistry.get(cfg.id);
      if (client && client.getStatus() === 'connected') {
        // Return empty for now; caller should call listTools() asynchronously
      }
    }
  }
  return tools;
}
