<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Forsion Calendar

一个由 **Google Gemini AI** 驱动的智能日历和待办事项助手，能够将自然语言解析为结构化日程安排，智能管理任务和待办事项，记录日常笔记和想法，并通过对话界面与用户交互。

View your app in AI Studio: https://ai.studio/apps/drive/1kWv7DB2EP1TrawefYaNQj0f-MqJm3EA6

## 📖 项目介绍

Forsion Calendar 是一个智能日历应用，包含前端应用和后端管理服务两部分：

- **前端应用**：提供日历视图、待办事项管理、笔记记录和 AI 对话界面
- **后端管理服务**：集中管理 AI 助手的提示词工程、API Keys 安全存储以及系统设置

### 核心功能

- 📅 **智能日程解析**：将自然语言解析为结构化日程安排
- ✅ **任务管理**：智能管理任务和待办事项
- 📝 **笔记记录**：记录日常笔记和想法
- 🤖 **AI 对话**：通过对话界面与用户交互
- 🔧 **配置管理**：可视化编辑 AI 提示词和系统设置
- 🔐 **安全存储**：API Keys 安全存储在服务器端

## 📁 项目结构

```
Forsion-Calendar/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── services/           # 服务层（API、配置等）
│   ├── utils/              # 工具函数
│   ├── App.tsx             # 主应用组件
│   ├── index.tsx           # 入口文件
│   ├── types.ts            # TypeScript 类型定义
│   └── constants.ts        # 常量定义
├── backend/                # 后端管理服务
│   ├── server.js           # Express 服务器
│   ├── config.json         # 后端配置文件
│   └── public/             # 后端静态文件（管理界面）
├── docs/                   # 文档
│   ├── DEVELOPMENT.md      # 开发文档
│   └── PRODUCT_ROADMAP.md  # 产品路线图
├── index.html              # HTML 入口文件
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
└── package.json            # 依赖配置
```

## 🚀 快速开始

**Prerequisites:** Node.js

### 1. 安装依赖

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd backend
npm install
cd ..
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件（可以参考 `.env.example` 文件）：

```bash
# 复制示例文件（如果存在）
cp .env.example .env
```

然后编辑 `.env` 文件，设置你的配置：

```env
# Gemini API Key（必填）
GEMINI_API_KEY=your-api-key-here

# 前端端口 (默认: 6006)
VITE_PORT=6006

# 后端端口 (默认: 3001)
PORT=3001

# 前端连接后端的地址 (默认: http://localhost:3001)
# 如果修改了后端端口，需要同时修改此地址
VITE_BACKEND_URL=http://localhost:3001

# MySQL 数据库配置（后端必需）
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=forsion_calendar
```

**注意：**
- `.env` 文件已添加到 `.gitignore`，不会被提交到 Git
- 前后端都会自动读取项目根目录的 `.env` 文件
- 如果你更喜欢使用命令行环境变量，也可以直接在启动时设置（会覆盖 .env 文件中的值）

### 3. 配置 MySQL 数据库

后端现在使用 MySQL 数据库存储配置数据。请确保：

1. **MySQL 已安装并运行**（推荐版本 5.7+ 或 8.0+）
2. **创建数据库用户和密码**（或使用 root 用户）
3. **在 `.env` 文件中配置数据库连接信息**

**初始化数据库：**
```bash
cd backend
npm run init-db
```

此命令会：
- 创建数据库（如果不存在）
- 创建所需的表（api_keys, prompts, settings）
- 验证数据库连接

**数据迁移（可选）：**

如果你之前使用的是 `config.json` 文件，后端会在首次启动时自动检测并迁移数据到 MySQL。你也可以通过 API 手动触发迁移：

```bash
curl -X POST http://localhost:3001/api/migrate
```

### 4. 启动项目

**启动后端服务：**
```bash
cd backend
npm run dev
```

后端服务默认运行在 `http://localhost:3001`，访问该地址可以看到可视化管理面板。

**启动前端服务：**
```bash
npm run dev
```

前端默认运行在 `http://localhost:6006`。

## 🛠️ 功能特性

### 前端功能

- **日历视图**：可视化查看和管理日程安排
- **待办事项**：任务列表管理和完成状态追踪
- **笔记记录**：日常笔记和想法的记录与管理
- **AI 对话**：通过自然语言与 AI 助手交互
- **设置管理**：个性化设置和偏好配置

### 后端管理功能

#### 1. 提示词工程（Prompt Engineering）

- **可视化编辑**：通过 Web 界面直接编辑系统提示词，无需修改代码
- **多模板管理**：支持创建和管理多个提示词模板，方便不同场景使用
- **启用/禁用控制**：可以临时禁用某个提示词而不删除，方便 A/B 测试
- **实时预览**：编辑时实时查看提示词内容，支持字符统计
- **版本追踪**：自动记录最后修改时间，便于追踪变更历史
- **动态变量**：支持在提示词中使用动态变量（如当前日期时间）

