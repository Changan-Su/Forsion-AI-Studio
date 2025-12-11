# Linux 服务器部署指南

本指南介绍如何在 Linux 服务器上部署 Forsion AI Studio。

## 前置要求

- Linux 服务器（Ubuntu 20.04+ / Debian 11+ / CentOS 8+）
- Docker 和 Docker Compose
- Git
- Python 3.11+
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

## 快速部署

### 1. 安装依赖

#### Ubuntu/Debian
```bash
# 更新系统
sudo apt-get update

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo apt-get install docker-compose-plugin

# 安装 Git 和 Python
sudo apt-get install git python3 python3-venv python3-pip

# 将当前用户添加到 docker 组（避免每次都用 sudo）
sudo usermod -aG docker $USER
newgrp docker
```

#### CentOS/RHEL
```bash
# 安装 Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Git 和 Python
sudo yum install git python3 python3-pip
```

### 2. 配置 GitHub 访问

#### 方式 A：在仓库目录中运行（推荐，自动检测）

如果你已经在仓库目录中，脚本会自动检测仓库信息：

```bash
# 克隆仓库到服务器
git clone https://github.com/your-username/forsion-ai-studio.git
cd forsion-ai-studio

# 设置 GitHub Token（私有仓库必需）
export GITHUB_TOKEN=ghp_your_token_here

# 运行部署脚本（会自动检测仓库 URL 和分支）
chmod +x deploy.sh
./deploy.sh
```

#### 方式 B：手动指定仓库信息

如果不在仓库目录中，需要手动设置：

1. 创建 GitHub Personal Access Token（私有仓库必需）：
   - 访问：https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 选择权限：`repo`（完整仓库访问权限）
   - 生成并复制 token

2. 设置环境变量并运行：
```bash
export GITHUB_REPO_URL=https://github.com/your-username/forsion-ai-studio.git
export GITHUB_TOKEN=ghp_your_token_here  # 私有仓库必需
export MYSQL_ROOT_PASSWORD=your_secure_password  # 可选，默认 rootpassword
export DEPLOY_DIR=/opt/forsion-ai-studio  # 可选，默认 /opt/forsion-ai-studio

# 下载并运行部署脚本
wget https://raw.githubusercontent.com/your-username/forsion-ai-studio/main/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

#### 方式 C：使用 SSH Key（无需 Token）

如果配置了 SSH Key：

```bash
# 使用 SSH URL
export GITHUB_REPO_URL=git@github.com:your-username/forsion-ai-studio.git
# 不需要设置 GITHUB_TOKEN

./deploy.sh
```

### 4. 启动服务

#### 方式 A：手动启动（开发/测试）

```bash
cd /opt/forsion-ai-studio/server
source .venv/bin/activate
uvicorn server.main:app --host 0.0.0.0 --port 3001
```

#### 方式 B：使用 systemd 服务（生产环境）

部署脚本会自动创建 systemd 服务文件，运行：

```bash
sudo systemctl daemon-reload
sudo systemctl enable forsion-backend
sudo systemctl start forsion-backend

# 查看状态
sudo systemctl status forsion-backend

# 查看日志
sudo journalctl -u forsion-backend -f
```

## 环境变量配置

编辑 `server/.env` 文件：

```env
# MySQL Database Configuration
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=forsion_ai_studio

# Optional: Enable SQL query logging for debugging
SQL_DEBUG=false
```

## 更新部署

```bash
cd /opt/forsion-ai-studio
git pull origin main
cd server
source .venv/bin/activate
pip install -r requirements.txt
cd ..
python3 -m server.init_db  # 如果需要数据库迁移

# 重启服务
sudo systemctl restart forsion-backend
```

## 数据库管理

### 查看 MySQL 容器状态
```bash
docker ps | grep forsion_mysql
```

### 查看 MySQL 日志
```bash
docker compose logs mysql
```

### 进入 MySQL 容器
```bash
docker exec -it forsion_mysql mysql -u root -p
```

### 备份数据库
```bash
docker exec forsion_mysql mysqldump -u root -prootpassword forsion_ai_studio > backup.sql
```

### 恢复数据库
```bash
docker exec -i forsion_mysql mysql -u root -prootpassword forsion_ai_studio < backup.sql
```

## 防火墙配置

如果服务器有防火墙，需要开放端口：

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 3001/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

## Nginx 反向代理（可选）

创建 `/etc/nginx/sites-available/forsion`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/forsion /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 故障排除

### MySQL 容器无法启动
```bash
# 查看日志
docker compose logs mysql

# 检查端口占用
sudo netstat -tlnp | grep 3306

# 重启容器
docker compose restart mysql
```

### 后端服务无法连接数据库
1. 检查 MySQL 容器是否运行：`docker ps | grep mysql`
2. 检查 `.env` 文件配置是否正确
3. 测试连接：`docker exec forsion_mysql mysql -u root -prootpassword -e "SHOW DATABASES;"`

### 权限问题
```bash
# 确保用户有权限访问部署目录
sudo chown -R $USER:$USER /opt/forsion-ai-studio

# 确保 Docker 组权限
sudo usermod -aG docker $USER
```

## 安全建议

1. **更改默认密码**：修改 MySQL root 密码
2. **使用 HTTPS**：配置 SSL 证书（Let's Encrypt）
3. **限制访问**：使用防火墙限制数据库端口访问
4. **定期备份**：设置自动数据库备份
5. **更新系统**：定期更新系统和依赖包

## 支持

如有问题，请查看：
- 项目 README.md
- GitHub Issues
- 日志文件：`sudo journalctl -u forsion-backend`

