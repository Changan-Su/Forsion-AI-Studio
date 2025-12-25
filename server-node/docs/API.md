# Forsion Backend Service - API 文档

版本：v2.0.0

## 基础信息

- **Base URL**: `http://localhost:3001` (开发环境)
- **认证方式**: JWT Bearer Token
- **Content-Type**: `application/json`
- **项目来源标识**: 通过 `X-Project-Source` 请求头传递

## 认证流程

所有需要认证的接口都需要在请求头中携带 JWT Token：

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## API 端点

### 1. 系统信息

#### 1.1 健康检查

检查服务健康状态和数据库连接。

**请求**

```http
GET /api/health
```

**响应**

```json
{
  "status": "healthy",
  "service": "forsion-backend-service",
  "version": "2.0.0",
  "timestamp": "2025-12-25T10:00:00.000Z",
  "database": "connected"
}
```

#### 1.2 服务信息

获取服务元信息和可用端点。

**请求**

```http
GET /api/info
```

**响应**

```json
{
  "name": "Forsion Backend Service",
  "version": "2.0.0",
  "description": "Unified Backend Service for Forsion Projects",
  "supportedProjects": ["ai-studio", "desktop"],
  "features": ["auth", "ai-models", "chat", "credits", "usage-stats", "file-processing"],
  "documentation": "/api/docs",
  "endpoints": {
    "auth": "/api/auth",
    "models": "/api/models",
    "chat": "/api/chat",
    "credits": "/api/credits",
    "usage": "/api/usage",
    "health": "/api/health"
  }
}
```

---

### 2. 认证模块 (`/api/auth`)

#### 2.1 用户登录

**请求**

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin123!@#"
}
```

**响应**

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

**错误响应**

```json
{
  "detail": "Invalid credentials"
}
```

#### 2.2 用户注册

需要有效的邀请码才能注册。

**请求**

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "SecurePassword123!",
  "email": "newuser@example.com",
  "inviteCode": "INVITE-CODE-123"
}
```

**响应**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "newuser",
    "email": "newuser@example.com",
    "role": "USER",
    "status": "active"
  }
}
```

#### 2.3 获取当前用户信息

**请求**

```http
GET /api/auth/me
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应**

```json
{
  "id": "uuid",
  "username": "admin",
  "email": "admin@example.com",
  "role": "ADMIN",
  "status": "active",
  "lastLoginAt": "2025-12-25T10:00:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

#### 2.4 修改密码

**请求**

```http
PUT /api/auth/password
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "oldPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**响应**

```json
{
  "message": "Password updated successfully"
}
```

---

### 3. 模型管理 (`/api/models`)

#### 3.1 获取可用模型列表

**请求**

```http
GET /api/models
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应**

```json
[
  {
    "id": "gemini-2.0-flash-exp",
    "name": "Gemini 2.0 Flash",
    "provider": "gemini",
    "description": "Google's latest fast model",
    "icon": "Sparkles",
    "isEnabled": true,
    "apiModelId": "gemini-2.0-flash-exp",
    "defaultBaseUrl": "https://generativelanguage.googleapis.com/v1beta"
  },
  {
    "id": "gpt-4",
    "name": "GPT-4",
    "provider": "openai",
    "description": "OpenAI's most capable model",
    "icon": "Brain",
    "isEnabled": true
  }
]
```

#### 3.2 添加自定义模型（管理员）

**请求**

```http
POST /api/admin/models
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "id": "custom-model-1",
  "name": "My Custom Model",
  "provider": "external",
  "apiModelId": "custom-model-v1",
  "apiKey": "sk-xxxxx",
  "defaultBaseUrl": "https://api.custom.com/v1",
  "description": "Custom model description",
  "icon": "Zap"
}
```

**响应**

```json
{
  "message": "Model added successfully",
  "model": {
    "id": "custom-model-1",
    "name": "My Custom Model",
    "isEnabled": true
  }
}
```

#### 3.3 更新模型配置（管理员）

**请求**

```http
PUT /api/admin/models/:id
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "isEnabled": false,
  "apiKey": "new-api-key"
}
```

#### 3.4 删除模型（管理员）

**请求**

```http
DELETE /api/admin/models/:id
Authorization: Bearer YOUR_JWT_TOKEN
```

---

### 4. AI 对话接口 (`/api/chat`)

#### 4.1 聊天补全（兼容 OpenAI 格式）

支持流式和非流式响应。

**请求**

```http
POST /api/chat/completions
Authorization: Bearer YOUR_JWT_TOKEN
X-Project-Source: ai-studio
Content-Type: application/json

