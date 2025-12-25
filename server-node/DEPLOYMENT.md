# Forsion Backend Service - 部署指南

本指南介绍如何将 Forsion Backend Service 部署到生产环境。

## 部署架构

```
┌─────────────────┐
│  Load Balancer  │ (可选)
└────────┬────────┘
         │
    ┌────┴────┐
    │  Nginx  │ (反向代理)
    └────┬────┘
         │
┌────────┴─────────────┐
│ Forsion Backend      │
│ Service (Node.js)    │
│ + Admin Panel        │
└──────────────────────┘
         │
    ┌────┴────┐
    │  MySQL  │
    └─────────┘
```

## Admin Panel

管理面板已内置在后端服务中，通过 `/admin` 路径访问。部署后端服务时，admin panel 会自动随服务一起部署，无需额外配置。

**访问地址**：`http://your-domain:3001/admin`

**功能**：
- 用户管理
- 模型管理
- API 使用统计
- 邀请码管理
- 系统监控

**认证**：使用管理员账号登录（在 `.env` 中配置的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`）

## 部署方式

### 方式一：Docker Compose 部署（推荐）

最简单的部署方式，适合单机部署。

#### 1. 准备环境

```bash
# 确保已安装 Docker 和 Docker Compose
docker --version
docker compose version

# 克隆项目
git clone https://github.com/your-org/forsion-backend.git
cd forsion-backend/server-node
```

#### 2. 配置环境变量

创建 `.env` 文件：

```env
# 服务配置
SERVICE_NAME=forsion-backend-service
PORT=3001
NODE_ENV=production

# CORS 配置（生产环境域名）
ALLOWED_ORIGINS=https://studio.example.com,https://desktop.example.com

# 数据库配置
DB_HOST=mysql
DB_PORT=3306
DB_USER=forsion
DB_PASSWORD=your_secure_password_here
DB_NAME=forsion_shared_db

# JWT 配置（务必修改为强密码）
JWT_SECRET=your-production-jwt-secret-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# 管理员凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123!@#

# 功能开关
ENABLE_INVITE_CODES=true
ENABLE_CREDIT_SYSTEM=true
```

#### 3. 创建 Docker Compose 文件

在项目根目录创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: forsion-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
    networks:
      - forsion-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./server-node
      dockerfile: Dockerfile
    container_name: forsion-backend
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3001:3001"
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - forsion-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  mysql_data:
    driver: local

networks:
  forsion-network:
    driver: bridge
```

#### 4. 启动服务

```bash
# 构建并启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f

# 查看服务状态
docker compose ps

# 等待数据库完全启动后，运行数据库迁移
docker compose exec backend node dist/db/migrate.js

# 可选：填充示例数据
docker compose exec backend node dist/db/seed.js
```

#### 5. 验证部署

```bash
# 检查健康状态
curl http://localhost:3001/api/health

# 检查服务信息
curl http://localhost:3001/api/info
```

---

### 方式二：传统服务器部署

适合在已有服务器上部署。

#### 1. 安装依赖

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm mysql-server nginx

# CentOS/RHEL
sudo yum install -y nodejs npm mysql-server nginx

# 确认版本
node --version  # 应该 >= 18
npm --version
mysql --version # 应该 >= 8.0
```

#### 2. 配置 MySQL

```bash
# 启动 MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置
sudo mysql_secure_installation

# 登录 MySQL
sudo mysql -u root -p

# 创建数据库和用户
CREATE DATABASE forsion_shared_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'forsion'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON forsion_shared_db.* TO 'forsion'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 3. 部署后端服务

```bash
# 创建部署目录
sudo mkdir -p /opt/forsion-backend
cd /opt/forsion-backend

# 克隆代码
git clone https://github.com/your-org/forsion-backend.git .
cd server-node

# 安装依赖
npm ci --production

# 配置环境变量
cp env.example .env
nano .env  # 编辑配置

# 构建 TypeScript
npm run build

# 运行数据库迁移
npm run migrate

# 测试启动
npm start
```

#### 4. 配置 PM2（进程管理）

```bash
# 安装 PM2
sudo npm install -g pm2

# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'forsion-backend',
    script: 'dist/index.js',
    cwd: '/opt/forsion-backend/server-node',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
    },
    error_file: '/var/log/forsion-backend/error.log',
    out_file: '/var/log/forsion-backend/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '500M',
  }]
};
EOF

# 创建日志目录
sudo mkdir -p /var/log/forsion-backend
sudo chown -R $USER:$USER /var/log/forsion-backend

# 启动服务
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs forsion-backend
```

#### 5. 配置 Nginx 反向代理

