# Forsion 账号系统实现文档

版本：v1.0.0 | 最后更新：2025年12月

## 📋 目录

- [概述](#概述)
- [系统架构](#系统架构)
- [后端实现](#后端实现)
- [前端实现](#前端实现)
- [数据库设计](#数据库设计)
- [API 接口说明](#api-接口说明)
- [完整实现示例](#完整实现示例)
- [常见问题](#常见问题)

---

## 概述

本文档详细说明如何在 Forsion 项目中实现统一的账号系统，包括：

1. ✅ **账号登录**：JWT 认证机制
2. ✅ **头像昵称显示**：用户个性化信息展示
3. ✅ **积分扣除**：基于 Token 使用的动态计费
4. ✅ **左下角用户信息**：用户信息面板展示

### 适用场景

- 新的 Forsion 项目需要接入统一账号系统
- 需要实现跨项目的用户认证和数据共享
- 需要实现积分系统和用户信息展示

---

## 系统架构

### 架构图

```
┌─────────────────┐
│   前端应用      │
│  (React/Vue等)  │
└────────┬────────┘
         │ HTTP/HTTPS
         │ JWT Token
         ▼
┌─────────────────┐
│   后端服务      │
│  (Node.js)      │
│  - 认证服务     │
│  - 积分系统     │
│  - 用户管理     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MySQL 数据库  │
│  - users        │
│  - user_settings│
│  - user_credits │
│  - credit_      │
│    transactions │
└─────────────────┘
```

### 数据流

1. **登录流程**：前端 → 后端验证 → 返回 JWT Token → 前端存储
2. **用户信息**：前端请求 → 后端查询数据库 → 返回用户信息（含头像、昵称）
3. **积分扣除**：AI 对话请求 → 后端计算费用 → 扣除积分 → 记录交易
4. **信息展示**：前端定期刷新 → 获取最新余额 → 更新 UI

---

## 后端实现

### 1. 环境配置

#### 必需依赖

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "mysql2": "^3.6.5",
    "uuid": "^9.0.0"
  }
}
```

#### 环境变量

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=forsion_shared_db

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# 服务配置
PORT=3001
NODE_ENV=production
```

### 2. 数据库表结构

#### users 表

```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  role ENUM('ADMIN', 'USER') DEFAULT 'USER',
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### user_settings 表

```sql
CREATE TABLE user_settings (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  nickname VARCHAR(100),
  avatar MEDIUMTEXT,
  theme ENUM('light', 'dark') DEFAULT 'light',
  theme_preset VARCHAR(50),
  custom_models JSON,
  external_api_configs JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### user_credits 表

```sql
CREATE TABLE user_credits (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 0.00,
  total_earned DECIMAL(10, 2) DEFAULT 0.00,
  total_spent DECIMAL(10, 2) DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### credit_transactions 表

```sql
CREATE TABLE credit_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('usage', 'initial', 'bonus', 'refund') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  reference_id VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. 认证中间件

```typescript
// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ detail: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res.status(403).json({ detail: 'Invalid or expired token' });
  }
}
```

### 4. 登录接口实现

```typescript
// routes/auth.ts
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ detail: 'Username and password are required' });
    }

    // 查询用户
    const [users] = await query<any[]>(
      'SELECT * FROM users WHERE username = ? AND status = "active"',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    const user = users[0];

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    // 生成 JWT Token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 返回 Token 和用户基本信息
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// 获取当前用户信息（包含头像和昵称）
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // 查询用户基本信息
    const [users] = await query<any[]>(
      'SELECT id, username, email, role, status FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const user = users[0];

    // 查询用户设置（包含头像和昵称）
    const [settings] = await query<any[]>(
      'SELECT nickname, avatar FROM user_settings WHERE user_id = ?',
      [userId]
    );

    // 合并用户信息和设置
    res.json({
      ...user,
      nickname: settings[0]?.nickname || null,
      avatar: settings[0]?.avatar || null,
    });
  } catch (error: any) {
    console.error('Get user info error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
```

### 5. 用户设置接口

```typescript
// routes/settings.ts
import express from 'express';
import { query } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 获取用户设置（包含头像和昵称）
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [settings] = await query<any[]>(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [userId]
    );

    if (settings.length === 0) {
      // 创建默认设置
      const defaultSettings = {
        nickname: null,
        avatar: null,
        theme: 'light',
        themePreset: 'default',
        customModels: [],
        externalApiConfigs: {},
      };
      return res.json(defaultSettings);
    }

    const setting = settings[0];
    res.json({
      nickname: setting.nickname,
      avatar: setting.avatar,
      theme: setting.theme,
      themePreset: setting.theme_preset,
      customModels: setting.custom_models ? JSON.parse(setting.custom_models) : [],
      externalApiConfigs: setting.external_api_configs
        ? JSON.parse(setting.external_api_configs)
        : {},
    });
  } catch (error: any) {
    console.error('Get settings error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// 更新用户设置（包含头像和昵称）
router.put('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { nickname, avatar, theme, themePreset, customModels, externalApiConfigs } = req.body;

    // 检查设置是否存在
    const [existing] = await query<any[]>(
      'SELECT id FROM user_settings WHERE user_id = ?',
      [userId]
    );

    if (existing.length === 0) {
      // 创建新设置
      const id = require('uuid').v4();
      await query(
        `INSERT INTO user_settings 
         (id, user_id, nickname, avatar, theme, theme_preset, custom_models, external_api_configs)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          nickname || null,
          avatar || null,
          theme || 'light',
          themePreset || 'default',
          customModels ? JSON.stringify(customModels) : '[]',
          externalApiConfigs ? JSON.stringify(externalApiConfigs) : '{}',
        ]
      );
    } else {
      // 更新现有设置
      await query(
        `UPDATE user_settings 
         SET nickname = ?, avatar = ?, theme = ?, theme_preset = ?,
             custom_models = ?, external_api_configs = ?, updated_at = NOW()
         WHERE user_id = ?`,
        [
          nickname !== undefined ? nickname : null,
          avatar !== undefined ? avatar : null,
          theme || 'light',
          themePreset || 'default',
          customModels ? JSON.stringify(customModels) : '[]',
          externalApiConfigs ? JSON.stringify(externalApiConfigs) : '{}',
          userId,
        ]
      );
    }

    // 返回更新后的设置
    const [updated] = await query<any[]>(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [userId]
    );

    const setting = updated[0];
    res.json({
      nickname: setting.nickname,
      avatar: setting.avatar,
      theme: setting.theme,
      themePreset: setting.theme_preset,
      customModels: setting.custom_models ? JSON.parse(setting.custom_models) : [],
      externalApiConfigs: setting.external_api_configs
        ? JSON.parse(setting.external_api_configs)
        : {},
    });
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
```

### 6. 积分系统实现

```typescript
// services/creditService.ts
import { query, getConnection } from '../db';
import { v4 as uuidv4 } from 'uuid';

/**
 * 确保用户有积分账户
 */
export async function ensureCreditAccount(userId: string) {
  const [existing] = await query<any[]>(
    'SELECT * FROM user_credits WHERE user_id = ?',
    [userId]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  // 创建新账户
  const id = uuidv4();
  await query(
    'INSERT INTO user_credits (id, user_id, balance, total_earned, total_spent) VALUES (?, ?, 0.00, 0.00, 0.00)',
    [id, userId]
  );

  return { id, userId, balance: 0, totalEarned: 0, totalSpent: 0 };
}

/**
 * 获取积分余额
 */
export async function getCreditBalance(userId: string): Promise<number> {
  await ensureCreditAccount(userId);
  const [rows] = await query<any[]>(
    'SELECT balance FROM user_credits WHERE user_id = ?',
    [userId]
  );
  return rows.length > 0 ? parseFloat(rows[0].balance) : 0;
}

/**
 * 检查积分是否充足
 */
export async function checkSufficientCredits(
  userId: string,
  amount: number
): Promise<boolean> {
  const balance = await getCreditBalance(userId);
  return balance >= amount;
}

/**
 * 扣除积分（使用事务和锁）
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description?: string,
  referenceId?: string
): Promise<boolean> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 确保账户存在
    await ensureCreditAccount(userId);

    // 使用 FOR UPDATE 锁防止并发问题
    const [accountRows] = await connection.query<any[]>(
      'SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    if (accountRows.length === 0) {
      await connection.rollback();
      return false;
    }

    const currentBalance = parseFloat(accountRows[0].balance);
    if (currentBalance < amount) {
      await connection.rollback();
      return false; // 积分不足
    }

    const newBalance = currentBalance - amount;
    const totalSpent = parseFloat(accountRows[0].total_spent) + amount;

    // 更新余额
    await connection.query(
      'UPDATE user_credits SET balance = ?, total_spent = ?, updated_at = NOW() WHERE user_id = ?',
      [newBalance, totalSpent, userId]
    );

    // 记录交易
    const transactionId = uuidv4();
    await connection.query(
      'INSERT INTO credit_transactions (id, user_id, type, amount, balance_before, balance_after, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        transactionId,
        userId,
        'usage',
        amount,
        currentBalance,
        newBalance,
        description || null,
        referenceId || null,
      ]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 添加积分
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: 'initial' | 'bonus' | 'refund' = 'bonus',
  description?: string,
  referenceId?: string
): Promise<void> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    await ensureCreditAccount(userId);

    const [accountRows] = await connection.query<any[]>(
      'SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    const currentBalance = parseFloat(accountRows[0].balance);
    const newBalance = currentBalance + amount;
    const totalEarned = parseFloat(accountRows[0].total_earned) + amount;

    await connection.query(
      'UPDATE user_credits SET balance = ?, total_earned = ?, updated_at = NOW() WHERE user_id = ?',
      [newBalance, totalEarned, userId]
    );

    // 记录交易
    const transactionId = uuidv4();
    await connection.query(
      'INSERT INTO credit_transactions (id, user_id, type, amount, balance_before, balance_after, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        transactionId,
        userId,
        type,
        amount,
        currentBalance,
        newBalance,
        description || null,
        referenceId || null,
      ]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

### 7. 积分接口

```typescript
// routes/credits.ts
import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getCreditBalance, deductCredits } from '../services/creditService';
import { query } from '../db';

const router = express.Router();

// 获取积分余额
router.get('/balance', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const balance = await getCreditBalance(userId);

    const [account] = await query<any[]>(
      'SELECT total_earned, total_spent FROM user_credits WHERE user_id = ?',
      [userId]
    );

    res.json({
      userId,
      balance,
      totalEarned: account[0]?.total_earned || 0,
      totalSpent: account[0]?.total_spent || 0,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Get credit balance error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// 获取积分交易历史
router.get('/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const [transactions] = await query<any[]>(
      `SELECT * FROM credit_transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [total] = await query<any[]>(
      'SELECT COUNT(*) as count FROM credit_transactions WHERE user_id = ?',
      [userId]
    );

    res.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        balanceBefore: parseFloat(t.balance_before),
        balanceAfter: parseFloat(t.balance_after),
        description: t.description,
        createdAt: t.created_at,
      })),
      total: total[0].count,
    });
  } catch (error: any) {
    console.error('Get credit transactions error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
```

### 8. AI 对话接口中的积分扣除

```typescript
// routes/chat.ts
import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkSufficientCredits, deductCredits } from '../services/creditService';
import { calculateCost } from '../services/pricingService'; // 假设有定价服务

const router = express.Router();

router.post('/completions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { model_id, messages, tokens_input, tokens_output } = req.body;

    // 计算费用
    const cost = await calculateCost(model_id, tokens_input, tokens_output);

    // 检查积分是否充足
    const hasEnoughCredits = await checkSufficientCredits(userId, cost);
    if (!hasEnoughCredits) {
      return res.status(402).json({ detail: 'Insufficient credits' });
    }

    // 调用 AI 服务（这里简化处理）
    // const aiResponse = await callAIService(model_id, messages);

    // 扣除积分（在 AI 调用成功后）
    const deducted = await deductCredits(
      userId,
      cost,
      `AI chat completion - ${model_id}`,
      `chat-${Date.now()}`
    );

    if (!deducted) {
      return res.status(402).json({ detail: 'Failed to deduct credits' });
    }

    // 返回 AI 响应
    res.json({
      // ... AI 响应数据
    });
  } catch (error: any) {
    console.error('Chat completion error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
```

---

## 前端实现

### 1. API 客户端配置

```typescript
// services/api.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PROJECT_SOURCE = import.meta.env.VITE_PROJECT_SOURCE || 'your-project';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Project-Source': PROJECT_SOURCE,
  },
});

// 请求拦截器：添加认证 Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期，清除本地存储并跳转登录
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 2. 认证服务

```typescript
// services/authService.ts
import { apiClient } from './api';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'ADMIN' | 'USER';
  nickname?: string;
  avatar?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

/**
 * 用户登录
 */
export async function login(username: string, password: string): Promise<User | null> {
  try {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', {
      username,
      password,
    });

    const { token, user } = response.data;

    // 保存 Token 和用户信息
    localStorage.setItem('auth_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));

    return user;
  } catch (error: any) {
    if (error.response?.status === 401) {
      return null; // 用户名或密码错误
    }
    throw error;
  }
}

/**
 * 获取当前用户信息（包含头像和昵称）
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await apiClient.get<User>('/api/auth/me');
    return response.data;
  } catch (error) {
    return null;
  }
}

/**
 * 登出
 */
export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('current_user');
  window.location.href = '/login';
}
```

### 3. 用户设置服务

```typescript
// services/settingsService.ts
import { apiClient } from './api';

export interface AppSettings {
  nickname?: string;
  avatar?: string;
  theme?: 'light' | 'dark';
  themePreset?: string;
  customModels?: any[];
  externalApiConfigs?: Record<string, any>;
}

/**
 * 获取用户设置（包含头像和昵称）
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const response = await apiClient.get<AppSettings>('/api/settings');
    return response.data;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return {};
  }
}

/**
 * 更新用户设置（包含头像和昵称）
 */
export async function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  try {
    const response = await apiClient.put<AppSettings>('/api/settings', settings);
    return response.data;
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
}

/**
 * 上传头像（转换为 base64）
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

### 4. 积分服务

```typescript
// services/creditService.ts
import { apiClient } from './api';

export interface CreditBalance {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  type: 'usage' | 'initial' | 'bonus' | 'refund';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  createdAt: string;
}

/**
 * 获取积分余额
 */
export async function getCreditBalance(): Promise<number> {
  try {
    const response = await apiClient.get<CreditBalance>('/api/credits/balance');
    return response.data.balance;
  } catch (error) {
    console.error('Failed to get credit balance:', error);
    return 0;
  }
}

/**
 * 获取积分交易历史
 */
export async function getCreditTransactions(
  limit: number = 50,
  offset: number = 0
): Promise<{ transactions: CreditTransaction[]; total: number }> {
  try {
    const response = await apiClient.get<{ transactions: CreditTransaction[]; total: number }>(
      `/api/credits/transactions?limit=${limit}&offset=${offset}`
    );
    return response.data;
  } catch (error) {
    console.error('Failed to get credit transactions:', error);
    return { transactions: [], total: 0 };
  }
}
```

### 5. 用户信息组件（左下角）

```tsx
// components/UserInfo.tsx
import React, { useState, useEffect } from 'react';
import { Settings, LogOut, Coins } from 'lucide-react';
import { User } from '../services/authService';
import { getCreditBalance } from '../services/creditService';

interface UserInfoProps {
  user: User;
  onLogout: () => void;
  onOpenSettings: () => void;
  themePreset?: 'default' | 'notion' | 'monet';
}

const UserInfo: React.FC<UserInfoProps> = ({
  user,
  onLogout,
  onOpenSettings,
  themePreset = 'default',
}) => {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const bal = await getCreditBalance();
        setBalance(bal);
      } catch (error) {
        console.error('Failed to fetch credit balance', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();

    // 每 30 秒刷新一次积分余额
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  const isMonet = themePreset === 'monet';
  const isNotion = themePreset === 'notion';

  return (
    <div
      className={`p-4 border-t ${
        isMonet
          ? 'border-white/10 bg-white/5'
          : 'border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl'
      }`}
    >
      {/* 用户头像和昵称 */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm overflow-hidden ${
            isMonet
              ? 'bg-[#4A4B6A] border border-white/20'
              : 'bg-gradient-to-br from-indigo-500 to-purple-500'
          }`}
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.nickname || user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>
              {(user.nickname || user.username).substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <p
            className={`text-sm font-medium truncate ${
              isMonet ? 'text-[#4A4B6A] font-bold' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {user.nickname || user.username}
          </p>
          <p
            className={`text-xs truncate ${
              isMonet ? 'text-[#4A4B6A]/70' : 'text-gray-500'
            }`}
          >
            {user.role}
          </p>
        </div>
      </div>

      {/* 积分余额 */}
      <div className="mb-4">
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 dark:bg-white/5">
            <Coins size={16} className="text-gray-400" />
            <span className="text-sm text-gray-400">Loading...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-forsion-500/10 to-indigo-500/10 dark:from-forsion-500/20 dark:to-indigo-500/20 border border-forsion-500/20 dark:border-forsion-500/30">
            <Coins size={16} className="text-forsion-600 dark:text-forsion-400" />
            <span className="text-sm font-semibold text-forsion-700 dark:text-forsion-300">
              {balance.toFixed(2)} Credits
            </span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="space-y-1">
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-2 text-sm px-3 py-2 rounded-xl transition-colors ${
            isMonet
              ? 'text-[#4A4B6A] hover:bg-white/40 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-forsion-300 hover:bg-white/70 dark:hover:bg-white/10'
          }`}
        >
          <Settings size={16} />
          Settings
        </button>
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-2 text-sm px-3 py-2 rounded-xl transition-colors ${
            isMonet
              ? 'text-[#4A4B6A]/90 hover:bg-red-500/10 hover:text-red-600 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white/70 dark:hover:bg-white/10'
          }`}
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </div>
  );
};

export default UserInfo;
```

### 6. 登录组件

```tsx
// components/LoginForm.tsx
import React, { useState } from 'react';
import { login } from '../services/authService';
import { getSettings } from '../services/settingsService';

interface LoginFormProps {
  onLoginSuccess: (user: any) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(username, password);

      if (user) {
        // 登录成功后，同步设置以获取头像和昵称
        try {
          const settings = await getSettings();
          const updatedUser = {
            ...user,
            nickname: settings.nickname,
            avatar: settings.avatar,
          };
          onLoginSuccess(updatedUser);
        } catch (syncError) {
          // 同步失败不影响登录流程
          console.warn('Failed to sync settings after login:', syncError);
          onLoginSuccess(user);
        }
      } else {
        setError('Invalid username or password');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-1">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};

export default LoginForm;
```

### 7. 主应用集成

```tsx
// App.tsx
import React, { useState, useEffect } from 'react';
import { getCurrentUser, logout, User } from './services/authService';
import { getSettings, updateSettings } from './services/settingsService';
import LoginForm from './components/LoginForm';
import UserInfo from './components/UserInfo';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查是否已登录
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const currentUser = await getCurrentUser();
          if (currentUser) {
            // 同步设置以获取头像和昵称
            const settings = await getSettings();
            setUser({
              ...currentUser,
              nickname: settings.nickname,
              avatar: settings.avatar,
            });
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('current_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  const handleOpenSettings = () => {
    // 打开设置对话框
    // 在设置中更新头像或昵称后，需要更新 user 状态
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app">
      {/* 主内容区域 */}
      <main>...</main>

      {/* 侧边栏 - 包含用户信息 */}
      <aside>
        {/* 其他内容 */}
        <UserInfo
          user={user}
          onLogout={handleLogout}
          onOpenSettings={handleOpenSettings}
        />
      </aside>
    </div>
  );
};

export default App;
```

---

## 数据库设计

### 表关系图

```
users (用户表)
  ├── id (主键)
  ├── username (唯一)
  ├── password_hash
  └── role

user_settings (用户设置表)
  ├── id (主键)
  ├── user_id (外键 → users.id)
  ├── nickname (昵称)
  └── avatar (头像 base64)

user_credits (积分账户表)
  ├── id (主键)
  ├── user_id (外键 → users.id, 唯一)
  ├── balance (余额)
  ├── total_earned (累计获得)
  └── total_spent (累计消费)

credit_transactions (积分交易表)
  ├── id (主键)
  ├── user_id (外键 → users.id)
  ├── type (类型)
  ├── amount (金额)
  ├── balance_before (扣除前余额)
  ├── balance_after (扣除后余额)
  └── description (描述)
```

### 关键字段说明

1. **user_settings.avatar**: 存储 base64 编码的图片数据（`data:image/png;base64,...`）
2. **user_settings.nickname**: 用户自定义昵称，优先于 username 显示
3. **user_credits.balance**: 当前可用积分余额
4. **credit_transactions**: 记录所有积分变动，用于审计和查询

---

## API 接口说明

### 1. 认证接口

#### POST `/api/auth/login`

用户登录，返回 JWT Token 和用户基本信息。

**请求体：**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**响应：**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "admin",
    "email": "admin@example.com",
    "role": "ADMIN",
    "status": "active"
  }
}
```

#### GET `/api/auth/me`

获取当前用户完整信息（包含头像和昵称）。

**请求头：**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应：**
```json
{
  "id": "uuid",
  "username": "admin",
  "email": "admin@example.com",
  "role": "ADMIN",
  "status": "active",
  "nickname": "管理员",
  "avatar": "data:image/png;base64,..."
}
```

### 2. 用户设置接口

#### GET `/api/settings`

获取用户设置（包含头像和昵称）。

**请求头：**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应：**
```json
{
  "nickname": "管理员",
  "avatar": "data:image/png;base64,...",
  "theme": "dark",
  "themePreset": "monet",
  "customModels": [],
  "externalApiConfigs": {}
}
```

#### PUT `/api/settings`

更新用户设置（包含头像和昵称）。

**请求头：**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**请求体：**
```json
{
  "nickname": "新昵称",
  "avatar": "data:image/png;base64,...",
  "theme": "dark"
}
```

**响应：** 返回更新后的完整设置

### 3. 积分接口

#### GET `/api/credits/balance`

获取积分余额。

**请求头：**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应：**
```json
{
  "userId": "uuid",
  "balance": 98.50,
  "totalEarned": 100.00,
  "totalSpent": 1.50,
  "updatedAt": "2025-12-25T10:00:00.000Z"
}
```

#### GET `/api/credits/transactions`

获取积分交易历史。

**请求头：**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**查询参数：**
- `limit`: 返回记录数（默认 20）
- `offset`: 偏移量（默认 0）

**响应：**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "usage",
      "amount": -0.50,
      "balanceBefore": 99.00,
      "balanceAfter": 98.50,
      "description": "AI chat completion",
      "createdAt": "2025-12-25T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

## 完整实现示例

### 后端主入口

```typescript
// index.ts
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import creditsRoutes from './routes/credits';
import chatRoutes from './routes/chat';

const app = express();

// 中间件
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(express.json());

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/chat', chatRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'forsion-backend-service' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 前端环境变量

```env
# .env
VITE_API_URL=http://localhost:3001
VITE_PROJECT_SOURCE=your-project-name
```

---

## 常见问题

### 1. 登录后头像和昵称不显示

**问题原因：**
- 登录接口只返回基本用户信息，不包含头像和昵称
- 需要登录后调用 `/api/settings` 接口获取完整信息

**解决方案：**
```typescript
// 登录成功后立即同步设置
const user = await login(username, password);
if (user) {
  const settings = await getSettings();
  const updatedUser = {
    ...user,
    nickname: settings.nickname,
    avatar: settings.avatar,
  };
  setUser(updatedUser);
}
```

### 2. 积分扣除失败

**问题原因：**
- 积分不足
- 并发问题导致余额计算错误

**解决方案：**
- 使用数据库事务和 `FOR UPDATE` 锁确保并发安全
- 在扣除前检查余额是否充足

### 3. Token 过期

**问题原因：**
- JWT Token 默认 7 天过期
- 前端没有自动刷新机制

**解决方案：**
- 在响应拦截器中检测 401 错误，自动跳转登录
- 或实现 Token 刷新机制

### 4. 头像上传大小限制

**问题原因：**
- base64 编码会增加约 33% 的数据量
- 数据库字段类型限制

**解决方案：**
- 限制上传文件大小（建议 2MB 以内）
- 使用 `MEDIUMTEXT` 类型存储 base64 数据
- 或考虑使用文件存储服务（OSS、S3 等）

### 5. 跨域问题

**问题原因：**
- 前端和后端不在同一域名

**解决方案：**
```typescript
// 后端配置 CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
```

---

## 总结

本文档详细说明了 Forsion 账号系统的完整实现方式，包括：

1. ✅ **后端实现**：认证、用户设置、积分系统的完整代码
2. ✅ **前端实现**：API 客户端、组件、状态管理的完整示例
3. ✅ **数据库设计**：表结构、字段说明、关系图
4. ✅ **API 接口**：详细的接口文档和示例

按照本文档实现，可以在任何 Forsion 项目中快速接入统一的账号系统，实现跨项目的用户认证和数据共享。

---

**最后更新**：2025年12月  
**文档版本**：v1.0.0