{
  "model_id": "gemini-2.0-flash-exp",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": true
}
```

**流式响应（SSE）**

```
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":"!"}}]}

data: {"choices":[{"delta":{"content":" I'm"}}]}

data: [DONE]
```

**非流式响应**

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1703520000,
  "model": "gemini-2.0-flash-exp",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

#### 4.2 支持的附件格式

可以在对话中附带图片：

```json
{
  "model_id": "gpt-4-vision-preview",
  "messages": [
    {
      "role": "user",
      "content": "What's in this image?"
    }
  ],
  "attachments": [
    {
      "type": "image",
      "url": "data:image/png;base64,iVBORw0KG...",
      "mimeType": "image/png"
    }
  ]
}
```

---

### 5. 积分系统 (`/api/credits`)

#### 5.1 查询积分余额

**请求**

```http
GET /api/credits/balance
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应**

```json
{
  "userId": "uuid",
  "balance": 98.50,
  "totalEarned": 100.00,
  "totalSpent": 1.50,
  "updatedAt": "2025-12-25T10:00:00.000Z"
}
```

#### 5.2 积分交易历史

**请求**

```http
GET /api/credits/transactions?limit=20&offset=0
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应**

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
    },
    {
      "id": "uuid",
      "type": "initial",
      "amount": 100.00,
      "balanceBefore": 0.00,
      "balanceAfter": 100.00,
      "description": "Initial credits",
      "createdAt": "2025-12-01T00:00:00.000Z"
    }
  ],
  "total": 2
}
```

#### 5.3 查询模型定价

**请求**

