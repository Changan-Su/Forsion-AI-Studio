#!/bin/bash

# Forsion AI Studio 部署脚本
# 适用于 Linux 服务器，支持从私有 GitHub 仓库部署

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量（可根据需要修改）
# 如果未设置，会自动从当前 Git 仓库检测
if [ -z "${GITHUB_REPO_URL:-}" ] && [ -d ".git" ]; then
    # 自动检测当前仓库的远程 URL
    REPO_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [ -n "$REPO_URL" ]; then
        echo -e "${BLUE}自动检测到仓库: $REPO_URL${NC}"
    fi
fi
REPO_URL="${GITHUB_REPO_URL:-${REPO_URL:-}}"  # GitHub 仓库 URL
GITHUB_TOKEN="${GITHUB_TOKEN:-}"  # GitHub Personal Access Token（用于私有仓库）
BRANCH="${BRANCH:-main}"          # 分支名称，如果未设置则从当前分支检测
DEPLOY_DIR="${DEPLOY_DIR:-/opt/forsion-ai-studio}"  # 部署目录
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-rootpassword}"  # MySQL root 密码
MYSQL_DATABASE="${MYSQL_DATABASE:-forsion_ai_studio}"  # 数据库名称

# 如果未设置分支，尝试从当前分支检测
if [ -z "${BRANCH:-}" ] && [ -d ".git" ]; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
    BRANCH="${CURRENT_BRANCH:-main}"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Forsion AI Studio 部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查必需的命令
check_requirements() {
    echo -e "${YELLOW}检查系统要求...${NC}"
    
    local missing=0
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker 未安装${NC}"
        echo "  请安装 Docker: https://docs.docker.com/get-docker/"
        missing=1
    else
        echo -e "${GREEN}✓ Docker 已安装${NC}"
    fi
    
    if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}✗ Docker Compose 未安装${NC}"
        missing=1
    else
        echo -e "${GREEN}✓ Docker Compose 已安装${NC}"
    fi
    
    if ! command -v git &> /dev/null; then
        echo -e "${RED}✗ Git 未安装${NC}"
        echo "  请安装 Git: sudo apt-get install git"
        missing=1
    else
        echo -e "${GREEN}✓ Git 已安装${NC}"
    fi
    
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}✗ Python3 未安装${NC}"
        echo "  请安装 Python3: sudo apt-get install python3 python3-venv"
        missing=1
    else
        echo -e "${GREEN}✓ Python3 已安装${NC}"
    fi
    
    if [ $missing -eq 1 ]; then
        exit 1
    fi
    
    echo ""
}

# 克隆或更新代码
clone_repo() {
    echo -e "${YELLOW}准备代码仓库...${NC}"
    
    if [ -z "$REPO_URL" ]; then
        echo -e "${RED}错误: 无法检测到仓库 URL${NC}"
        echo "请设置环境变量:"
        echo "  export GITHUB_REPO_URL=https://github.com/username/repo.git"
        echo "  export GITHUB_TOKEN=your_token  # 对于私有仓库（必需）"
        echo "  ./deploy.sh"
        echo ""
        echo "或者在 Git 仓库目录中运行此脚本，脚本会自动检测仓库信息"
        exit 1
    fi
    
    # 检查是否是私有仓库（需要 token）
    if [[ "$REPO_URL" == *"github.com"* ]] && [ -z "$GITHUB_TOKEN" ]; then
        echo -e "${YELLOW}警告: 检测到 GitHub 仓库，但未设置 GITHUB_TOKEN${NC}"
        echo "如果是私有仓库，请设置:"
        echo "  export GITHUB_TOKEN=your_token"
        echo ""
        echo "继续尝试使用 SSH 或公开访问..."
    fi
    
    # 构建带 token 的 URL（如果是私有仓库）
    if [ -n "$GITHUB_TOKEN" ]; then
        # 处理不同的 URL 格式
        if [[ "$REPO_URL" == *"github.com"* ]]; then
            # HTTPS URL
            REPO_PATH=$(echo "$REPO_URL" | sed -E 's|https?://||' | sed -E 's|^[^@]*@||' | sed 's|\.git$||')
            AUTH_URL="https://${GITHUB_TOKEN}@${REPO_PATH}.git"
        elif [[ "$REPO_URL" == git@* ]]; then
            # SSH URL，转换为 HTTPS + Token
            REPO_PATH=$(echo "$REPO_URL" | sed 's|git@github.com:||' | sed 's|\.git$||')
            AUTH_URL="https://${GITHUB_TOKEN}@github.com/${REPO_PATH}.git"
        else
            AUTH_URL="$REPO_URL"
        fi
    else
        AUTH_URL="$REPO_URL"
    fi
    
    if [ -d "$DEPLOY_DIR" ]; then
        echo -e "${BLUE}目录已存在，更新代码...${NC}"
        cd "$DEPLOY_DIR"
        git fetch origin
        git checkout "$BRANCH"
        git pull origin "$BRANCH"
    else
        echo -e "${BLUE}克隆仓库到 $DEPLOY_DIR...${NC}"
        mkdir -p "$(dirname "$DEPLOY_DIR")"
        git clone -b "$BRANCH" "$AUTH_URL" "$DEPLOY_DIR"
        cd "$DEPLOY_DIR"
    fi
    
    echo -e "${GREEN}✓ 代码准备完成${NC}"
    echo ""
}

