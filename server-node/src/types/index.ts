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
  promptCachingEnabled?: boolean; // Whether to enable prompt caching
  systemPrompt?: string; // System prompt for OpenAI automatic caching
  cacheableContent?: string; // Cacheable content for Claude/Gemini explicit caching
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

export interface InviteCode {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  initialCredits: number;
  createdBy?: string;
  expiresAt?: Date;
  isActive: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCredit {
  id: string;
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  type: 'initial' | 'usage' | 'refund' | 'bonus' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  referenceId?: string;
  createdAt?: Date;
}

export interface CreditPricing {
  id: string;
  modelId: string;
  provider?: string;
  tokensPerCredit: number;
  inputMultiplier: number;
  outputMultiplier: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}


