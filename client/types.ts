
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export type MembershipTier = 'free' | 'plus' | 'pro';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  nickname?: string;
  avatar?: string;
  membershipTier?: MembershipTier;
}


// ── Agent / Tool types ──────────────────────────────────────────────────────

export interface ToolParameterSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, ToolParameterSchema>;
  items?: ToolParameterSchema;
  required?: string[];
  description?: string;
  enum?: (string | number)[];
}

// Custom tool execution strategy (defined before ToolDefinition so it can be referenced)
export type CustomToolExecutorType = 'http' | 'javascript';

export interface HttpExecutorConfig {
  type: 'http';
  url: string;           // URL template, e.g. "https://api.example.com/{{query}}"
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  bodyTemplate?: string; // JSON template string with {{param}} placeholders
}

export interface JavaScriptExecutorConfig {
  type: 'javascript';
  code: string;          // JS code with access to `args` object, must return a value
}

export type CustomToolExecutorConfig = HttpExecutorConfig | JavaScriptExecutorConfig;

export interface ToolDefinition {
  name: string;           // snake_case, e.g. "web_search"
  description: string;
  parameters: ToolParameterSchema;
  skillId: string;
  isBuiltin: boolean;     // false for MCP-sourced or custom tools
  executorType?: 'builtin' | 'javascript' | 'http'; // how to execute the tool
  executorConfig?: CustomToolExecutorConfig;         // config for non-builtin tools
}

export interface ToolCall {
  id: string;             // "call_xxx" (OpenAI) or synthetic UUID (Gemini)
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  isError: boolean;
  durationMs?: number;
}

export type BuiltinSkillId = 'web' | 'code' | 'productivity';

export interface SkillDefinition {
  id: BuiltinSkillId | string;
  name: string;
  description: string;
  icon: string;           // lucide icon name
  tools: ToolDefinition[];
  isBuiltin: boolean;
  instructions?: string;  // markdown body injected into agent system prompt
  isWorkspace?: boolean;  // true for the workspace skill (always auto-injected)
}

export interface CustomToolDefinition extends ToolDefinition {
  executor: CustomToolExecutorConfig;
}

export interface CustomSkillDefinition extends SkillDefinition {
  isBuiltin: false;
  tools: CustomToolDefinition[];
  createdAt: number;
  updatedAt: number;
}

export interface McpServerConfig {
  id: string;
  name: string;
  url: string;            // HTTP/SSE endpoint URL
  enabled: boolean;
  status: 'connected' | 'connecting' | 'error' | 'disconnected';
  errorMessage?: string;
  discoveredTools?: ToolDefinition[];
  lastConnectedAt?: number;
}

export interface AgentConfig {
  systemPrompt?: string;
  enabledSkillIds: string[];
  mcpServers: McpServerConfig[];
  maxIterations: number;  // default 10
}

export interface AgentDefaults {
  systemPrompt: string;
  maxIterations: number;
  enabledSkillIds: string[];
  mcpServers: McpServerConfig[];
}

export interface AgentStatusEvent {
  type: 'tool_call_start' | 'tool_call_end' | 'iteration_start' | 'iteration_end' | 'stream_chunk';
  iteration: number;
  toolName?: string;
  toolCallId?: string;
  chunk?: string;
  reasoning?: string;
}

// ── Chat types ───────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system' | 'tool';
  content: string;
  timestamp: number;
  modelId?: string; // Model ID used when this message was sent
  imageUrl?: string; // For GENERATED images by the bot
  attachments?: Attachment[]; // For USER UPLOADED images
  reasoning?: string; // For deep thinking process
  isError?: boolean;
  editMode?: 'edit' | 'img2img' | 'generate'; // Image generation mode
  sourceImageUrl?: string; // Original image URL for editing
  // Agent fields
  toolCalls?: ToolCall[];       // present on model messages that invoked tools
  toolResults?: ToolResult[];   // present on role==='tool' messages
  iterationIndex?: number;      // which agentic loop iteration produced this message
}

export interface ChatSession {
  id: string;
  title: string;
  modelId: string;
  messages: Message[];
  updatedAt: number;
  emoji?: string; // Emoji icon for the chat
  archived?: boolean; // Whether the chat is archived
  agentConfig?: AgentConfig; // Optional per-session agent configuration
}

export interface AIModel {
  id: string;
  name: string;
  provider: 'gemini' | 'external';
  description: string;
  icon: string; // lucide icon name
  avatar?: string; // Base64 encoded image data or preset avatar name
  requiresCustomKey?: boolean;
  apiModelId?: string; // The ID sent to the API (e.g., 'gpt-4o')
  defaultBaseUrl?: string; // Default API endpoint
  configKey?: string; // Used to group models under one API key (e.g. 'openai', 'google')
  isCustom?: boolean; // Flag to identify user-added models
  isGlobal?: boolean; // Flag to identify admin-managed global models
  supportsFileUpload?: boolean; // Whether the model supports direct file/image upload via API
  supportedFileTypes?: string[]; // MIME types supported for upload (e.g., ['image/*', 'application/pdf'])
}

export type ThemePreset = 'default' | 'notion' | 'monet' | 'apple' | 'forsion1' | 'qbird';
export type Locale = 'en' | 'zh';

export interface AppSettings {
  nickname?: string;
  avatar?: string;
  theme?: 'light' | 'dark';
  themePreset?: ThemePreset;
  locale?: Locale;
  customModels?: AIModel[];
  defaultModelId?: string;
  developerMode?: boolean;
  agentDefaults?: AgentDefaults;
  externalApiConfigs: {
    [key: string]: {
      apiKey: string;
      baseUrl?: string;
    };
  };
}

export interface Attachment {
  type: 'image' | 'document';
  url: string; // data URL (in-memory, stripped on localStorage persist)
  workspacePath?: string; // workspace path for IndexedDB persistence
  mimeType: string;
  name?: string;
  extractedText?: string;
}

// ── Workspace types ──────────────────────────────────────────────────────────

export interface WorkspaceFile {
  sessionId: string;
  path: string;
  content: ArrayBuffer;
  mimeType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceFileMetadata {
  path: string;
  mimeType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

export interface PythonExecutionResult {
  stdout: string;
  stderr: string;
  generatedFiles: Array<{ path: string; content: ArrayBuffer; mimeType: string }>;
  durationMs: number;
}

export type PyodideWorkerRequest =
  | { type: 'init' }
  | { type: 'execute'; id: string; code: string; files: Array<{ path: string; content: ArrayBuffer }> };

export type PyodideWorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; id: string; stdout: string; stderr: string; generatedFiles: Array<{ path: string; content: ArrayBuffer; mimeType: string }>; durationMs: number }
  | { type: 'error'; id: string; error: string };