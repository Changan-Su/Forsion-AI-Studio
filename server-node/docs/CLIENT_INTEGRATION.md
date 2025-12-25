# 客户端集成指南

本指南介绍如何将前端项目集成到 Forsion Backend Service 统一后端。

## 概述

Forsion Backend Service 提供标准化的 RESTful API，支持多个前端项目共享同一个后端服务。集成步骤简单，只需配置 API 地址和添加项目标识即可。

## 快速开始

### 1. 安装依赖

前端项目需要 HTTP 客户端库（推荐使用 axios）：

```bash
npm install axios
```

### 2. 配置环境变量

在前端项目根目录创建 `.env.local` 文件：

```env
# API 服务地址
VITE_API_URL=http://localhost:3001

# 项目标识（ai-studio, desktop, calendar 等）
VITE_PROJECT_SOURCE=ai-studio
```

### 3. 创建 API 服务文件

在 `src/services/backendService.ts` 创建统一的 API 服务：

```typescript
import axios, { AxiosInstance } from 'axios';

// 读取环境变量
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PROJECT_SOURCE = import.meta.env.VITE_PROJECT_SOURCE || 'ai-studio';

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Project-Source': PROJECT_SOURCE, // 项目来源标识
  },
});

// 请求拦截器：添加认证 Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期，清除本地存储并跳转登录
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

## 具体集成示例

### Forsion AI Studio 集成

AI Studio 已经有后端服务配置，只需确保以下配置正确：

#### 1. 环境变量 (`.env.local`)

```env
VITE_API_URL=http://localhost:3001
VITE_PROJECT_SOURCE=ai-studio
```

#### 2. 更新现有的 backendService

如果已有 `client/services/backendService.ts`，确保包含项目来源标识：

```typescript
// client/services/backendService.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'X-Project-Source': 'ai-studio', // 添加这一行
  },
});

// ... 其他配置
```

#### 3. 使用示例

```typescript
import apiClient from './services/backendService';

// 登录
export async function login(username: string, password: string) {
  const response = await apiClient.post('/api/auth/login', {
    username,
    password,
  });
  return response.data;
}

// 获取模型列表
export async function getModels() {
  const response = await apiClient.get('/api/models');
  return response.data;
}

// 发送聊天消息
export async function sendChatMessage(modelId: string, messages: any[]) {
  const response = await apiClient.post('/api/chat/completions', {
    model_id: modelId,
    messages,
    stream: true,
  });
  return response.data;
}
```

---

### Forsion Desktop 集成

Desktop 项目需要从零开始集成统一后端。

#### 1. 项目结构

```
Forsion-Desktop/
├── src/
│   ├── services/
│   │   ├── api.ts          # API 客户端配置
│   │   ├── authService.ts  # 认证服务
│   │   ├── chatService.ts  # 对话服务
│   │   └── modelService.ts # 模型服务
│   └── ...
├── .env.local              # 环境变量
└── package.json
```

#### 2. 创建 API 客户端 (`src/services/api.ts`)

```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Project-Source': 'desktop', // Desktop 项目标识
  },
});

// 请求拦截器
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('desktop_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('desktop_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

#### 3. 认证服务 (`src/services/authService.ts`)

```typescript
import { apiClient } from './api';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  inviteCode: string;
}

export const authService = {
  async login(data: LoginRequest) {
    const response = await apiClient.post('/api/auth/login', data);
    const { token, user } = response.data;
    
    // 保存到本地存储
    localStorage.setItem('desktop_token', token);
    localStorage.setItem('desktop_user', JSON.stringify(user));
    
    return { token, user };
  },

  async register(data: RegisterRequest) {
    const response = await apiClient.post('/api/auth/register', data);
    return response.data;
  },

  async getCurrentUser() {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },

  logout() {
    localStorage.removeItem('desktop_token');
    localStorage.removeItem('desktop_user');
  },
};
```

#### 4. 对话服务 (`src/services/chatService.ts`)

```typescript
import { apiClient } from './api';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  model_id: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export const chatService = {
  // 非流式对话
  async sendMessage(request: ChatRequest) {
    const response = await apiClient.post('/api/chat/completions', {
      ...request,
      stream: false,
    });
    return response.data;
  },

  // 流式对话（SSE）
  async streamMessage(
    request: ChatRequest,
    onChunk: (content: string) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ) {
    try {
      const response = await fetch(`${apiClient.defaults.baseURL}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('desktop_token')}`,
          'X-Project-Source': 'desktop',
        },
        body: JSON.stringify({
          ...request,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

      onComplete();
    } catch (error) {
      onError(error);
    }
  },
};
```

#### 5. 模型服务 (`src/services/modelService.ts`)

```typescript
import { apiClient } from './api';

export const modelService = {
  async getModels() {
    const response = await apiClient.get('/api/models');
    return response.data;
  },

  async getModelById(id: string) {
    const response = await apiClient.get(`/api/models/${id}`);
    return response.data;
  },
};
```