# 设置 Python 虚拟环境
setup_python_env() {
    echo -e "${YELLOW}设置 Python 环境...${NC}"
    
    cd "$DEPLOY_DIR/server"
    
    if [ ! -d ".venv" ]; then
        echo -e "${BLUE}创建虚拟环境...${NC}"
        python3 -m venv .venv
    fi
    
    echo -e "${BLUE}安装 Python 依赖...${NC}"
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    
    echo -e "${GREEN}✓ Python 环境设置完成${NC}"
    echo ""
}

# 配置环境变量
setup_env() {
    echo -e "${YELLOW}配置环境变量...${NC}"
    
    cd "$DEPLOY_DIR/server"
    
    if [ ! -f ".env" ]; then
        echo -e "${BLUE}创建 .env 文件...${NC}"
        cat > .env << EOF
# MySQL Database Configuration
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=${MYSQL_ROOT_PASSWORD}
MYSQL_DATABASE=${MYSQL_DATABASE}

# Optional: Enable SQL query logging for debugging
SQL_DEBUG=false
EOF
        echo -e "${GREEN}✓ .env 文件已创建${NC}"
    else
        echo -e "${YELLOW}⚠ .env 文件已存在，跳过创建${NC}"
    fi
    
    echo ""
}

# 启动 MySQL 容器
start_mysql() {
    echo -e "${YELLOW}启动 MySQL 容器...${NC}"
    
    cd "$DEPLOY_DIR"
    
    # 检查容器是否已运行
    if docker ps --format '{{.Names}}' | grep -q "^forsion_mysql$"; then
        echo -e "${YELLOW}MySQL 容器已在运行${NC}"
    else
        echo -e "${BLUE}启动 MySQL 容器...${NC}"
        docker compose up -d mysql
        
        echo -e "${BLUE}等待 MySQL 启动（约 15 秒）...${NC}"
        sleep 15
        
        # 检查容器状态
        if docker ps --format '{{.Names}}' | grep -q "^forsion_mysql$"; then
            echo -e "${GREEN}✓ MySQL 容器已启动${NC}"
        else
            echo -e "${RED}✗ MySQL 容器启动失败${NC}"
            docker compose logs mysql
            exit 1
        fi
    fi
    
    echo ""
}

# 初始化数据库
init_database() {
    echo -e "${YELLOW}初始化数据库...${NC}"
    
    cd "$DEPLOY_DIR/server"
    source .venv/bin/activate
    
    echo -e "${BLUE}运行数据库初始化脚本...${NC}"
    python3 -m server.init_db
    
    echo -e "${GREEN}✓ 数据库初始化完成${NC}"
    echo ""
}

# 创建 systemd 服务文件（可选）
create_systemd_service() {
    echo -e "${YELLOW}创建 systemd 服务...${NC}"
    
    SERVICE_FILE="/etc/systemd/system/forsion-backend.service"
    
    if [ -f "$SERVICE_FILE" ]; then
        echo -e "${YELLOW}⚠ 服务文件已存在，跳过创建${NC}"
        return
    fi
    
    echo -e "${BLUE}创建服务文件...${NC}"
    
    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Forsion AI Studio Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEPLOY_DIR
Environment="PATH=$DEPLOY_DIR/server/.venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=$DEPLOY_DIR/server/.venv/bin/uvicorn server.main:app --host 0.0.0.0 --port 3001
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    echo -e "${GREEN}✓ 服务文件已创建${NC}"
    echo -e "${BLUE}启用并启动服务:${NC}"
    echo -e "  sudo systemctl daemon-reload"
    echo -e "  sudo systemctl enable forsion-backend"
    echo -e "  sudo systemctl start forsion-backend"
    echo ""
}

# 主函数
main() {
    check_requirements
    clone_repo
    setup_python_env
    setup_env
    start_mysql
    init_database
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}部署完成！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}下一步:${NC}"
    echo -e "1. 启动后端服务:"
    echo -e "   cd $DEPLOY_DIR/server"
    echo -e "   source .venv/bin/activate"
    echo -e "   uvicorn server.main:app --host 0.0.0.0 --port 3001"
    echo ""
    echo -e "2. 或使用 systemd 服务:"
    echo -e "   sudo systemctl start forsion-backend"
    echo ""
    echo -e "${BLUE}数据库信息:${NC}"
    echo -e "  主机: localhost"
    echo -e "  端口: 3306"
    echo -e "  数据库: $MYSQL_DATABASE"
    echo -e "  用户: root"
    echo -e "  密码: $MYSQL_ROOT_PASSWORD"
    echo ""
}

# 运行主函数
main

