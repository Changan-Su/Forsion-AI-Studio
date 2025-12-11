<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Forsion AI Studio

一个现代化、高性能的 AI 聊天平台，支持多种 AI 模型，包括 Gemini、OpenAI、DeepSeek 等，并提供企业级用户管理和自定义配置功能。

## ✨ 主要特性

- 🤖 **多模型支持**：内置支持 Gemini、OpenAI GPT、DeepSeek 等多种 AI 模型
- 🎨 **精美界面**：现代化 UI 设计，支持亮色/暗色主题和 Notion 风格预设
- 👥 **用户管理**：完整的用户认证系统，支持管理员和普通用户角色
- 💬 **会话管理**：多会话支持，本地存储聊天历史
- 🖼️ **图片处理**：支持图片上传和 AI 图片生成（Nano Banana）
- ⚙️ **自定义配置**：管理员可配置 API 密钥和添加自定义模型
- 📱 **响应式设计**：完美适配桌面和移动设备
- 🔒 **安全可靠**：基于 FastAPI 的后端，支持 CORS 和安全认证

## 🛠️ 技术栈

### 前端
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库
- **React Markdown** - Markdown 渲染

### 后端
- **FastAPI** - Python Web 框架
- **Uvicorn** - ASGI 服务器
- **MySQL** - 关系型数据库存储
- **SQLAlchemy** - ORM 框架

## 📋 功能列表

- ✅ 用户登录/登出
- ✅ 多模型切换（Gemini Flash、Gemini Pro、GPT-4o、DeepSeek 等）
- ✅ 聊天会话创建、删除和管理
- ✅ 图片附件上传和处理
- ✅ AI 图片生成（Nano Banana）
- ✅ 主题切换（亮色/暗色/Notion 风格）
- ✅ 管理员面板（用户管理、模型配置）
- ✅ API 密钥配置
- ✅ 自定义模型添加
- ✅ 离线模式支持

## 🚀 快速开始

### 环境要求

- **Node.js** 18+ 
- **Python** 3.11+
- **MySQL** 8.0+ (或 MariaDB 10.5+)
- **npm** 和 **pip** 已安装并配置在 PATH 中

### 本地开发

#### 1. 配置 API 地址

前端请求从 [`config.ts`](config.ts) 读取配置，优先使用环境变量 `VITE_API_URL`。

创建 `.env.local` 文件（或在 shell 中导出变量）：

```bash
# Windows PowerShell
$env:VITE_API_URL="http://localhost:3001/api"

# Linux/macOS
export VITE_API_URL=http://localhost:3001/api
```

如果未设置 `VITE_API_URL`，应用会自动回退到 `window.location.origin + '/api'` 或开发环境下的 `http://localhost:3001/api`。

#### 2. 配置 MySQL 数据库

首先创建数据库：

```sql
-- 登录 MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE forsion_ai_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 可选：创建专用用户
CREATE USER 'forsion'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON forsion_ai_studio.* TO 'forsion'@'localhost';
FLUSH PRIVILEGES;
```

#### 3. 启动后端服务

```bash
# 进入后端目录
cd server

# 创建虚拟环境（Windows）
python -m venv .venv
.\.venv\Scripts\activate

# 创建虚拟环境（Linux/macOS）
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置数据库环境变量
# Windows PowerShell
$env:MYSQL_HOST="localhost"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD="your_password"
$env:MYSQL_DATABASE="forsion_ai_studio"

# Linux/macOS
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your_password
export MYSQL_DATABASE=forsion_ai_studio

# 初始化数据库表（首次运行）
python -m server.init_db

# 如果需要从旧的 JSON 文件迁移数据
python -m server.init_db --migrate

# 启动服务（开发模式，支持热重载）
uvicorn server.main:app --host 0.0.0.0 --port 3001 --reload
```

后端服务将在 `http://localhost:3001` 启动。

#### 4. 启动前端服务（新终端窗口）

```bash
# 返回项目根目录
cd /path/to/Forsion-Ai-Studio

# 安装依赖
npm install

# 设置环境变量并启动开发服务器
# Windows PowerShell
$env:VITE_API_URL="http://localhost:3001/api"
npm run dev -- --port 5173

# Linux/macOS
export VITE_API_URL=http://localhost:3001/api
npm run dev -- --port 5173
```