#### 6. 积分服务 (`src/services/creditService.ts`)

```typescript
import { apiClient } from './api';

export const creditService = {
  async getBalance() {
    const response = await apiClient.get('/api/credits/balance');
    return response.data;
  },

  async getTransactions(limit = 20, offset = 0) {
    const response = await apiClient.get('/api/credits/transactions', {
      params: { limit, offset },
    });
    return response.data;
  },

  async getPricing() {
    const response = await apiClient.get('/api/credits/pricing');
    return response.data;
  },
};
```

---

### Forsion Calendar 集成（可选）

Forsion Calendar 默认使用独立的轻量级后端，但如果需要用户认证和积分系统，可以选择集成统一后端。

#### 1. 环境变量

```env
VITE_API_URL=http://localhost:3001
VITE_PROJECT_SOURCE=calendar
VITE_USE_UNIFIED_BACKEND=true
```

#### 2. 条件使用统一后端

```typescript
const USE_UNIFIED_BACKEND = import.meta.env.VITE_USE_UNIFIED_BACKEND === 'true';

if (USE_UNIFIED_BACKEND) {
  // 使用统一后端的认证和积分功能
  import { authService } from './services/authService';
  // ...
} else {
  // 使用 Calendar 自己的轻量级后端
  // ...
}
```

---

## 常见场景

### 处理 Token 刷新

```typescript
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // 这里可以实现 Token 刷新逻辑
        // 目前后端不支持 refresh token，需要重新登录
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(error);
      } catch (err) {
        processQueue(err, null);
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

### 处理文件上传

```typescript
export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/api/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}
```

### 处理积分不足

```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 402) {
      // 积分不足，显示充值提示
      alert('积分不足，请充值！');
      window.location.href = '/credits';
    }
    return Promise.reject(error);
  }
);
```

---

## TypeScript 类型定义

### 用户相关类型

```typescript
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'active' | 'inactive';
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
```

### 模型相关类型

```typescript
export interface Model {
  id: string;
  name: string;
  provider: string;
  description?: string;
  icon?: string;
  isEnabled: boolean;
  apiModelId?: string;
  defaultBaseUrl?: string;
}
```

### 聊天相关类型

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  model_id: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  attachments?: Attachment[];
}

export interface Attachment {
  type: 'image' | 'file';
  url: string;
  mimeType?: string;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### 积分相关类型

```typescript
export interface CreditBalance {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  type: 'initial' | 'usage' | 'refund' | 'bonus' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}
```

---

## 测试建议

### 单元测试

```typescript
import { describe, it, expect, vi } from 'vitest';
import { authService } from './services/authService';

describe('authService', () => {
  it('should login successfully', async () => {
    const mockResponse = {
      token: 'test-token',
      user: { id: '1', username: 'test' },
    };

    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: mockResponse });

    const result = await authService.login('test', 'password');
    expect(result).toEqual(mockResponse);
  });
});
```

### E2E 测试

```typescript
import { test, expect } from '@playwright/test';

test('should login and access models', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // 登录
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'Admin123!@#');
  await page.click('button[type="submit"]');
  
  // 等待跳转
  await page.waitForURL('http://localhost:3000/chat');
  
  // 检查模型列表
  await expect(page.locator('.model-list')).toBeVisible();
});
```

---

## 故障排查

### CORS 错误

如果遇到 CORS 错误，确保后端 `.env` 文件中配置了正确的 `ALLOWED_ORIGINS`：

```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:6006
```

### 401 Unauthorized

- 检查 Token 是否正确存储在 localStorage
- 检查 Token 是否过期
- 检查请求头是否正确添加 `Authorization: Bearer TOKEN`

### 502 Bad Gateway

- 检查后端服务是否正常运行
- 检查 `VITE_API_URL` 配置是否正确
- 检查网络连接

---

## 性能优化建议

### 1. 请求缓存

```typescript
import { useQuery } from '@tanstack/react-query';

export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: () => modelService.getModels(),
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });
}
```

### 2. 请求防抖

```typescript
import { debounce } from 'lodash';

const debouncedSearch = debounce(async (query: string) => {
  const results = await apiClient.get('/api/search', { params: { q: query } });
  return results.data;
}, 300);
```

### 3. 请求合并

```typescript
import { batch } from 'react-redux';

async function loadUserData() {
  const [user, credits, models] = await Promise.all([
    authService.getCurrentUser(),
    creditService.getBalance(),
    modelService.getModels(),
  ]);

  batch(() => {
    dispatch(setUser(user));
    dispatch(setCredits(credits));
    dispatch(setModels(models));
  });
}
```

---

## 更多资源

- [完整 API 文档](API.md)
- [部署指南](../DEPLOYMENT.md)
- [后端服务 README](../README.md)

## 获取帮助

如有问题，请：

1. 查看 [API 文档](API.md)
2. 查看 [常见问题](../README.md#故障排查)
3. 提交 Issue 到 GitHub


