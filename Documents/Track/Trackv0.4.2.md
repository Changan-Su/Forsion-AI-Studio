# Forsion AI Studio v0.4.2 更新日志

**版本**: v0.4.2  
**发布日期**: 2025年12月  
**更新类型**: 重大更新

---

## 📋 更新概述

本次更新包含三个主要改进：

1. **后端服务统一化改造** - 将后端服务改造为通用的统一后端服务，支持多个 Forsion 项目共用
2. **后端完全独立化** - 将 admin panel 移入后端项目，使后端服务可以完全独立部署和运行
3. **头像显示修复** - 修复登录后头像不显示的问题

---

## 🚀 后端统一服务改造

### 改造目标

将 Forsion AI Studio 的后端服务改造为 **Forsion Backend Service**，一个通用的、企业级的后端 API 服务，可以为多个 Forsion 项目（AI Studio、Desktop 等）提供统一的认证、AI 模型管理、对话、积分系统和使用统计功能。

### 核心改动

#### 1. 项目重命名和独立化

**改动文件**: `server-node/package.json`, `server-node/src/index.ts`

- **项目名称**: `forsion-ai-studio-server` → `forsion-backend-service`
- **版本升级**: v1.0.0 → v2.0.0
- **服务描述**: 更新为"Unified Backend Service for Forsion Projects"
- **启动日志**: 更新为通用后端服务标识

**代码示例**:
```json
// package.json
{
  "name": "forsion-backend-service",
  "version": "2.0.0",
  "description": "Unified Backend Service for Forsion Projects"
}
```

#### 2. 增强 CORS 配置

**改动文件**: `server-node/src/index.ts`

支持多个 Forsion 项目的前端访问，包括：
- AI Studio (端口 50173, 4137)
- Desktop (端口 3000)
- Calendar (端口 6006)
- 生产环境自定义域名（通过环境变量配置）

**代码示例**:
```typescript
const allowedOrigins = [
  'http://localhost:50173', // AI Studio
  'http://localhost:3000',   // Desktop
  'http://localhost:6006',   // Calendar
  // ... 更多端口
];

// 支持生产环境自定义域名
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()));
}
```

#### 3. 数据库扩展 - 项目来源追踪

**改动文件**: `server-node/src/db/migrate.ts`

在 `api_usage_logs` 表中添加 `project_source` 字段，用于区分不同项目的 API 调用：

```sql
ALTER TABLE api_usage_logs 
ADD COLUMN project_source VARCHAR(50) DEFAULT 'ai-studio' 
COMMENT '调用来源项目: ai-studio, desktop, calendar 等';

ADD INDEX idx_project_source (project_source);
```

**支持的来源标识**:
- `ai-studio` - Forsion AI Studio
- `desktop` - Forsion Desktop
- `calendar` - Forsion Calendar

#### 4. 使用统计服务更新

**改动文件**: 
- `server-node/src/services/usageService.ts`
- `server-node/src/routes/chat.ts`

更新使用统计服务，自动识别和记录 API 调用的项目来源：

```typescript
// usageService.ts
export async function logApiUsage(
  username: string,
  modelId: string,
  modelName?: string,
  provider?: string,
  tokensInput: number = 0,
  tokensOutput: number = 0,
  success: boolean = true,
  errorMessage?: string,
  projectSource?: string  // 新增参数
): Promise<void> {
  // 记录项目来源
  await query(
    `INSERT INTO api_usage_logs (..., project_source, ...)
     VALUES (..., ?, ...)`,
    [..., projectSource ?? 'ai-studio', ...]
  );
}
```

在聊天路由中提取项目来源：

```typescript
// chat.ts
router.post('/chat/completions', authMiddleware, async (req: AuthRequest, res) => {
  // 从请求头提取项目来源
  const projectSource = (req.headers['x-project-source'] as string) || 'ai-studio';
  
  // 在所有 logApiUsage 调用中传递 projectSource
  await logApiUsage(..., projectSource);
});
```

#### 5. 增强健康检查和元信息接口

**改动文件**: `server-node/src/index.ts`

**健康检查接口** (`/api/health`):
```json
{
  "status": "healthy",
  "service": "forsion-backend-service",
  "version": "2.0.0",
  "timestamp": "2025-12-25T10:00:00.000Z",
  "database": "connected"
}
```