```bash
# 创建 Nginx 配置
sudo nano /etc/nginx/sites-available/forsion-backend
```

添加以下内容：

```nginx
upstream forsion_backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name api.example.com;

    # 日志
    access_log /var/log/nginx/forsion-backend-access.log;
    error_log /var/log/nginx/forsion-backend-error.log;

    # 客户端最大上传大小
    client_max_body_size 10M;

    # API 代理
    location /api/ {
        proxy_pass http://forsion_backend;
        proxy_http_version 1.1;
        
        # 请求头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE 支持（流式响应）
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }

    # 管理面板
    location /admin {
        proxy_pass http://forsion_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 健康检查
    location /api/health {
        proxy_pass http://forsion_backend;
        access_log off;
    }
}
```

启用配置：

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/forsion-backend /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

#### 6. 配置 HTTPS（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书并自动配置 Nginx
sudo certbot --nginx -d api.example.com

# 测试自动续期
sudo certbot renew --dry-run

# 设置自动续期（cron）
sudo crontab -e
# 添加以下行：
0 3 * * * certbot renew --quiet
```

---

### 方式三：云平台部署

#### AWS ECS

1. 构建 Docker 镜像并推送到 ECR
2. 创建 RDS MySQL 实例
3. 创建 ECS 任务定义
4. 配置 Application Load Balancer
5. 创建 ECS 服务

#### Google Cloud Run

```bash
# 构建镜像
gcloud builds submit --tag gcr.io/PROJECT_ID/forsion-backend

# 部署服务
gcloud run deploy forsion-backend \
  --image gcr.io/PROJECT_ID/forsion-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,DB_HOST=xxx"
```

#### Azure Container Instances

```bash
# 创建资源组
az group create --name forsion-rg --location eastus

# 创建容器实例
az container create \
  --resource-group forsion-rg \
  --name forsion-backend \
  --image yourregistry.azurecr.io/forsion-backend:latest \
  --dns-name-label forsion-api \
  --ports 3001
```

---

## 环境变量配置详解

### 必需变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `PORT` | 服务端口 | `3001` |
| `DB_HOST` | 数据库地址 | `localhost` 或 `mysql` (Docker) |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_USER` | 数据库用户 | `forsion` |
| `DB_PASSWORD` | 数据库密码 | `your_password` |
| `DB_NAME` | 数据库名称 | `forsion_shared_db` |
| `JWT_SECRET` | JWT 密钥 | 至少 32 字符的随机字符串 |

### 可选变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `JWT_EXPIRES_IN` | Token 过期时间 | `7d` |
| `ALLOWED_ORIGINS` | CORS 允许的来源 | 空（允许所有） |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | `admin` |
| `ENABLE_INVITE_CODES` | 启用邀请码 | `true` |
| `ENABLE_CREDIT_SYSTEM` | 启用积分系统 | `true` |

---

## 性能优化

### 1. 数据库优化

```sql
-- 添加索引
ALTER TABLE api_usage_logs ADD INDEX idx_composite (username, created_at, project_source);
ALTER TABLE user_credits ADD INDEX idx_balance (balance);

-- 配置 MySQL 性能参数 (/etc/mysql/my.cnf)
[mysqld]
max_connections = 200
innodb_buffer_pool_size = 2G
innodb_log_file_size = 512M
query_cache_type = 1
query_cache_size = 64M
```

### 2. Node.js 集群模式

PM2 已经配置为集群模式（2 个实例），可以根据 CPU 核心数调整：

```javascript
// ecosystem.config.js
instances: 'max',  // 使用所有 CPU 核心
```

### 3. Redis 缓存（可选）

```bash
# 安装 Redis
sudo apt install redis-server

# 安装 Redis 客户端
npm install redis
```

在代码中添加缓存：

```typescript
import { createClient } from 'redis';

const redisClient = createClient({
  url: 'redis://localhost:6379'
});

// 缓存模型列表
export async function getModels() {
  const cached = await redisClient.get('models');
  if (cached) {
    return JSON.parse(cached);
  }

  const models = await query('SELECT * FROM global_models WHERE is_enabled = 1');
  await redisClient.setEx('models', 300, JSON.stringify(models)); // 5 分钟缓存
  return models;
}
```

### 4. Nginx 缓存

```nginx
# 添加到 Nginx 配置
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m;

location /api/models {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_use_stale error timeout invalid_header updating;
    add_header X-Cache-Status $upstream_cache_status;
    
    proxy_pass http://forsion_backend;
}
```

---

## 监控和日志

### 1. PM2 监控

```bash
# 实时监控
pm2 monit

# Web 监控面板
pm2 plus
```

### 2. 日志管理

