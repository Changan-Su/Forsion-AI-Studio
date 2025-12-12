#!/bin/bash

# =====================================================
# Forsion AI Studio - Linux 部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh
# =====================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Forsion AI Studio 部署脚本 (Linux)${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 检查必需命令
check_requirements() {
    echo -e "${YELLOW}检查系统要求...${NC}"
    
    local missing=0
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker 未安装${NC}"
        echo "  安装命令: curl -fsSL https://get.docker.com | sh"
        missing=1
    else
        echo -e "${GREEN}✓ Docker 已安装 ($(docker --version | cut -d' ' -f3 | tr -d ','))${NC}"
    fi
    
    if ! docker compose version &> /dev/null && ! docker-compose --version &> /dev/null; then
        echo -e "${RED}✗ Docker Compose 未安装${NC}"
        missing=1
    else
        echo -e "${GREEN}✓ Docker Compose 已安装${NC}"
    fi
    
    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        echo -e "${RED}✗ Docker 未运行${NC}"
        echo "  启动命令: sudo systemctl start docker"
        missing=1
    else
        echo -e "${GREEN}✓ Docker 正在运行${NC}"
    fi
    
    if [ $missing -eq 1 ]; then
        echo ""
        echo -e "${RED}请先安装缺失的依赖${NC}"
        exit 1
    fi
    
    echo ""
}

# 配置环境
setup_env() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}创建 .env 配置文件...${NC}"
        if [ -f ".env.example" ]; then
            cp .env.example .env
            # 生成随机 JWT 密钥
            JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
            sed -i "s/your-super-secret-jwt-key-change-in-production/$JWT_SECRET/" .env 2>/dev/null || true
            echo -e "${GREEN}✓ 已创建 .env 文件${NC}"
        else
            cat > .env << EOF
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=forsion_ai_studio
MYSQL_USER=forsion
MYSQL_PASSWORD=forsion123
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change-this-secret-key")
VITE_API_URL=http://localhost:3001
EOF
            echo -e "${GREEN}✓ 已创建默认 .env 文件${NC}"
        fi
        echo -e "${YELLOW}⚠ 请编辑 .env 文件修改默认密码！${NC}"
    else
        echo -e "${GREEN}✓ .env 文件已存在${NC}"
    fi
    echo ""
}

# 启动服务
start_services() {
    echo -e "${YELLOW}启动 Docker 服务...${NC}"
    
    # 使用 docker compose 或 docker-compose
    COMPOSE_CMD="docker compose"
    if ! docker compose version &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    fi
    
    # 停止现有容器
    echo -e "${BLUE}停止现有容器（如果有）...${NC}"
    $COMPOSE_CMD down 2>/dev/null || true
    
    # 构建并启动
    echo -e "${BLUE}构建并启动容器...${NC}"
    $COMPOSE_CMD up -d --build
    
    echo ""
    echo -e "${YELLOW}等待服务启动...${NC}"
    sleep 10
    
    # 检查状态
    echo -e "${YELLOW}检查服务状态...${NC}"
    $COMPOSE_CMD ps
    echo ""
}

# 等待 MySQL 就绪
wait_for_mysql() {
    echo -e "${YELLOW}等待 MySQL 就绪...${NC}"
    
    COMPOSE_CMD="docker compose"
    if ! docker compose version &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    fi
    
    local max_retries=30
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if $COMPOSE_CMD exec -T mysql mysqladmin ping -h localhost -u root -prootpassword &> /dev/null; then
            echo -e "${GREEN}✓ MySQL 已就绪${NC}"
            return 0
        fi
        retry=$((retry + 1))
        sleep 2
    done
    
    echo -e "${YELLOW}⚠ MySQL 启动超时，请手动检查${NC}"
    return 1
}

# 初始化数据库
init_database() {
    echo -e "${YELLOW}初始化数据库...${NC}"
    
    COMPOSE_CMD="docker compose"
    if ! docker compose version &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    fi
    
    $COMPOSE_CMD exec -T backend npm run db:migrate 2>/dev/null || true
    $COMPOSE_CMD exec -T backend npm run db:seed 2>/dev/null || true
    
    echo -e "${GREEN}✓ 数据库初始化完成${NC}"
    echo ""
}

# 显示完成信息
show_completion() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ 部署完成！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${CYAN}访问地址:${NC}"
    echo "  前端界面: http://localhost"
    echo "  管理后台: http://localhost/admin"
    echo "  API 服务: http://localhost/api/health"
    echo ""
    echo -e "${CYAN}默认管理员账号:${NC}"
    echo "  用户名: admin"
    echo "  密码: Admin123!@#"
    echo ""
    echo -e "${YELLOW}⚠ 请立即修改默认密码！${NC}"
    echo ""
    echo -e "${CYAN}常用命令:${NC}"
    echo "  查看日志: docker compose logs -f"
    echo "  停止服务: docker compose down"
    echo "  重启服务: docker compose restart"
    echo ""
}

# 主流程
main() {
    check_requirements
    setup_env
    start_services
    wait_for_mysql
    init_database
    show_completion
}

main "$@"