**服务信息接口** (`/api/info`):
```json
{
  "name": "Forsion Backend Service",
  "version": "2.0.0",
  "description": "Unified Backend Service for Forsion Projects",
  "supportedProjects": ["ai-studio", "desktop"],
  "features": ["auth", "ai-models", "chat", "credits", "usage-stats", "file-processing"],
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

#### 6. 环境变量配置优化

**改动文件**: `server-node/env.example`

新增多项目支持的环境变量配置：

```env
# 服务配置
SERVICE_NAME=forsion-backend-service
PORT=3001
NODE_ENV=development

# CORS 配置（多项目支持）
ALLOWED_ORIGINS=http://localhost:50173,http://localhost:3000,http://localhost:6006

# 数据库配置（共享）
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=forsion_shared_db

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# 管理员凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin123!@#

# 功能开关（可选）
ENABLE_INVITE_CODES=true
ENABLE_CREDIT_SYSTEM=true
```

#### 7. 完整文档体系

**新增文档**:
- `server-node/README.md` - 统一后端服务完整文档
- `server-node/docs/API.md` - 详细 API 接口文档
- `server-node/docs/CLIENT_INTEGRATION.md` - 客户端集成指南
- `server-node/DEPLOYMENT.md` - 生产环境部署指南
- `Documents/backend_overview.md` - 后端服务与 API 使用文档

### 数据库迁移

运行以下命令进行数据库迁移：

```bash
cd server-node
npm run db:migrate
```

迁移脚本会自动：
- 添加 `project_source` 字段到 `api_usage_logs` 表
- 创建相应的索引
- 不会影响现有数据

### 使用说明

#### 启动统一后端服务

```bash
cd server-node
npm install
npm run db:migrate  # 运行数据库迁移
npm run dev        # 开发模式
```

#### 前端项目集成

在前端项目中配置 API 地址和项目来源标识：

```typescript
// 环境变量
VITE_API_URL=http://localhost:3001
VITE_PROJECT_SOURCE=ai-studio

// API 请求配置
axios.defaults.headers.common['X-Project-Source'] = 'ai-studio';
```

---

## 🔧 后端完全独立化

### 改造目标

将后端服务改造为完全独立的项目，包含 admin panel，可以单独复制、部署和运行，无需依赖项目根目录的任何文件。

### 核心改动

#### 1. Admin Panel 目录迁移

**改动文件**: 移动 `admin/` 目录到 `server-node/admin/`

- 将 `admin/index.html` 移动到 `server-node/admin/index.html`
- Admin panel 现在完全包含在后端项目中
- 不再依赖项目根目录的文件结构

#### 2. 路径引用更新

**改动文件**: `server-node/src/index.ts`

修改 admin 路径引用，从相对根目录改为相对后端项目目录：

**修改前：**
```typescript
const adminPath = path.resolve(__dirname, '../../admin');
```

**修改后：**
```typescript
// When running from dist/, __dirname is dist/
// admin is at the same level as dist/
const adminPath = path.resolve(__dirname, '../admin');
```

#### 3. Dockerfile 更新

**改动文件**: `server-node/Dockerfile`

添加 admin 目录的复制指令，确保 Docker 镜像包含管理面板：

```dockerfile
# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy admin panel
COPY --from=builder /app/admin ./admin
```

#### 4. 文档更新

**改动文件**: 
- `server-node/README.md` - 添加项目结构说明和独立部署指南
- `server-node/DEPLOYMENT.md` - 说明 admin panel 已内置
- `Documents/backend_overview.md` - 更新服务定位说明

**新增内容**:
- 项目结构图，展示 admin 目录位置
- 独立部署指南，说明如何单独部署后端服务
- Admin Panel 章节，说明管理面板已内置

### 新的目录结构

```
server-node/
├── admin/                    # 管理面板（单页应用）
│   └── index.html
├── src/
│   ├── index.ts             # 主入口
│   ├── routes/              # API 路由
│   ├── services/            # 业务逻辑
│   └── ...
├── Dockerfile               # Docker 镜像构建
├── package.json
├── README.md
└── DEPLOYMENT.md
```

### 独立部署能力

现在可以：

1. **直接复制部署**：
   ```bash
   # 复制整个 server-node 目录到任何位置
   cp -r server-node /path/to/deployment/
   cd /path/to/deployment/server-node
   npm install
   npm start
   ```

2. **Docker 独立部署**：
   ```bash
   cd server-node
   docker build -t forsion-backend:latest .
   docker run -p 3001:3001 --env-file .env forsion-backend:latest
   ```

3. **访问管理面板**：
   - 服务启动后，通过 `http://localhost:3001/admin` 访问
   - 无需额外配置，admin panel 已内置

