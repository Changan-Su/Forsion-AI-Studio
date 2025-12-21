<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Forsion AI Studio

一个现代化、高性能的 AI 聊天平台，支持多种 AI 模型，提供企业级用户管理和自定义配置功能。

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-orange.svg)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

</div>

## ✨ 主要特性

- 🤖 **多模型支持**：支持 Gemini、OpenAI GPT、DeepSeek、Claude 等多种 AI 模型
- 🎨 **精美界面**：现代化 UI 设计，支持亮色/暗色主题和 Notion 风格预设
- 💭 **深度思考**：支持 AI 思考过程折叠显示，一键展开查看推理过程
- 📝 **流式输出**：类似 ChatGPT 的实时逐字显示效果
- 🔢 **数学公式**：支持 LaTeX/KaTeX 数学公式渲染
- 💻 **代码高亮**：带语言标签和一键复制功能的代码块
- 👥 **用户管理**：完整的用户认证系统，支持管理员和普通用户角色
- 💬 **会话管理**：多会话支持，本地存储聊天历史
- 🖼️ **文件处理**：支持图片、PDF、Word 文档上传和处理
- ⚙️ **自定义配置**：管理员面板配置 API 和添加自定义模型
- 📱 **响应式设计**：完美适配桌面和移动设备
- 🐳 **Docker 部署**：一键 Docker Compose 部署

## 🛠️ 技术栈

| 前端 | 后端 | 数据库 | 部署 |
|------|------|--------|------|
| React 19 | Express.js | MySQL 8.0 | Docker |
| TypeScript | TypeScript | - | Nginx |
| Vite | JWT Auth | - | Docker Compose |
| Tailwind CSS | - | - | - |
| KaTeX | - | - | - |

## 🚀 快速开始

### 方式一：Docker Compose 部署（推荐）

最简单的部署方式，自动配置 MySQL、后端和前端服务。

```bash
# 克隆项目
git clone https://github.com/your-username/forsion-ai-studio.git
cd forsion-ai-studio

# 配置环境变量（可选，使用默认值也可以）
# 如果需要自定义配置，可以创建 .env 文件，参考下面的环境变量说明

# 一键启动所有服务（包括 MySQL、后端、前端）
# 注意：由于 MySQL 服务使用了 profiles，需要显式指定 --profile mysql
docker compose --profile mysql up -d

# 或者如果只需要启动后端和前端（使用外部 MySQL）
# docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

启动后访问：
- **前端界面**：http://localhost:8080
- **管理后台**：http://localhost:8080/admin
- **API 服务**：http://localhost:8080/api（通过 Nginx 代理）

默认管理员账号：`admin` / `Admin123!@#`

> **提示**：如果需要更简单的部署体验，可以移除 `docker-compose.yml` 中 MySQL 服务的 `profiles: [mysql]` 配置，这样 `docker compose up -d` 就会自动启动所有服务。

### 方式二：手动本地开发

#### 1. 环境要求

- Node.js 18+
- MySQL 8.0+
- npm 或 yarn

#### 2. 配置 MySQL 数据库

```sql
-- 登录 MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE forsion_ai_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用用户（可选）
CREATE USER 'forsion'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON forsion_ai_studio.* TO 'forsion'@'localhost';
FLUSH PRIVILEGES;
```

#### 3. 启动后端服务

```bash
cd server-node

# 安装依赖
npm install

# 配置环境变量
cp env.example .env
# 编辑 .env 文件，设置数据库连接信息

# 初始化数据库
npm run db:migrate
npm run db:seed

# 启动开发服务器
npm run dev
```

#### 4. 启动前端服务

```bash
# 进入前端目录
cd client

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端默认运行在 http://localhost:50173，后端在 http://localhost:3001

## 📖 部署教程

详细的生产环境部署指南请参考 [DEPLOY.md](./DEPLOY.md)，包括：


- Linux 服务器部署
- MySQL 配置详解
- 环境变量配置
- Nginx 反向代理
- HTTPS 配置
- 自动部署脚本

## 🔧 配置说明

### 环境变量

#### 后端 (`server-node/.env`)

```env
# 服务端口
PORT=3001
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=forsion_ai_studio

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# 管理员默认凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
```

#### Docker Compose (`.env`)

```env
# MySQL 配置
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=forsion_ai_studio
MYSQL_USER=forsion
MYSQL_PASSWORD=forsion123