前端服务将在 `http://localhost:5173` 启动。

#### 5. 登录系统

访问 http://localhost:5173，使用默认管理员账户登录：
- **用户名**: `admin`
- **密码**: `admin`

> 💡 默认管理员账户在首次启动时自动创建并存储在 MySQL 数据库中。

## 📦 生产环境部署

### Linux 服务器部署（推荐）

#### 快速部署

**方式 1：在仓库目录中运行（推荐，自动检测）**

```bash
# 1. 克隆仓库到服务器
git clone https://github.com/your-username/forsion-ai-studio.git
cd forsion-ai-studio

# 2. 设置 GitHub Token（私有仓库必需）
export GITHUB_TOKEN=your_github_token

# 3. 运行部署脚本（会自动检测仓库 URL 和分支）
chmod +x deploy.sh
./deploy.sh
```

**方式 2：从远程下载脚本运行**

```bash
# 设置环境变量
export GITHUB_REPO_URL=https://github.com/your-username/forsion-ai-studio.git
export GITHUB_TOKEN=your_github_token  # 私有仓库必需
export MYSQL_ROOT_PASSWORD=your_secure_password  # 可选

# 下载并运行部署脚本
wget https://raw.githubusercontent.com/your-username/forsion-ai-studio/main/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

> 💡 **提示**：脚本会自动检测当前 Git 仓库的 URL 和分支，无需手动设置 `GITHUB_REPO_URL`。

3. **启动服务**：
```bash
# 使用 systemd（推荐）
sudo systemctl start forsion-backend
sudo systemctl enable forsion-backend

# 或手动启动
cd /opt/forsion-ai-studio/server
source .venv/bin/activate
uvicorn server.main:app --host 0.0.0.0 --port 3001
```

详细部署说明请查看 [DEPLOY.md](DEPLOY.md)

### 手动部署

#### 后端部署

```bash
# 激活虚拟环境
cd server
source .venv/bin/activate  # Linux/macOS
# 或
.\.venv\Scripts\activate   # Windows

# 启动生产服务器
uvicorn server.main:app --host 0.0.0.0 --port 3001
```

#### 前端部署

```bash
# 构建生产版本
npm run build

# 使用 serve 启动静态服务器（临时方案）
npx serve -s dist -l 4173

# 或复制 dist/ 目录到 Nginx/Apache 根目录
```

确保设置 `VITE_API_URL` 环境变量或 `.env` 文件，指向 FastAPI 后端的公共 URL，以便编译后的前端能够正确访问 API。

### 使用 systemd 服务（Ubuntu/Linux 示例）

#### 创建后端服务

```bash
sudo tee /etc/systemd/system/forsion-backend.service >/dev/null <<'EOF'
[Unit]
Description=Forsion AI Studio Backend
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/Forsion-Ai-Studio
ExecStart=/path/to/.venv/bin/uvicorn server.main:app --host 0.0.0.0 --port 3001
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF
```

#### 创建前端服务

```bash
sudo tee /etc/systemd/system/forsion-frontend.service >/dev/null <<'EOF'
[Unit]
Description=Forsion AI Studio Frontend
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/Forsion-Ai-Studio
ExecStart=/usr/bin/npx serve -s dist -l 4173
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
```

#### 启用和管理服务

```bash
# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 启用服务（开机自启）
sudo systemctl enable forsion-backend forsion-frontend

# 启动服务
sudo systemctl start forsion-backend forsion-frontend

# 查看服务状态
sudo systemctl status forsion-backend forsion-frontend

# 查看日志
sudo journalctl -u forsion-backend -f
sudo journalctl -u forsion-frontend -f
```

> ⚠️ **注意**: 请根据实际情况调整 `WorkingDirectory`、`ExecStart` 路径和用户权限。重新部署时，只需拉取新代码、运行 `npm run build`，然后执行 `sudo systemctl restart forsion-backend forsion-frontend`。

### Docker Compose 部署（可选）

如果项目包含 `docker-compose.yml` 文件，可以使用以下命令：

```bash
# 构建镜像
docker compose build

# 启动服务（后台运行）
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

