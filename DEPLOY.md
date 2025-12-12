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

# 运行数据库迁移
npm run db:migrate

# 运行数据库种子（创建管理员账号）
npm run db:seed

# 退出容器
exit
```

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
5. 初始化数据库

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