```http
GET /api/credits/pricing
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应**

```json
[
  {
    "modelId": "gpt-4",
    "provider": "openai",
    "tokensPerCredit": 100.0,
    "inputMultiplier": 1.5,
    "outputMultiplier": 3.0,
    "isActive": true
  },
  {
    "modelId": "gemini-pro",
    "provider": "gemini",
    "tokensPerCredit": 200.0,
    "inputMultiplier": 1.0,
    "outputMultiplier": 1.0,
    "isActive": true
  }
]
```

#### 5.4 更新定价配置（管理员）

**请求**

```http
PUT /api/admin/credits/pricing/:modelId
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "tokensPerCredit": 150.0,
  "inputMultiplier": 1.2,
  "outputMultiplier": 2.0
}
```

---

### 6. 使用统计 (`/api/usage`)

#### 6.1 获取使用日志

**请求**

```http
GET /api/usage/logs?limit=50&offset=0
Authorization: Bearer YOUR_JWT_TOKEN
```

**查询参数**

- `limit`: 返回记录数（默认 50，最大 1000）
- `offset`: 偏移量（用于分页）
- `username`: 过滤特定用户（可选）
- `modelId`: 过滤特定模型（可选）
- `projectSource`: 过滤特定项目（可选，如 `ai-studio`, `desktop`）

**响应**

```json
{
  "logs": [
    {
      "id": 12345,
      "username": "admin",
      "modelId": "gpt-4",
      "modelName": "GPT-4",
      "provider": "openai",
      "projectSource": "ai-studio",
      "tokensInput": 100,
      "tokensOutput": 50,
      "success": true,
      "createdAt": "2025-12-25T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

#### 6.2 获取统计数据

**请求**

```http
GET /api/usage/stats?days=7
Authorization: Bearer YOUR_JWT_TOKEN
```

**查询参数**

- `days`: 统计天数（默认 7）
- `username`: 过滤特定用户（可选）

**响应**

```json
{
  "totalRequests": 1250,
  "totalTokensInput": 125000,
  "totalTokensOutput": 62500,
  "successRate": 99.2,
  "successful": 1240,
  "failed": 10,
  "byModel": [
    {
      "modelId": "gpt-4",
      "modelName": "GPT-4",
      "count": 500,
      "tokens": 75000
    },
    {
      "modelId": "gemini-pro",
      "modelName": "Gemini Pro",
      "count": 750,
      "tokens": 112500
    }
  ],
  "byDay": [
    {
      "date": "2025-12-25",
      "count": 200,
      "tokens": 30000
    },
    {
      "date": "2025-12-24",
      "count": 180,
      "tokens": 27000
    }
  ],
  "byUser": [
    {
      "username": "admin",
      "count": 800,
      "tokens": 120000
    },
    {
      "username": "user1",
      "count": 450,
      "tokens": 67500
    }
  ],
  "byProject": [
    {
      "projectSource": "ai-studio",
      "count": 900,
      "tokens": 135000
    },
    {
      "projectSource": "desktop",
      "count": 350,
      "tokens": 52500
    }
  ]
}
```

---

### 7. 用户管理 (`/api/users`, 管理员)

#### 7.1 获取用户列表

**请求**

```http
GET /api/users
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 7.2 创建用户

**请求**

```http
POST /api/users
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "username": "newuser",
  "password": "SecurePassword123!",
  "email": "newuser@example.com",
  "role": "USER"
}
```

#### 7.3 更新用户

**请求**

```http
PUT /api/users/:id
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "status": "inactive",
  "role": "ADMIN"
}
```

#### 7.4 删除用户

**请求**

```http
DELETE /api/users/:id
Authorization: Bearer YOUR_JWT_TOKEN
```

---

### 8. 邀请码管理 (`/api/admin/invite-codes`, 管理员)

#### 8.1 获取邀请码列表

**请求**

```http
GET /api/admin/invite-codes
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 8.2 创建邀请码

**请求**

```http
POST /api/admin/invite-codes
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "code": "WELCOME2025",
  "maxUses": 10,
  "initialCredits": 100.00,
  "expiresAt": "2025-12-31T23:59:59Z",
  "notes": "New year promotion"
}
```

#### 8.3 更新邀请码

**请求**

```http
PUT /api/admin/invite-codes/:id
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "isActive": false
}
```

#### 8.4 删除邀请码

**请求**

```http
DELETE /api/admin/invite-codes/:id
Authorization: Bearer YOUR_JWT_TOKEN
```

---

### 9. 文件处理 (`/api/files`)

#### 9.1 上传文件

支持图片、PDF、Word 文档。

**请求**

```http
POST /api/files/upload
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

file: [binary data]
```

**响应**

```json
{
  "fileId": "uuid",
  "url": "https://...",
  "type": "image/png",
  "size": 12345
}
```

---

## 错误响应格式

所有错误响应遵循统一格式：

```json
{
  "detail": "Error message description"
}
```

### 常见状态码

- `200` - 成功
- `400` - 请求参数错误
- `401` - 未认证或 Token 无效
- `402` - 积分不足
- `403` - 权限不足
- `404` - 资源不存在
- `500` - 服务器内部错误

---

## 项目来源标识

所有 API 请求建议添加 `X-Project-Source` 请求头，用于统计不同项目的使用情况：

```http
X-Project-Source: ai-studio
```

支持的值：
- `ai-studio` - Forsion AI Studio
- `desktop` - Forsion Desktop
- `calendar` - Forsion Calendar

---

## 速率限制

- 默认：每用户每天 1000 次请求
- 管理员：无限制
- 超过限制返回 `429 Too Many Requests`

---

## WebSocket 支持

目前不支持 WebSocket，请使用 SSE (Server-Sent Events) 进行流式响应。

---

## 版本控制

API 版本通过 URL 路径进行管理：

- 当前版本：`/api/*` (v2.0)
- 未来版本：`/api/v2/*`

---

## 更多信息

- [客户端集成指南](CLIENT_INTEGRATION.md)
- [部署指南](../DEPLOYMENT.md)
- [GitHub Issues](https://github.com/your-org/forsion-backend/issues)