#### 2. API Keys 安全管理

- **安全存储**：API Keys 存储在 MySQL 数据库中，不会暴露给前端
- **脱敏显示**：在管理界面中自动脱敏显示（如 `abcd****xyz`），保护敏感信息
- **一键更新**：通过 RESTful API 或管理界面快速更新 API Key
- **原始值获取**：前端通过专用接口获取原始 API Key（仅用于 API 调用）
- **多 Keys 支持**：支持管理多个不同服务的 API Keys（如 Gemini、OpenAI 等）

#### 3. 系统设置管理

- **默认模型选择**：配置 AI 模型（如 `gemini-2.5-flash`、`gemini-pro` 等）
- **时区设置**：设置默认时区，确保时间相关功能正确工作
- **默认时长**：设置日程事件的默认持续时间（分钟）
- **调试模式**：开启/关闭调试日志，方便排查问题

#### 4. 调试和监控

- **调试日志**：记录所有 API 请求和响应（仅在调试模式下）
- **日志查看**：通过 Web 界面实时查看调试日志
- **日志管理**：支持清除日志、限制日志数量（最多 100 条）
- **状态查询**：查询调试模式状态和日志统计信息

## 📡 后端 API 接口

### 配置相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/config` | 获取所有配置（API Key 已脱敏） |
| GET | `/api/frontend-config` | 获取前端需要的配置（包含原始 API Key） |

### API Keys 管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/keys` | 获取所有 API Keys（已脱敏） |
| PUT | `/api/keys/:keyName` | 更新指定的 API Key |
| GET | `/api/keys/:keyName/raw` | 获取原始 API Key |

### 提示词管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/prompts` | 获取所有提示词 |
| GET | `/api/prompts/:id` | 获取单个提示词 |
| POST | `/api/prompts` | 创建新提示词 |
| PUT | `/api/prompts/:id` | 更新提示词 |
| DELETE | `/api/prompts/:id` | 删除提示词 |

### 设置管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/settings` | 获取系统设置 |
| PUT | `/api/settings` | 更新系统设置 |

### 调试功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/debug/status` | 获取调试模式状态和日志统计 |
| GET | `/api/debug/logs` | 获取调试日志（需开启调试模式） |
| POST | `/api/debug/log` | 添加调试日志（前端调用） |
| DELETE | `/api/debug/logs` | 清除所有调试日志 |

### 数据迁移

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/migrate` | 从 config.json 迁移数据到 MySQL |

## 💡 典型使用场景

### 场景 1：首次配置 API Key

1. 启动后端服务：`cd backend && npm run dev`
2. 访问管理界面：`http://localhost:3001`
3. 在 "API Keys" 部分输入你的 Gemini API Key
4. 点击保存，配置立即生效
5. 前端应用会自动从后端获取 API Key

### 场景 2：优化 AI 助手行为

1. 在管理界面打开 "提示词管理"
2. 编辑 `systemInstruction` 提示词
3. 添加新的规则或调整现有指令
4. 保存后，前端应用会自动使用新的提示词
5. 测试 AI 助手的响应是否符合预期
6. 如果不满意，继续调整提示词

### 场景 3：切换开发/生产环境

1. 在项目根目录创建 `.env` 文件
2. 设置不同的端口和配置：
   ```env
   # 开发环境
   PORT=3001
   
   # 生产环境
   PORT=8080
   ```
3. 使用环境变量启动服务
4. 前端通过 `VITE_BACKEND_URL` 环境变量连接对应的后端

### 场景 4：调试问题

1. 在系统设置中开启 "调试模式"
2. 访问 `/api/debug/logs` 查看请求日志
3. 分析日志找出问题原因
4. 修复后关闭调试模式

## 📁 配置文件说明

后端配置存储在 `backend/config.json` 文件中，结构如下：

```json
{
  "apiKeys": {
    "gemini": "your-api-key-here"
  },
  "prompts": {
    "systemInstruction": {
      "name": "提示词名称",
      "description": "提示词描述",
      "content": "提示词内容...",
      "enabled": true,
      "lastModified": "2025-12-10T00:00:00.000Z"
    }
  },
  "settings": {
    "defaultModel": "gemini-2.5-flash",
    "defaultTimezone": "Asia/Shanghai",
    "defaultDuration": 30,
    "enableDebugMode": false
  }
}
```

## 🔗 前后端集成

前端会自动尝试连接后端获取配置。如需修改后端地址，在前端项目根目录创建 `.env` 文件：

```env
# 如果修改了后端端口，需要设置此变量
VITE_BACKEND_URL=http://localhost:3001
```

