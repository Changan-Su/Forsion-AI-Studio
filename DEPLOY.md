# Forsion AI Studio 部署指南

本指南详细介绍如何在生产环境中部署 Forsion AI Studio。

## 📋 目录

- [环境要求](#环境要求)
- [Docker Compose 部署（推荐）](#docker-compose-部署推荐)
- [手动部署](#手动部署)
- [MySQL 配置详解](#mysql-配置详解)
- [Nginx 反向代理](#nginx-反向代理)
- [HTTPS 配置](#https-配置)
- [常见问题](#常见问题)

## 环境要求

- **操作系统**：Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / Windows Server 2019+
- **Docker**：20.10+ 和 Docker Compose v2
- **内存**：至少 2GB 可用内存
- **磁盘**：至少 5GB 可用空间
- **端口**：80（HTTP）、443（HTTPS，可选）、3306（MySQL，可选外部访问）

## Docker Compose 部署（推荐）

这是最简单的部署方式，一个命令启动所有服务。

### 1. 安装 Docker

#### Ubuntu/Debian

```bash
# 更新系统
sudo apt-get update

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

#### CentOS/RHEL

```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
```

#### Windows

下载并安装 [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)

### 2. 获取项目代码

```bash
git clone https://github.com/your-username/forsion-ai-studio.git
cd forsion-ai-studio
```

### 3. 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置安全的密码：

```env
# MySQL 配置
MYSQL_ROOT_PASSWORD=YourSecureRootPassword123!
MYSQL_DATABASE=forsion_ai_studio
MYSQL_USER=forsion
MYSQL_PASSWORD=YourSecurePassword123!

# JWT 密钥（务必修改为随机字符串）
JWT_SECRET=your-very-long-random-secret-key-at-least-32-characters

# 前端 API 地址（Docker 内网使用，无需修改）
VITE_API_URL=http://localhost:3001
```

> ⚠️ **安全提示**：生产环境中务必修改默认密码！

### 4. 启动服务

```bash
# 构建并启动所有服务（后台运行）
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 仅查看后端日志
docker compose logs -f backend
```

### 5. 初始化数据库

首次启动后，需要初始化数据库表和管理员账号：

```bash
# 进入后端容器
docker compose exec backend sh

# 运行数据库迁移（创建所有表和字段，包括用户设置、模型等）
npm run migrate
# 或使用完整命令
npm run db:migrate

# 运行数据库种子（创建管理员账号）
npm run db:seed

# 退出容器
exit
```

> **注意**：数据库迁移会自动创建以下字段：
> - `user_settings` 表：`nickname`、`avatar`、`theme`、`theme_preset`、`developer_mode` 等
> - `global_models` 表：`avatar`、`prompt_caching_enabled`、`system_prompt` 等
> 
> 如果遇到字段已存在的警告，可以忽略（迁移脚本会自动跳过已存在的字段）。

### 6. 访问服务

- **前端界面**：http://your-server-ip
- **管理后台**：http://your-server-ip/admin
- **API 健康检查**：http://your-server-ip/api/health

默认管理员账号：
- 用户名：`admin`
- 密码：`Admin123!@#`

> ⚠️ **首次登录后请立即修改管理员密码！**

### 7. 常用命令

```bash
# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 会删除数据库数据）
docker compose down -v

# 重新构建镜像
docker compose build --no-cache

# 重启服务
docker compose restart

# 更新代码后重新部署
git pull
docker compose down
docker compose build
docker compose up -d
```

---

## MySQL 配置详解

### Docker Compose 中的 MySQL

在 `docker-compose.yml` 中，MySQL 服务配置如下：

```yaml
mysql:
  image: mysql:8.0
  container_name: forsion_mysql
  environment:
    MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword}
    MYSQL_DATABASE: ${MYSQL_DATABASE:-forsion_ai_studio}
    MYSQL_USER: ${MYSQL_USER:-forsion}
    MYSQL_PASSWORD: ${MYSQL_PASSWORD:-forsion123}
  ports:
    - "3306:3306"  # 可移除以禁止外部访问
  volumes:
    - mysql_data:/var/lib/mysql
```

### 连接外部 MySQL 数据库

如果你想使用外部已有的 MySQL 数据库，而不是 Docker 中的：

1. 修改 `docker-compose.yml`，注释掉 mysql 服务
2. 修改后端环境变量：

```yaml
backend:
  environment:
    DB_HOST: your-mysql-host.com  # 外部 MySQL 地址
    DB_PORT: 3306
    DB_USER: your_username
    DB_PASSWORD: your_password
    DB_NAME: forsion_ai_studio
```

### 数据库管理命令

```bash
# 进入 MySQL 容器命令行
docker compose exec mysql mysql -u root -p

# 备份数据库
docker compose exec mysql mysqldump -u root -p forsion_ai_studio > backup.sql

# 恢复数据库
docker compose exec -T mysql mysql -u root -p forsion_ai_studio < backup.sql

# 查看数据库状态
docker compose exec mysql mysqladmin -u root -p status
```

### 创建只读用户（可选）

```sql
-- 进入 MySQL 后执行
CREATE USER 'readonly'@'%' IDENTIFIED BY 'readonly_password';
GRANT SELECT ON forsion_ai_studio.* TO 'readonly'@'%';
FLUSH PRIVILEGES;
```

### 数据库表结构说明

主要数据表包括：

- **users**：用户基本信息（用户名、密码、角色等）
- **user_settings**：用户设置表，包含：
  - `nickname`：用户昵称（可选）
  - `avatar`：用户头像（Base64 编码，MEDIUMTEXT 类型）
  - `theme`：主题模式（light/dark）
  - `theme_preset`：主题样式（default/notion/monet）
  - `custom_models`：用户自定义模型列表（JSON）
  - `external_api_configs`：外部 API 配置（JSON）
  - `developer_mode`：开发者模式开关
- **global_models**：全局模型配置（管理员管理）
- **user_credits**：用户积分余额
- **api_usage_logs**：API 使用日志

> **注意**：所有用户设置（包括主题配置、昵称、头像）都会自动保存到 `user_settings` 表中，支持跨设备同步。

---

## 手动部署

如果你不想使用 Docker，可以手动部署各个组件。

### 1. 安装 Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证
node --version  # 应显示 v18.x.x
npm --version
```

### 2. 安装 MySQL

```bash
# Ubuntu/Debian
sudo apt-get install mysql-server

# CentOS/RHEL
sudo yum install mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

### 3. 配置 MySQL

```bash
# 安全配置
sudo mysql_secure_installation

# 登录 MySQL
sudo mysql -u root -p
```

```sql
-- 创建数据库
CREATE DATABASE forsion_ai_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER 'forsion'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON forsion_ai_studio.* TO 'forsion'@'localhost';
FLUSH PRIVILEGES;

-- 验证
SHOW DATABASES;
exit;
```

### 4. 部署后端

```bash
cd forsion-ai-studio/server-node

# 安装依赖
npm install

# 创建环境配置
cat > .env << EOF
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=forsion
MYSQL_PASSWORD=YourSecurePassword123!
MYSQL_DATABASE=forsion_ai_studio
JWT_SECRET=$(openssl rand -hex 32)
PORT=3001
EOF

# 构建 TypeScript
npm run build

# 初始化数据库
npm run migrate
# 或使用完整命令
npm run db:migrate
npm run db:seed

# 启动服务（开发模式）
npm run dev

# 或生产模式
npm start
```

### 5. 使用 PM2 管理后端进程（推荐）

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动服务
pm2 start dist/index.js --name forsion-backend

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 status
pm2 logs forsion-backend
pm2 restart forsion-backend
```

### 6. 部署前端

```bash
cd forsion-ai-studio

# 安装依赖
npm install

# 设置 API 地址
export VITE_API_URL=http://localhost:3001

# 构建生产版本
npm run build

# 构建产物在 dist 目录
ls dist/
```

---

## Nginx 反向代理

### 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt-get install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 配置 Nginx

创建配置文件 `/etc/nginx/sites-available/forsion`:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或 IP

    # 前端静态文件
    root /var/www/forsion-ai-studio/dist;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    # 管理后台代理
    location /admin {
        proxy_pass http://127.0.0.1:3001/admin;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/forsion /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## HTTPS 配置

使用 Let's Encrypt 免费 SSL 证书：

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书（替换域名）
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 常见问题

### Q: Docker 启动后无法连接数据库？

A: 等待 MySQL 完全启动（约 30 秒），然后检查：
```bash
docker compose logs mysql
docker compose exec mysql mysqladmin -u root -p ping
```

### Q: 前端无法访问 API？

A: 检查：
1. 后端服务是否正常运行：`docker compose logs backend`
2. API 是否可访问：`curl http://localhost:3001/api/health`
3. Nginx 配置是否正确

### Q: 如何修改管理员密码？

A: 登录管理后台 `/admin`，在用户管理中修改密码。或通过 MySQL：
```sql
-- 生成新密码哈希（Node.js bcrypt）
-- 然后更新数据库
UPDATE users SET password_hash = 'new_hash' WHERE username = 'admin';
```

### Q: 如何添加 AI 模型？

A: 
1. 登录管理后台 `/admin`
2. 进入「模型管理」
3. 点击「添加模型」
4. 填写模型信息和 API 配置

### Q: 数据库连接超时？

A: 检查 MySQL 配置：
```sql
SHOW VARIABLES LIKE 'wait_timeout';
SHOW VARIABLES LIKE 'max_connections';
```

增加超时时间：
```sql
SET GLOBAL wait_timeout = 28800;
SET GLOBAL interactive_timeout = 28800;
```

### Q: 数据库字段缺失错误（如 `Unknown column 'developer_mode'`）？

A: 这通常发生在升级现有数据库时。运行数据库迁移来添加缺失的字段：

```bash
# 方法一：使用迁移脚本（推荐）
docker compose exec backend npm run migrate

# 方法二：如果容器中没有 npm，直接运行编译后的脚本
docker compose exec backend node dist/db/migrate.js
```

迁移脚本会自动检测并添加缺失的字段：
- `user_settings` 表：`nickname`、`avatar`、`developer_mode`
- `global_models` 表：`avatar`、`prompt_caching_enabled`、`system_prompt`、`cacheable_content`

如果迁移脚本无法运行，可以手动执行 SQL：

```bash
# 进入 MySQL 容器
docker compose exec mysql mysql -u root -p

# 执行以下 SQL（替换密码）
```

```sql
USE forsion_ai_studio;

-- 添加 user_settings 表缺失字段（如果字段已存在会报错，可以忽略）
ALTER TABLE user_settings ADD COLUMN nickname VARCHAR(100) AFTER user_id;
ALTER TABLE user_settings ADD COLUMN avatar MEDIUMTEXT AFTER nickname;
ALTER TABLE user_settings ADD COLUMN developer_mode BOOLEAN DEFAULT FALSE AFTER external_api_configs;

-- 添加 global_models 表缺失字段（如果字段已存在会报错，可以忽略）
ALTER TABLE global_models ADD COLUMN avatar MEDIUMTEXT AFTER icon;
ALTER TABLE global_models ADD COLUMN prompt_caching_enabled BOOLEAN DEFAULT FALSE AFTER is_enabled;
ALTER TABLE global_models ADD COLUMN system_prompt TEXT AFTER prompt_caching_enabled;
ALTER TABLE global_models ADD COLUMN cacheable_content TEXT AFTER system_prompt;
```

> **注意**：如果字段已存在，MySQL 会返回错误 `Duplicate column name`，这是正常的，可以忽略。建议使用迁移脚本自动处理。

#### 详细故障排查步骤

**1. 识别错误**

常见错误信息：
- `Unknown column 'nickname' in 'field list'`
- `Unknown column 'avatar' in 'field list'`
- `Unknown column 'developer_mode' in 'field list'`
- `Unknown column 'theme_preset' in 'field list'`

这些错误通常出现在：
- 保存用户设置时（PUT `/api/settings`）
- 保存个人资料时（昵称、头像）
- 切换主题时

**2. 完整解决流程**

```bash
# 步骤 1：停止服务（可选，建议在维护窗口进行）
docker compose stop backend

# 步骤 2：运行数据库迁移
docker compose exec backend npm run migrate

# 步骤 3：验证迁移结果
docker compose exec mysql mysql -u root -p -e "USE forsion_ai_studio; DESCRIBE user_settings;"

# 步骤 4：重启后端服务
docker compose restart backend

# 步骤 5：检查日志确认无错误
docker compose logs backend --tail=50
```

**3. 验证修复**

迁移成功后，验证字段是否存在：

```bash
# 方法一：使用 DESCRIBE 命令
docker compose exec mysql mysql -u root -p -e "USE forsion_ai_studio; DESCRIBE user_settings;"

# 方法二：查询字段信息
docker compose exec mysql mysql -u root -p -e "USE forsion_ai_studio; SHOW COLUMNS FROM user_settings LIKE 'nickname';"
```

应该能看到以下字段：
- `nickname` (VARCHAR(100))
- `avatar` (MEDIUMTEXT)
- `theme` (VARCHAR(20))
- `theme_preset` (VARCHAR(50))
- `developer_mode` (BOOLEAN)

**4. 如果使用外部 MySQL**

如果使用外部 MySQL 数据库（非 Docker 容器）：

```bash
# 直接连接 MySQL
mysql -u your_username -p forsion_ai_studio

# 然后执行上面的 SQL 语句
```

**5. 完整更新流程（首次部署或升级）**

如果是首次部署或从旧版本升级：

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建并启动
docker compose down
docker compose build --no-cache
docker compose up -d

# 3. 等待服务启动（MySQL 需要约 30 秒）
sleep 30

# 4. 运行数据库迁移（关键步骤！）
docker compose exec backend npm run migrate

# 5. 验证服务状态
docker compose ps
docker compose logs backend --tail=50

# 6. 测试功能
# 访问前端，尝试保存个人资料、切换主题等操作
```

**6. 常见问题**

- **问题**：迁移脚本报错 `npm: command not found`
  - **解决**：使用 `node dist/db/migrate.js` 直接运行编译后的脚本

- **问题**：迁移后仍然报错
  - **解决**：检查后端服务是否重启，清除浏览器缓存，检查数据库连接配置

- **问题**：字段已存在但仍报错
  - **解决**：检查字段类型是否匹配，可能需要删除重建字段（谨慎操作，先备份数据）

---

## 部署脚本

项目提供了自动化部署脚本：

```bash
# Linux/macOS
chmod +x deploy.sh
./deploy.sh

# Windows PowerShell
.\deploy.ps1
```

脚本会自动：
1. 检查环境依赖
2. 克隆/更新代码
3. 配置环境变量
4. 启动 Docker 服务
5. 初始化数据库（运行迁移脚本，创建所有表和字段）

> **重要**：首次部署或升级后，确保数据库迁移已成功运行。迁移脚本会创建：
> - 所有必需的数据表
> - 用户设置字段（nickname、avatar、theme、theme_preset、developer_mode 等）
> - 模型相关字段（avatar、prompt_caching_enabled 等）
> 
> 如果遇到字段缺失错误，请参考上面的"数据库字段缺失错误"解决方案。

---

## 监控和日志

### 查看容器资源使用

```bash
docker stats
```

### 日志管理

```bash
# 实时查看所有日志
docker compose logs -f

# 查看最近 100 行日志
docker compose logs --tail=100 backend

# 导出日志
docker compose logs backend > backend.log
```

### 健康检查

```bash
# API 健康检查
curl http://localhost/api/health

# MySQL 健康检查
docker compose exec mysql mysqladmin -u root -p ping
```

---

如有问题，请提交 Issue 或联系维护者。