# 后端配置（可选，使用默认值也可以）
PORT=3002
DB_HOST=mysql
DB_PORT=3306
DB_USER=forsion
DB_PASSWORD=forsion123
DB_NAME=forsion_ai_studio

# JWT 密钥（生产环境务必修改）
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# 前端端口（可选，默认 8080）
FRONTEND_PORT=8080
```

> **注意**：前端会自动检测 API 地址，无需手动配置 `VITE_API_URL`。

### 管理员面板

访问 `/admin` 进入管理员面板，功能包括：

- **用户管理**：创建、编辑、删除用户
- **模型管理**：添加自定义 AI 模型，配置 API 密钥
- **使用统计**：查看 API 调用统计

## 🔍 常见问题与故障排查

### 数据库初始化

#### 问题：数据库表结构缺失

**症状**：后端日志中出现类似错误：
- `Unknown column 'avatar' in 'field list'`
- `Table 'forsion_ai_studio.user_credits' doesn't exist`
- `Table 'forsion_ai_studio.invite_codes' doesn't exist`

**解决方案**：

在生产环境中，由于容器只包含编译后的代码，不能使用 `npm run db:migrate`。需要手动执行 SQL 或使用编译后的迁移脚本：

```bash
# 方法一：直接运行编译后的迁移脚本（推荐）
docker compose exec backend node dist/db/migrate.js
docker compose exec backend node dist/db/seed.js

# 方法二：手动执行 SQL 修复
# 添加缺失的字段
docker compose exec mysql mysql -u root -prootpassword forsion_ai_studio -e "
ALTER TABLE global_models 
  ADD COLUMN avatar MEDIUMTEXT AFTER icon,
  ADD COLUMN prompt_caching_enabled BOOLEAN DEFAULT FALSE AFTER is_enabled,
  ADD COLUMN system_prompt TEXT AFTER prompt_caching_enabled,
  ADD COLUMN cacheable_content TEXT AFTER system_prompt;
" 2>/dev/null || echo "字段可能已存在"

# 创建缺失的表
docker compose exec mysql mysql -u root -prootpassword forsion_ai_studio << 'EOF'
CREATE TABLE IF NOT EXISTS user_credits (
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

CREATE TABLE IF NOT EXISTS invite_codes (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT DEFAULT 0,
  initial_credits DECIMAL(10, 2) DEFAULT 0.00,
  created_by VARCHAR(36),
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
EOF

# 重启后端服务
docker compose restart backend
```

#### 问题：数据库连接失败

**症状**：后端日志显示 `ECONNREFUSED` 或 `Failed to connect to database`

**解决方案**：

```bash
# 1. 检查 MySQL 是否正常运行
docker compose ps mysql

# 2. 等待 MySQL 完全启动（约 30 秒）
docker compose exec mysql mysqladmin ping -h localhost -u root -prootpassword

# 3. 检查数据库连接配置
docker compose exec backend env | grep DB_

# 4. 重启后端服务
docker compose restart backend
```

### 端口配置问题

#### 问题：访问地址不正确

**症状**：访问 `http://localhost:8080` 返回其他服务（如 WordPress）的页面

**解决方案**：

1. **检查实际端口映射**：
   ```bash
   docker compose ps
   # 查看前端容器的 PORTS 列，确认实际映射的端口
   ```

2. **检查环境变量配置**：
   ```bash
   cat .env | grep FRONTEND_PORT
   # 如果设置了 FRONTEND_PORT=1111，则访问 http://localhost:1111
   ```

3. **使用正确的访问地址**：
   - 前端：`http://localhost:实际端口`（可能是 1111 或其他）
   - 后端直接访问：`http://localhost:3002/api/health`
   - 管理后台：`http://localhost:实际端口/admin`

### 认证问题

#### 问题：401 Unauthorized 或 "Invalid or expired token"

**症状**：管理后台或 API 请求返回 401 错误

**解决方案**：

