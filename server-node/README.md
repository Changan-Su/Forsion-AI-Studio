# Forsion Backend Service

一个统一的、企业级的后端 API 服务，为 Forsion 系列项目（AI Studio、Desktop 等）提供认证、AI 模型管理、对话、积分系统和使用统计功能。

## 🎯 服务定位

Forsion Backend Service 是一个独立的后端服务，可以同时为多个前端项目提供统一的 API 接口。支持：

- **多项目共用**：AI Studio、Desktop 等项目可以共享同一个后端
- **用户体系统一**：用户可以跨项目登录，积分和数据共享
- **完全独立**：包含管理面板，可以单独复制、部署和运行，无需依赖其他目录
- **Docker 容器化**：支持 Docker 部署，包含所有必要文件
- **可扩展性强**：易于添加新功能模块和集成新项目

## 📁 项目结构

```
server-node/
├── admin/                    # 管理面板（单页应用）
│   └── index.html
├── src/
│   ├── index.ts             # 主入口
│   ├── routes/              # API 路由
│   ├── services/            # 业务逻辑
│   ├── middleware/          # 中间件
│   ├── config/              # 配置文件
│   ├── db/                  # 数据库迁移和种子
│   └── types/               # TypeScript 类型定义
├── docs/                    # 文档目录
│   ├── API.md               # API 文档
│   └── CLIENT_INTEGRATION.md # 客户端集成指南
├── Dockerfile               # Docker 镜像构建文件
├── package.json             # 项目依赖和脚本
├── tsconfig.json            # TypeScript 配置
├── env.example              # 环境变量示例
├── README.md                # 本文件
└── DEPLOYMENT.md            # 部署指南
```

## ✨ 核心功能

### 1. 用户认证系统 (JWT)
- 用户注册/登录
- 邀请码机制
- 角色权限管理（管理员/普通用户）
- Token 过期自动刷新

### 2. AI 模型管理
- 支持多种 AI 模型（Gemini、OpenAI、DeepSeek、Claude 等）
- 自定义模型配置
- API Key 安全管理
- 模型启用/禁用控制

### 3. AI 对话接口
- OpenAI 兼容的聊天接口
- 流式响应（SSE）
- 图片、PDF、Word 文档处理
- 实时 Token 使用统计

### 4. 积分系统
- 基于 Token 使用的动态计费
- 积分余额查询
- 交易历史记录
- 自定义定价配置

### 5. 使用统计
- 详细的 API 调用日志
- 按模型、日期、用户、项目聚合统计
- 成功率追踪
- 项目来源识别

## 🚀 快速开始

### 前置要求

- Node.js 18+
- MySQL 8.0+
- npm 或 yarn

### 1. 安装依赖

```bash
cd server-node
npm install
```

### 2. 配置环境变量

复制 `env.example` 到 `.env` 并配置：

```bash
cp env.example .env
```

编辑 `.env` 文件：

```env
# 服务配置
SERVICE_NAME=forsion-backend-service
PORT=3001
NODE_ENV=development

# 跨域配置（多项目支持）
ALLOWED_ORIGINS=http://localhost:50173,http://localhost:3000,http://localhost:6006

# 数据库配置（共享）
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=forsion_shared_db

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# 管理员凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin123!@#
```

### 3. 初始化数据库

```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE forsion_shared_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 运行迁移脚本
npm run db:migrate

# 可选：填充示例数据
npm run db:seed
```

### 4. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

服务默认运行在 `http://localhost:3001`

- API 接口：`http://localhost:3001/api`
- 管理面板：`http://localhost:3001/admin`
- 健康检查：`http://localhost:3001/api/health`

## 📡 API 接口

### 核心端点

| 端点 | 说明 |
|------|------|
| `/api/health` | 健康检查，包含数据库状态 |
| `/api/info` | 服务元信息 |
| `/api/auth/*` | 认证相关接口 |
| `/api/models` | 模型管理 |
| `/api/chat/completions` | AI 对话接口 |
| `/api/credits/*` | 积分系统 |
| `/api/usage/*` | 使用统计 |
| `/admin` | 管理员面板 |

详细 API 文档请参考：[docs/API.md](docs/API.md)

## 🔌 客户端集成

### 前端项目配置

