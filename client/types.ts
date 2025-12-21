
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  nickname?: string;
  avatar?: string;
}


export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  modelId?: string; // Model ID used when this message was sent
  imageUrl?: string; // For GENERATED images by the bot
  attachments?: Attachment[]; // For USER UPLOADED images
  reasoning?: string; // For deep thinking process
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  modelId: string;
  messages: Message[];
  updatedAt: number;
  emoji?: string; // Emoji icon for the chat
  archived?: boolean; // Whether the chat is archived
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
}

export interface AppSettings {
  nickname?: string;
  avatar?: string;
  theme?: 'light' | 'dark';
  themePreset?: 'default' | 'notion' | 'monet'; // New: Theme Style
  customModels?: AIModel[]; // New: List of user-added models
  defaultModelId?: string;
  developerMode?: boolean; // Developer mode allows users to add custom models
  // Deprecated usage of simple key/value configs in favor of per-model full config for custom ones, 
  // but kept for backward compat with built-ins
  externalApiConfigs: {
    [key: string]: { // key is the configKey (e.g. 'openai')
      apiKey: string;
      baseUrl?: string;
    };
  };
}

export interface Attachment {
  type: 'image' | 'document';
  url: string; // Base64 data string
  mimeType: string;
  name?: string;
  extractedText?: string; // For document files (PDF, Word, etc.)
}