```bash
# 查看日志
pm2 logs forsion-backend

# 日志轮转配置 (/etc/logrotate.d/forsion-backend)
/var/log/forsion-backend/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. 健康检查脚本

```bash
#!/bin/bash
# /opt/forsion-backend/healthcheck.sh

HEALTH_URL="http://localhost:3001/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "[$(date)] Health check passed"
    exit 0
else
    echo "[$(date)] Health check failed with status $RESPONSE"
    # 可以添加告警逻辑
    exit 1
fi

# 添加到 crontab
# */5 * * * * /opt/forsion-backend/healthcheck.sh >> /var/log/forsion-health.log 2>&1
```

### 4. Prometheus + Grafana（可选）

安装 Prometheus exporter：

```bash
npm install prom-client
```

在 `src/index.ts` 中添加：

```typescript
import prometheus from 'prom-client';

const register = new prometheus.Registry();
prometheus.collectDefaultMetrics({ register });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## 备份策略

### 1. 数据库备份

```bash
#!/bin/bash
# /opt/forsion-backend/backup.sh

BACKUP_DIR="/backup/forsion"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="forsion_shared_db"

mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u forsion -p'your_password' $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 保留最近 7 天的备份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "[$(date)] Backup completed: db_$DATE.sql.gz"

# 添加到 crontab
# 0 2 * * * /opt/forsion-backend/backup.sh >> /var/log/forsion-backup.log 2>&1
```

### 2. 文件备份（如果有上传文件）

```bash
# 使用 rsync 同步到备份服务器
rsync -avz /opt/forsion-backend/uploads/ backup-server:/backup/forsion/uploads/
```

---

## 安全加固

### 1. 防火墙配置

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# 拒绝直接访问后端端口
sudo ufw deny 3001/tcp
```

### 2. 限制数据库访问

```sql
-- 只允许本地访问
UPDATE mysql.user SET Host='localhost' WHERE User='forsion';
FLUSH PRIVILEGES;
```

在 `/etc/mysql/mysql.conf.d/mysqld.cnf` 中：

```ini
bind-address = 127.0.0.1
```

### 3. 配置速率限制

安装 express-rate-limit：

```bash
npm install express-rate-limit
```

在 `src/index.ts` 中添加：

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 限制 100 次请求
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);
```

### 4. Nginx 安全配置

```nginx
# 隐藏版本信息
server_tokens off;

# 防止点击劫持
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

# HTTPS 强制
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# DDoS 防护
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;
```

---

## 故障排查

### 常见问题

#### 1. 数据库连接失败

```bash
# 检查 MySQL 状态
sudo systemctl status mysql

# 检查连接
mysql -h localhost -u forsion -p

# 查看错误日志
sudo tail -f /var/log/mysql/error.log
```

#### 2. 服务无法启动

```bash
# 查看 PM2 日志
pm2 logs forsion-backend --err

# 检查端口占用
sudo lsof -i :3001
sudo netstat -tulpn | grep 3001
```

#### 3. 内存泄漏

```bash
# 查看内存使用
pm2 describe forsion-backend

# 设置自动重启（内存超过限制）
pm2 delete forsion-backend
pm2 start ecosystem.config.js --max-memory-restart 500M
```

#### 4. 高 CPU 使用率

```bash
# 查看进程
top -p $(pgrep -f "forsion-backend")

# 生成 CPU profile
node --prof dist/index.js

# 分析 profile
node --prof-process isolate-*.log > processed.txt
```

---

## 更新和回滚

### 更新流程

```bash
# 1. 备份当前版本
cd /opt/forsion-backend
cp -r server-node server-node.backup

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖
cd server-node
npm ci

# 4. 运行数据库迁移
npm run migrate

# 5. 构建
npm run build

# 6. 重启服务
pm2 reload forsion-backend

# 7. 验证
curl http://localhost:3001/api/health
```

### 回滚流程

```bash
# 1. 停止服务
pm2 stop forsion-backend

# 2. 恢复备份
cd /opt/forsion-backend
rm -rf server-node
mv server-node.backup server-node

# 3. 启动服务
pm2 start forsion-backend

# 4. 验证
curl http://localhost:3001/api/health
```

---

## 总结

- ✅ 使用 Docker Compose 部署最简单
- ✅ 传统服务器部署需要配置 PM2 和 Nginx
- ✅ 确保配置 HTTPS 和安全措施
- ✅ 定期备份数据库
- ✅ 配置监控和日志
- ✅ 使用集群模式提高性能

## 获取帮助

- [后端服务 README](../README.md)
- [API 文档](docs/API.md)
- [客户端集成指南](docs/CLIENT_INTEGRATION.md)
- GitHub Issues

