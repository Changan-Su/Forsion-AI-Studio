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
cp .env.example .env
# 编辑 .env 文件设置密码等

# 一键启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

启动后访问：
- **前端界面**：http://localhost
- **管理后台**：http://localhost/admin
- **API 服务**：http://localhost/api

默认管理员账号：`admin` / `Admin123!@#`

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
# 数据库配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=forsion_ai_studio

# JWT 密钥（生产环境务必修改）
JWT_SECRET=your-super-secret-jwt-key

# 服务端口
PORT=3001
```

#### Docker Compose (`.env`)

```env
# MySQL 配置
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=forsion_ai_studio
MYSQL_USER=forsion
MYSQL_PASSWORD=forsion123

# JWT 密钥
JWT_SECRET=your-super-secret-jwt-key

# 前端 API 地址（Docker 内部通信）
VITE_API_URL=http://localhost:3001
```

### 管理员面板

访问 `/admin` 进入管理员面板，功能包括：

- **用户管理**：创建、编辑、删除用户
- **模型管理**：添加自定义 AI 模型，配置 API 密钥
- **使用统计**：查看 API 调用统计

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
