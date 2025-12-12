export interface User {
  id: string;
  username: string;
  password?: string;
  email?: string;
  role: 'USER' | 'ADMIN';
  status: 'active' | 'inactive' | 'suspended';
  permissions?: string;
  maxRequestsPerDay?: number;
  notes?: string;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserSettings {
  id: string;
  userId: string;
  theme: 'light' | 'dark';
  themePreset: string;
  customModels: string;
  externalApiConfigs: string;
  developerMode: boolean;
}

export interface GlobalModel {
  id: string;
  name: string;
  provider: 'gemini' | 'external';
  description?: string;
  icon: string;
  apiModelId?: string;
  configKey?: string;
  defaultBaseUrl?: string;
  apiKey?: string;
  isEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApiUsageLog {
  id: number;
  username: string;
  modelId: string;
  modelName?: string;
  provider?: string;
  tokensInput: number;
  tokensOutput: number;
  success: boolean;
  errorMessage?: string;
  createdAt?: Date;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionRequest {
  model_id: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