**注意**：如果后端端口使用了非默认值（3001），前端必须设置 `VITE_BACKEND_URL` 指向正确的后端地址。

### 配置优先级

1. **API Key**: 后端配置 > 前端 localStorage > 环境变量
2. **System Instruction**: 后端配置 > 前端 constants.ts

## ⚠️ 安全注意

- 此后端服务仅用于开发调试，不应直接暴露在公网
- API Keys 存储在本地 config.json 文件中
- 生产环境建议使用环境变量或密钥管理服务
- API Keys 不会在日志中完整显示
- 前端只能通过授权接口获取密钥

## ❓ 常见问题

### Q1: 前端无法连接到后端？

**可能原因：**
- 后端服务未启动
- 端口配置不匹配
- CORS 配置问题

**解决方法：**
1. 确认后端服务正在运行：`cd backend && npm run dev`
2. 检查后端端口是否与 `VITE_BACKEND_URL` 一致
3. 查看浏览器控制台的错误信息
4. 确认防火墙没有阻止端口访问

### Q2: API Key 更新后前端仍使用旧值？

**解决方法：**
1. 前端会缓存配置，清除浏览器缓存或刷新页面
2. 检查前端是否正确调用了 `/api/frontend-config` 接口
3. 查看前端控制台是否有错误信息

### Q3: 提示词修改后没有生效？

**解决方法：**
1. 确认提示词的 `enabled` 字段为 `true`
2. 检查前端是否正确获取了最新配置
3. 查看 `/api/frontend-config` 返回的内容是否正确
4. 清除前端缓存后重试

### Q4: 数据库连接失败？

**解决方法：**
1. 确认 MySQL 服务正在运行
2. 检查 `.env` 文件中的数据库配置是否正确
3. 验证数据库用户权限（需要 CREATE、SELECT、INSERT、UPDATE、DELETE 权限）
4. 尝试使用 MySQL 客户端手动连接测试
5. 查看后端控制台的错误信息

### Q5: 数据迁移失败？

**解决方法：**
1. 确认 `config.json` 文件存在且格式正确
2. 检查数据库连接是否正常
3. 手动调用迁移接口：`curl -X POST http://localhost:3001/api/migrate`
4. 查看后端控制台的详细错误信息
5. 如果需要，可以手动清空数据库表后重新迁移

### Q6: 调试日志不显示？

**解决方法：**
1. 确认已在系统设置中开启 "调试模式"
2. 检查 `/api/debug/status` 接口返回的状态
3. 确认日志数量未超过限制（最多 100 条）
4. 尝试清除日志后重新触发操作

## 🔧 故障排除

### MySQL 数据库问题

#### 无法连接到 MySQL

**错误信息：** `Cannot connect to MySQL` 或 `ECONNREFUSED`

**解决方法：**
1. 确认 MySQL 服务正在运行：
   ```bash
   # Windows
   net start MySQL80  # 或你的 MySQL 服务名
   
   # Linux/Mac
   sudo systemctl status mysql
   # 或
   sudo service mysql status
   ```

2. 检查 `.env` 文件配置：
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=forsion_calendar
   ```

3. 测试数据库连接：
   ```bash
   mysql -h localhost -P 3306 -u root -p
   ```

#### 数据库权限不足

**错误信息：** `Access denied` 或 `CREATE command denied`

**解决方法：**
```sql
-- 使用 root 用户登录 MySQL，授予权限
GRANT ALL PRIVILEGES ON forsion_calendar.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

#### 首次启动数据库未初始化

**解决方法：**
```bash
cd backend
npm run init-db
```

### 端口被占用

如果启动时提示端口被占用：

```bash
# Windows - 查找占用端口的进程
netstat -ano | findstr :3001

# Linux/Mac - 查找占用端口的进程
lsof -i :3001

# 然后使用不同的端口
PORT=3002 npm run dev
```

### 数据库连接池耗尽

如果遇到 `Too many connections` 错误：

**解决方法：**
1. 检查是否有未关闭的连接
2. 重启后端服务
3. 调整 MySQL 最大连接数（在 MySQL 配置文件中）

```bash
# Linux/Mac - 确保文件有读写权限
chmod 644 backend/config.json

# Windows - 以管理员身份运行或检查文件属性
```

### 依赖安装失败

如果 `npm install` 失败：

```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

## 📝 技术栈

### 前端
- **React** + **TypeScript** - 前端框架
- **Vite** - 构建工具
- **Lucide React** - 图标库

### 后端
- **Node.js** + **Express** - 后端框架
- **Vanilla JS** - 管理界面（无依赖）
- **JSON** - 配置存储

## 📚 相关资源

- [Express.js 官方文档](https://expressjs.com/)
- [Google Gemini API 文档](https://ai.google.dev/docs)
- [React 官方文档](https://react.dev/)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

---

**最后更新**：2025年1月