在前端项目中配置 API 地址：

```env
# .env.local
VITE_API_URL=http://localhost:3001
```

在 API 请求中添加项目来源标识：

```typescript
// 所有请求添加自定义头
axios.defaults.headers.common['X-Project-Source'] = 'ai-studio'; // 或 'desktop'
```

详细集成指南：[docs/CLIENT_INTEGRATION.md](docs/CLIENT_INTEGRATION.md)

## 🗄️ 数据库架构

### 核心数据表

- `users` - 用户基本信息
- `user_settings` - 用户个性化设置
- `user_credits` - 用户积分账户
- `credit_transactions` - 积分交易记录
- `global_models` - AI 模型配置
- `api_usage_logs` - API 使用日志（包含 project_source 字段）
- `invite_codes` - 邀请码管理
- `credit_pricing` - 模型定价配置

### 项目来源追踪

`api_usage_logs` 表包含 `project_source` 字段，用于区分不同项目的 API 调用：

- `ai-studio` - Forsion AI Studio
- `desktop` - Forsion Desktop
- `calendar` - Forsion Calendar（如果使用统一后端）

## 🚀 独立部署

本项目是一个完全独立的后端服务，可以单独部署到任何位置：

### 快速部署

```bash
# 1. 复制整个 server-node 目录到目标位置
cp -r server-node /path/to/deployment/

# 2. 进入目录
cd /path/to/deployment/server-node

# 3. 配置环境变量
cp env.example .env
# 编辑 .env 文件，配置数据库等信息

# 4. 安装依赖
npm install

# 5. 数据库迁移
npm run db:migrate

# 6. 启动服务
npm start
```

### Docker 部署

```bash
# 在 server-node 目录下执行
docker build -t forsion-backend:latest .
docker run -p 3001:3001 --env-file .env forsion-backend:latest
```

### 使用 Docker Compose

在项目根目录：

```bash
docker compose up -d
```

详细部署指南：[DEPLOYMENT.md](DEPLOYMENT.md)

## 📊 监控和维护

### 健康检查

```bash
curl http://localhost:3001/api/health
```

响应示例：

```json
{
  "status": "healthy",
  "service": "forsion-backend-service",
  "version": "2.0.0",
  "timestamp": "2025-12-25T10:00:00.000Z",
  "database": "connected"
}
```

### 查看服务信息

```bash
curl http://localhost:3001/api/info
```

### 使用统计

访问管理面板：`http://localhost:3001/admin`

或通过 API：

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/usage/stats?days=7
```

## 🔐 安全性

- 密码使用 bcrypt 加密
- JWT Token 认证
- CORS 保护
- SQL 注入防护
- API Key 加密存储
- 环境变量管理敏感信息

## 📚 文档

- [完整 API 文档](docs/API.md)
- [客户端集成指南](docs/CLIENT_INTEGRATION.md)
- [部署指南](DEPLOYMENT.md)
- [数据库迁移](src/db/migrate.ts)

## 🤝 支持的项目

当前支持以下 Forsion 项目：

1. **Forsion AI Studio** - 多模型 AI 聊天平台
2. **Forsion Desktop** - 桌面 AI 应用

### 添加新项目支持

1. 在前端项目配置 `VITE_API_URL` 指向后端服务
2. 添加 `X-Project-Source` 请求头标识项目
3. 如需新端口，在后端 `.env` 中更新 `ALLOWED_ORIGINS`

## 🔧 故障排查

### 数据库连接失败

```bash
# 检查 MySQL 服务
systemctl status mysql

# 测试连接
mysql -h localhost -P 3306 -u root -p
```

### 端口被占用

```bash
# Windows
netstat -ano | findstr :3001

# Linux/Mac
lsof -i :3001
```

### 查看日志

```bash
# 开发环境
npm run dev

# Docker 环境
docker compose logs -f backend
```

## 📝 版本历史

### v2.0.0 (2025-12)
- 重构为统一后端服务
- 支持多项目共用
- 添加项目来源追踪
- 增强健康检查和监控
- 优化 CORS 配置

### v1.0.0 (2025-01)
- 初始版本
- 基础认证和模型管理功能

## 📄 许可证

MIT License

## 🙏 致谢

感谢 Forsion 项目团队的贡献！

