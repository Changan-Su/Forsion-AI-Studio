
import { AIModel } from './types';

export const DEFAULT_API_KEY = 'sk-KPsu15QUUq3dbv7lDfBdD1F8Be144c5983E9B2Cb18523640';
export const DEFAULT_BASE_URL = 'https://api.vveai.com';

export const BUILTIN_MODELS: AIModel[] = [
  // --- Google Models ---
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini Flash',
    provider: 'gemini',
    description: 'Fast and versatile model for everyday tasks.',
    icon: 'Zap',
    configKey: 'google', 
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini Pro',
    provider: 'gemini',
    description: 'Advanced reasoning and complex tasks.',
    icon: 'Brain',
    configKey: 'google',
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana (Image)',
    provider: 'gemini',
    description: 'Generate and edit images.',
    icon: 'Image',
    configKey: 'google',
  },

  // --- OpenAI Models ---
  {
    id: 'gpt-5',
    name: 'GPT 5 (Preview)',
    provider: 'external',
    description: 'Next-gen reasoning model.',
    icon: 'Sparkles',
    requiresCustomKey: true,
    apiModelId: 'gpt-5',
    defaultBaseUrl: 'https://api.openai.com/v1',
    configKey: 'openai',
  },
  {
    id: 'chatgpt-4o',
    name: 'GPT-4o',
    provider: 'external',
    description: 'High-intelligence flagship model.',
    icon: 'MessageSquare',
    requiresCustomKey: true,
    apiModelId: 'gpt-4o',
    defaultBaseUrl: 'https://api.openai.com/v1',
    configKey: 'openai',
  },
  {
    id: 'chatgpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'external',
    description: 'Cost-efficient small model.',
    icon: 'Zap',
    requiresCustomKey: true,
    apiModelId: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    configKey: 'openai',
  },

  // --- Other Providers ---
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'external',
    description: 'DeepSeek chat model.',
    icon: 'Code',
    requiresCustomKey: true,
    apiModelId: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com',
    configKey: 'deepseek',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'external',
    description: 'Advanced reasoning model (CoT).',
    icon: 'BrainCircuit',
    requiresCustomKey: true,
    apiModelId: 'deepseek-reasoner',
    defaultBaseUrl: 'https://api.deepseek.com',
    configKey: 'deepseek',
  }
];

// Helper to get ALL models including custom ones
export const getAllModels = (customModels: AIModel[] = []) => {
  return [...BUILTIN_MODELS, ...customModels];
};

export const STORAGE_KEYS = {
  USERS: 'forsion_users',
  CURRENT_USER: 'forsion_current_user',
  SESSIONS: 'forsion_sessions',
  SETTINGS: 'forsion_settings',
};