### 改动文件清单

| 文件路径 | 改动类型 | 说明 |
|---------|---------|------|
| `admin/index.html` | 移动 | 移动到 `server-node/admin/index.html` |
| `server-node/src/index.ts` | 修改 | 更新 admin 路径引用 |
| `server-node/Dockerfile` | 修改 | 添加 admin 目录复制 |
| `server-node/README.md` | 修改 | 添加项目结构和独立部署说明 |
| `server-node/DEPLOYMENT.md` | 修改 | 添加 Admin Panel 章节 |
| `Documents/backend_overview.md` | 修改 | 更新服务定位说明 |

### 完成效果

- ✅ 后端服务完全独立，可以单独复制和部署
- ✅ Docker 镜像包含所有必要文件，包括 admin panel
- ✅ 无需依赖项目根目录的任何文件
- ✅ 文档完整，清晰说明独立部署方式

---

## 🐛 头像显示修复

### 问题描述

用户重新登录后，头像不会立即显示，需要进入设置界面修改任意设置（如 UI 风格或用户名）后，头像才会刷新显示。

### 问题原因

1. **登录接口返回的用户信息不完整**：后端登录接口只返回 `id`, `username`, `role`，不包含 `nickname` 和 `avatar`
2. **登录后没有同步设置**：`handleLogin` 函数在登录成功后只设置了基本用户信息，没有调用 `syncSettingsFromBackend()` 来获取用户的头像和昵称
3. **设置界面会触发同步**：当用户在设置界面修改任何设置时，会调用 `syncSettingsFromBackend()`，所以头像会显示

### 修复方案

#### 1. 优化 `syncSettingsFromBackend` 函数

**改动文件**: `client/App.tsx` (第115-129行)

修改前的问题：由于 React 状态更新的异步性，`syncSettingsFromBackend` 函数可能使用过时的 `user` 状态。

**修复代码**:
```typescript
// Update user profile if settings contain nickname or avatar
// Always update if nickname or avatar is in settings (even if null/empty)
// Read latest user from localStorage to avoid stale closure issues
const currentUserStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
const currentUser = currentUserStr ? JSON.parse(currentUserStr) : user;

if (currentUser && (settings.nickname !== undefined || settings.avatar !== undefined)) {
  const updatedUser = {
    ...currentUser,
    nickname: settings.nickname !== undefined ? settings.nickname : currentUser.nickname,
    avatar: settings.avatar !== undefined ? settings.avatar : currentUser.avatar
  };
  setUser(updatedUser);
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
}
```

**改进点**:
- 从 localStorage 读取最新的用户信息，避免闭包导致的过时状态问题
- 确保能获取到刚登录的用户信息

#### 2. 修改 `handleLogin` 函数

**改动文件**: `client/App.tsx` (第331-356行)

在登录成功后立即调用 `syncSettingsFromBackend()` 来获取用户的完整信息：

**修复代码**:
```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsAuthLoading(true);
  setAuthError('');
  try {
    const u = await login(username, password);
    if (u) {
      setUser(u);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(u));
      setUsername('');
      setPassword('');
      // 立即同步设置以获取头像和昵称
      try {
        await syncSettingsFromBackend();
      } catch (syncError) {
        // 同步失败不影响登录流程，只记录错误
        console.warn('Failed to sync settings after login:', syncError);
      }
    } else {
      setAuthError('Invalid credentials');
    }
  } catch (err) {
    setAuthError('Login failed');
  } finally {
    setIsAuthLoading(false);
  }
};
```

**改进点**:
- 登录成功后立即同步设置，获取用户的完整信息（包括头像和昵称）
- 添加错误处理，确保同步失败不会影响登录流程

### 修复效果

- ✅ 登录后头像立即显示，无需进入设置界面
- ✅ 昵称也能正确显示
- ✅ 修复了状态更新的时序问题
- ✅ 不影响登录流程的稳定性

### 测试验证

1. 清除浏览器缓存和 localStorage
2. 重新登录
3. 验证：登录后头像应立即显示，无需进入设置界面

---

## 📁 改动文件清单

### 后端改动