1. **清除浏览器存储并重新登录**：
   ```javascript
   // 在浏览器 Console 中执行
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

2. **检查 JWT_SECRET 配置**：
   ```bash
   # 确保 .env 中的 JWT_SECRET 已设置
   cat .env | grep JWT_SECRET
   
   # 确保后端使用了正确的密钥
   docker compose exec backend env | grep JWT_SECRET
   
   # 如果不同，统一配置后重启
   docker compose restart backend
   ```

3. **重新登录获取新 token**：
   - 访问主页面：`http://localhost:实际端口/`
   - 使用管理员账号登录：`admin` / `Admin123!@#`
   - 登录成功后再访问管理后台

### 查看日志和调试

#### 查看服务日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mysql

# 查看最近 100 行日志
docker compose logs --tail=100 backend

# 过滤错误日志
docker compose logs backend | grep -i error
```

#### 检查服务状态

```bash
# 查看所有服务状态
docker compose ps

# 检查服务健康状态
docker compose ps | grep healthy

# 测试 API 健康检查
curl http://localhost:实际端口/api/health
curl http://localhost:3002/api/health
```

#### 进入容器调试

```bash
# 进入后端容器
docker compose exec backend sh

# 进入 MySQL 容器
docker compose exec mysql mysql -u root -prootpassword

# 检查环境变量
docker compose exec backend env | grep -E "DB_|JWT|PORT"
```

### 完整修复脚本

如果遇到多个数据库问题，可以使用以下一键修复脚本：

```bash
cat > fix-database.sh << 'EOF'
#!/bin/bash
MYSQL_PASS="${MYSQL_ROOT_PASSWORD:-rootpassword}"

echo "🔧 修复数据库结构..."

# 添加缺失字段
docker compose exec mysql mysql -u root -p"$MYSQL_PASS" forsion_ai_studio -e "
ALTER TABLE global_models 
  ADD COLUMN avatar MEDIUMTEXT AFTER icon,
  ADD COLUMN prompt_caching_enabled BOOLEAN DEFAULT FALSE AFTER is_enabled,
  ADD COLUMN system_prompt TEXT AFTER prompt_caching_enabled,
  ADD COLUMN cacheable_content TEXT AFTER system_prompt;
" 2>/dev/null || echo "字段可能已存在"

# 创建缺失的表
docker compose exec mysql mysql -u root -p"$MYSQL_PASS" forsion_ai_studio << 'SQL'
CREATE TABLE IF NOT EXISTS user_credits (
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

CREATE TABLE IF NOT EXISTS invite_codes (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT DEFAULT 0,
  initial_credits DECIMAL(10, 2) DEFAULT 0.00,
  created_by VARCHAR(36),
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL

docker compose restart backend
echo "✅ 修复完成！"
EOF

chmod +x fix-database.sh
./fix-database.sh
```

## 📁 项目结构

```
forsion-ai-studio/
├── client/                 # 前端代码 (React + Vite)
│   ├── App.tsx            # 主应用组件
│   ├── index.tsx          # 入口文件
│   ├── index.html         # HTML 模板
│   ├── components/        # React 组件
│   │   ├── ChatArea.tsx   # 聊天区域
│   │   ├── Sidebar.tsx    # 侧边栏
│   │   └── SettingsModal.tsx # 设置弹窗
│   ├── services/          # 服务层
│   │   ├── authService.ts # 认证服务
│   │   ├── backendService.ts # 后端 API
│   │   ├── geminiService.ts # Gemini API
│   │   └── externalApiService.ts # 外部 API
│   ├── types.ts           # 类型定义
│   ├── constants.ts       # 常量配置
│   ├── config.ts          # 运行时配置
│   ├── vite.config.ts     # Vite 配置
│   ├── tsconfig.json      # TypeScript 配置
│   └── package.json       # 前端依赖
├── server-node/           # 后端代码 (Node.js + Express)
│   ├── src/
│   │   ├── index.ts       # 入口文件
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务逻辑
│   │   ├── middleware/    # 中间件
│   │   ├── config/        # 配置文件
│   │   ├── db/            # 数据库相关
│   │   └── types/         # 类型定义
│   ├── Dockerfile         # 后端 Docker
│   ├── tsconfig.json      # TypeScript 配置
│   └── package.json       # 后端依赖
├── admin/                 # 管理面板 (静态 HTML)
│   └── index.html         # 管理界面
├── docker-compose.yml     # Docker 编排
├── Dockerfile             # 前端 Docker
├── nginx.conf             # Nginx 配置
└── README.md              # 项目文档
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