前端容器默认端口为 80，后端容器默认端口为 3001。如果通过同一域名代理，请在 `docker-compose.yml` 或构建参数中更新 `VITE_API_URL` 指向 `/api`。

## ⚙️ 配置说明

### API 密钥配置

1. 登录系统后，点击设置图标打开设置面板
2. 管理员用户可以：
   - 配置各个模型的 API 密钥（Gemini、OpenAI、DeepSeek 等）
   - 添加自定义模型
   - 设置默认模型
   - 管理用户账户

### 内置模型

项目内置了以下模型：

- **Gemini Flash** - 快速通用模型
- **Gemini Pro** - 高级推理模型
- **Nano Banana (Image)** - 图片生成模型
- **GPT-5 (Preview)** - 下一代推理模型
- **GPT-4o** - 旗舰智能模型
- **GPT-4o Mini** - 经济型小模型
- **DeepSeek V3** - DeepSeek 聊天模型
- **DeepSeek R1** - 高级推理模型（CoT）

### 主题配置

- **亮色/暗色主题**：在设置中切换
- **Notion 风格**：选择 Notion 预设获得类似 Notion 的界面风格

## 📁 项目结构

```
Forsion-Ai-Studio/
├── components/          # React 组件
│   ├── AdminPanel.tsx   # 管理员面板
│   ├── ChatArea.tsx     # 聊天区域
│   ├── SettingsModal.tsx # 设置模态框
│   └── Sidebar.tsx      # 侧边栏
├── services/            # 服务层
│   ├── authService.ts   # 认证服务
│   ├── backendService.ts # 后端 API 服务
│   ├── externalApiService.ts # 外部 API 服务
│   └── geminiService.ts # Gemini API 服务
├── server/              # Python 后端
│   ├── main.py         # FastAPI 主应用
│   ├── database.py     # MySQL 数据库连接配置
│   ├── models.py       # SQLAlchemy ORM 模型
│   ├── storage.py      # 数据存储逻辑
│   ├── init_db.py      # 数据库初始化脚本
│   └── requirements.txt # Python 依赖
├── deploy.sh           # Linux 服务器部署脚本
├── update.sh           # 更新脚本
├── docker-compose.yml  # Docker Compose 配置
├── DEPLOY.md           # 详细部署文档
├── App.tsx             # 主应用组件
├── config.ts           # 配置文件
├── constants.ts        # 常量定义
├── types.ts            # TypeScript 类型定义
├── package.json        # Node.js 依赖
└── vite.config.ts      # Vite 配置
```

## 🔧 开发指南

### 添加新模型

1. 在 `constants.ts` 的 `BUILTIN_MODELS` 数组中添加模型配置
2. 如果使用外部 API，确保在 `services/externalApiService.ts` 中实现相应的调用逻辑
3. 如果使用 Gemini API，在 `services/geminiService.ts` 中添加处理逻辑

### 自定义主题

主题样式通过 Tailwind CSS 配置，主要颜色定义在 `App.tsx` 中。可以修改：
- `theme` 状态（'light' | 'dark'）
- `themePreset` 状态（'default' | 'notion'）

## 📝 API 文档

后端 API 文档在运行后端服务后可通过以下地址访问：
- Swagger UI: `http://localhost:3001/docs`
- ReDoc: `http://localhost:3001/redoc`

主要 API 端点：
- `POST /api/auth/login` - 用户登录
- `GET /api/settings` - 获取设置
- `PUT /api/settings` - 更新设置
- `GET /api/admin/users` - 获取用户列表（管理员）
- `POST /api/admin/users` - 创建用户（管理员）

## 🐛 故障排除

### 后端无法启动
- 检查 Python 版本是否为 3.11+
- 确认虚拟环境已激活
- 检查端口 3001 是否被占用

### 前端无法连接后端
- 确认 `VITE_API_URL` 环境变量设置正确
- 检查后端服务是否正常运行
- 查看浏览器控制台的网络请求错误

### API 密钥错误
- 确认在管理员设置中正确配置了 API 密钥
- 检查 API 密钥是否有效且有足够的配额

## 📄 许可证

本项目为私有项目。

## 🔗 相关链接

- [AI Studio](https://ai.studio/apps/drive/11I6K3z9Ld4d4vb7lsmPPBH4YEam3j6Pu)