| 文件路径 | 改动类型 | 说明 |
|---------|---------|------|
| `admin/index.html` | 移动 | 移动到 `server-node/admin/index.html` |
| `server-node/package.json` | 修改 | 重命名项目，更新描述和版本 |
| `server-node/src/index.ts` | 修改 | 增强 CORS、健康检查、元信息接口，更新 admin 路径 |
| `server-node/src/db/migrate.ts` | 修改 | 添加 `project_source` 字段 |
| `server-node/src/services/usageService.ts` | 修改 | 支持项目来源参数 |
| `server-node/src/routes/chat.ts` | 修改 | 提取和传递项目来源 |
| `server-node/Dockerfile` | 修改 | 添加 admin 目录复制 |
| `server-node/env.example` | 修改 | 添加多项目配置 |
| `server-node/README.md` | 新建/修改 | 统一后端服务文档，添加项目结构和独立部署说明 |
| `server-node/docs/API.md` | 新建 | 完整 API 文档 |
| `server-node/docs/CLIENT_INTEGRATION.md` | 新建 | 客户端集成指南 |
| `server-node/DEPLOYMENT.md` | 新建/修改 | 部署指南，添加 Admin Panel 说明 |

### 前端改动

| 文件路径 | 改动类型 | 说明 |
|---------|---------|------|
| `client/App.tsx` | 修改 | 修复登录后头像不显示问题 |

### 文档改动

| 文件路径 | 改动类型 | 说明 |
|---------|---------|------|
| `Documents/backend_overview.md` | 新建/修改 | 后端服务与 API 使用文档，更新服务定位说明 |
| `Documents/Track/Trackv0.4.2.md` | 新建 | 本更新日志 |

---

## 🔄 升级指南

### 从 v0.4.1 升级到 v0.4.2

#### 1. 后端升级

```bash
# 1. 更新代码
git pull origin main

# 2. 安装依赖（如果有新增）
cd server-node
npm install

# 3. 运行数据库迁移（重要！）
npm run db:migrate

# 4. 更新环境变量
# 编辑 .env 文件，参考 env.example 添加新配置

# 5. 重启服务
npm run dev  # 或 npm start (生产环境)
```

#### 2. 前端升级

```bash
# 1. 更新代码
git pull origin main

# 2. 安装依赖（如果有新增）
cd client
npm install

# 3. 清除缓存（推荐）
# 清除浏览器缓存和 localStorage

# 4. 重启前端
npm run dev
```

#### 3. 验证升级

1. **后端验证**:
   ```bash
   # 检查健康状态
   curl http://localhost:3001/api/health
   
   # 检查服务信息
   curl http://localhost:3001/api/info
   ```

2. **前端验证**:
   - 登录后头像应立即显示
   - 检查浏览器控制台是否有错误
   - 验证 API 请求是否正常

---

## 🎯 主要改进

### 后端统一服务

1. **多项目共用** - AI Studio 和 Desktop 可以使用同一个后端服务
2. **用户体系统一** - 用户可以跨项目登录，账号和积分共享
3. **项目来源追踪** - 所有 API 调用都记录来源项目，支持精细化使用分析
4. **完全独立部署** - 包含 admin panel，可以单独复制、部署和运行，无需依赖其他目录
5. **Docker 容器化** - Docker 镜像包含所有必要文件，支持一键部署
6. **完善的文档** - 详细的 API 文档、集成指南和部署指南

### 头像显示修复

1. **即时显示** - 登录后头像立即显示，无需额外操作
2. **状态同步** - 修复了状态更新的时序问题
3. **稳定性** - 同步失败不影响登录流程

---

## 📚 相关文档

- [后端服务完整文档](../server-node/README.md)
- [API 接口文档](../server-node/docs/API.md)
- [客户端集成指南](../server-node/docs/CLIENT_INTEGRATION.md)
- [部署指南](../server-node/DEPLOYMENT.md)
- [后端服务与 API 使用文档](../backend_overview.md)

---

## 🔧 已知问题

无

---

## 🚀 下一步计划

- [x] 后端完全独立化（包含 admin panel）
- [ ] 支持更多 Forsion 项目接入统一后端
- [ ] 优化使用统计查询性能
- [ ] 添加更多监控和告警功能
- [ ] 完善 API 文档和示例代码

---

**最后更新**: 2025年12月  
**文档版本**: v0.4.2

