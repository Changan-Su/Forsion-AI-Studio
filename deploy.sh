#!/bin/bash

# =====================================================
# Forsion AI Studio - Linux 部署脚本
# 
# 使用方法:
#   ./deploy.sh              # 交互式选择
#   ./deploy.sh --with-mysql # 使用 Docker MySQL
#   ./deploy.sh --no-mysql   # 使用已有 MySQL
# =====================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 默认配置
USE_DOCKER_MYSQL=""  # 空表示交互式询问

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --with-mysql)
                USE_DOCKER_MYSQL="yes"
                shift
                ;;
            --no-mysql)
                USE_DOCKER_MYSQL="no"
                shift
                ;;
            -h|--help)
                echo "用法: $0 [选项]"
                echo ""
                echo "选项:"
                echo "  --with-mysql    使用 Docker 启动 MySQL 容器"
                echo "  --no-mysql      使用已有的外部 MySQL（需配置 .env）"
                echo "  -h, --help      显示帮助信息"
                echo ""
                echo "示例:"
                echo "  $0                    # 交互式选择"
                echo "  $0 --no-mysql         # 连接已有 MySQL"
                exit 0
                ;;
            *)
                echo -e "${RED}未知参数: $1${NC}"
                echo "使用 -h 或 --help 查看帮助"
                exit 1
                ;;
        esac
    done
}

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
    
    # 检查后端目录（仅用于统一部署，不是必需的）
    if [ ! -d "server-node" ]; then
        echo -e "${YELLOW}ℹ 后端目录 server-node 不存在${NC}"
        echo -e "${BLUE}  如果后端已单独部署，前端只需配置 API 地址即可${NC}"
        echo -e "${BLUE}  如果使用 docker-compose 统一部署，需要 server-node 目录${NC}"
    else
        echo -e "${GREEN}✓ 后端目录 server-node 存在（可用于统一部署）${NC}"
    fi
    
    if [ $missing -eq 1 ]; then
        echo ""
        echo -e "${RED}请先解决上述问题${NC}"
        exit 1
    fi
    
    echo ""
}

# 询问 MySQL 配置
ask_mysql_config() {
    if [ -n "$USE_DOCKER_MYSQL" ]; then
        return  # 已通过命令行参数指定
    fi
    
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}MySQL 配置选项${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "请选择 MySQL 配置方式:"
    echo ""
    echo -e "  ${GREEN}1)${NC} 使用 Docker 启动新的 MySQL 容器 (首次部署推荐)"
    echo -e "  ${GREEN}2)${NC} 连接已有的 MySQL (本机安装或其他 Docker 容器如 1Panel)"
    echo ""
    
    while true; do
        read -p "请输入选项 [1/2]: " choice
        case $choice in
            1)
                USE_DOCKER_MYSQL="yes"
                echo -e "${GREEN}✓ 将使用 Docker MySQL${NC}"
                break
                ;;
            2)
                USE_DOCKER_MYSQL="no"
                echo -e "${GREEN}✓ 将连接已有 MySQL${NC}"
                configure_external_mysql
                break
                ;;
            *)
                echo -e "${RED}无效选项，请输入 1 或 2${NC}"
                ;;
        esac
    done
    echo ""
}

# 配置外部 MySQL
configure_external_mysql() {
    echo ""
    echo -e "${YELLOW}配置外部 MySQL 连接信息...${NC}"
    echo ""
    
    # 询问 MySQL 运行环境
    echo "请选择 MySQL 运行方式:"
    echo -e "  ${GREEN}1)${NC} MySQL 安装在本机 (非 Docker)"
    echo -e "  ${GREEN}2)${NC} MySQL 运行在其他 Docker 容器中 (如 1Panel、宝塔)"
    echo ""
    
    while true; do
        read -p "请输入选项 [1/2]: " mysql_type
        case $mysql_type in
            1)
                MYSQL_IN_DOCKER="no"
                break
                ;;
            2)
                MYSQL_IN_DOCKER="yes"
                break
                ;;
            *)
                echo -e "${RED}无效选项，请输入 1 或 2${NC}"
                ;;
        esac
    done
    
    echo ""
    echo -e "${BLUE}(直接回车使用默认值)${NC}"
    echo ""
    
    if [ "$MYSQL_IN_DOCKER" = "yes" ]; then
        # MySQL 在 Docker 容器中
        echo -e "${YELLOW}请输入 MySQL 容器名称 (可通过 docker ps 查看):${NC}"
        read -p "MySQL 容器名: " db_host
        if [ -z "$db_host" ]; then
            echo -e "${RED}容器名不能为空${NC}"
            exit 1
        fi
        DB_HOST=$db_host
        
        # 获取 MySQL 容器所在网络
        echo -e "${YELLOW}正在检测 MySQL 容器网络...${NC}"
        MYSQL_NETWORK=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$DB_HOST" 2>/dev/null | head -1)
        if [ -n "$MYSQL_NETWORK" ]; then
            echo -e "${GREEN}✓ 检测到 MySQL 网络: $MYSQL_NETWORK${NC}"
            export EXTERNAL_MYSQL_NETWORK="$MYSQL_NETWORK"
        else
            echo -e "${YELLOW}⚠ 未能自动检测网络，请手动输入${NC}"
            read -p "MySQL 容器所在网络名: " mysql_network
            export EXTERNAL_MYSQL_NETWORK="$mysql_network"
        fi
    else
        # MySQL 安装在本机
        read -p "MySQL 主机 [127.0.0.1]: " db_host
        DB_HOST=${db_host:-127.0.0.1}
    fi
    
    read -p "MySQL 端口 [3306]: " db_port
    DB_PORT=${db_port:-3306}
    
    read -p "MySQL 用户名: " db_user
    if [ -z "$db_user" ]; then
        echo -e "${RED}用户名不能为空${NC}"
        exit 1
    fi
    DB_USER=$db_user
    
    read -sp "MySQL 密码: " db_pass
    echo ""
    if [ -z "$db_pass" ]; then
        echo -e "${RED}密码不能为空${NC}"
        exit 1
    fi
    DB_PASSWORD=$db_pass
    
    read -p "数据库名: " db_name
    if [ -z "$db_name" ]; then
        echo -e "${RED}数据库名不能为空${NC}"
        exit 1
    fi
    DB_NAME=$db_name
    
    # 测试连接
    echo ""
    echo -e "${YELLOW}测试 MySQL 连接...${NC}"
    
    if [ "$MYSQL_IN_DOCKER" = "yes" ]; then
        # 通过 Docker 网络测试
        if docker exec "$DB_HOST" mysqladmin ping -h localhost -u "$DB_USER" -p"$DB_PASSWORD" &> /dev/null; then
            echo -e "${GREEN}✓ MySQL 容器连接成功${NC}"
        else
            echo -e "${YELLOW}⚠ MySQL 连接测试失败，请确认配置正确${NC}"
            echo "  继续部署，稍后可手动修改 .env 文件"
        fi
    elif command -v mysql &> /dev/null; then
        if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" &> /dev/null; then
            echo -e "${GREEN}✓ MySQL 连接成功${NC}"
        else
            echo -e "${YELLOW}⚠ MySQL 连接测试失败，请确认配置正确${NC}"
            echo "  继续部署，稍后可手动修改 .env 文件"
        fi
    else
        echo -e "${BLUE}ℹ mysql 客户端未安装，跳过连接测试${NC}"
    fi
    
    # 保存配置到环境变量（后续写入 .env）
    export EXTERNAL_DB_HOST="$DB_HOST"
    export EXTERNAL_DB_PORT="$DB_PORT"
    export EXTERNAL_DB_USER="$DB_USER"
    export EXTERNAL_DB_PASSWORD="$DB_PASSWORD"
    export EXTERNAL_DB_NAME="$DB_NAME"
    export EXTERNAL_MYSQL_IN_DOCKER="$MYSQL_IN_DOCKER"
}

# 配置环境
setup_env() {
    echo -e "${YELLOW}配置环境变量...${NC}"
    
    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    
    if [ "$USE_DOCKER_MYSQL" = "yes" ]; then
        # Docker MySQL 配置
        cat > .env << EOF
# MySQL 配置 (Docker)
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=forsion_ai_studio
MYSQL_USER=forsion
MYSQL_PASSWORD=forsion123

# 后端数据库连接 (Docker 内部网络)
DB_HOST=mysql
DB_PORT=3306
DB_USER=forsion
DB_PASSWORD=forsion123
DB_NAME=forsion_ai_studio

# JWT 密钥
JWT_SECRET=$JWT_SECRET

# 前端 API 地址
VITE_API_URL=http://localhost:3001
EOF
        echo -e "${GREEN}✓ 已创建 Docker MySQL 配置${NC}"
    else
        # 外部 MySQL 配置
        cat > .env << EOF
# MySQL 配置 (外部已有)
# 这些变量用于 docker-compose 中的 mysql 服务，但我们不启动它
MYSQL_ROOT_PASSWORD=not_used
MYSQL_DATABASE=${EXTERNAL_DB_NAME:-forsion_ai_studio}
MYSQL_USER=${EXTERNAL_DB_USER:-root}
MYSQL_PASSWORD=${EXTERNAL_DB_PASSWORD:-}

# 后端数据库连接 (连接外部 MySQL)
DB_HOST=${EXTERNAL_DB_HOST:-localhost}
DB_PORT=${EXTERNAL_DB_PORT:-3306}
DB_USER=${EXTERNAL_DB_USER:-root}
DB_PASSWORD=${EXTERNAL_DB_PASSWORD:-}
DB_NAME=${EXTERNAL_DB_NAME:-forsion_ai_studio}

# JWT 密钥
JWT_SECRET=$JWT_SECRET

# 前端 API 地址
VITE_API_URL=http://localhost:3001
EOF
        echo -e "${GREEN}✓ 已创建外部 MySQL 配置${NC}"
    fi
    
    echo -e "${YELLOW}⚠ 生产环境请修改 .env 中的默认密码！${NC}"
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
    
    # 删除可能残留的 forsion_mysql 容器
    docker rm -f forsion_mysql 2>/dev/null || true
    
    # 检查是否要部署后端
    if [ -d "server-node" ]; then
        # 有后端目录，可以统一部署
        if [ "$USE_DOCKER_MYSQL" = "yes" ]; then
            # 启动所有服务（包括 MySQL）
            echo -e "${BLUE}构建并启动所有容器（含 MySQL）...${NC}"
            $COMPOSE_CMD --profile mysql up -d --build
        else
            # 只启动 backend 和 frontend，不启动 mysql
            echo -e "${BLUE}构建并启动容器（不含 MySQL）...${NC}"
            $COMPOSE_CMD up -d --build backend frontend
        fi
    else
        # 没有后端目录，只部署前端（后端需要单独部署）
        echo -e "${BLUE}只部署前端服务（后端需单独部署）...${NC}"
        echo -e "${YELLOW}⚠ 确保后端 API 已部署并可访问${NC}"
        $COMPOSE_CMD up -d --build frontend
        
        # 如果 MySQL 在其他 Docker 容器中，需要连接网络
        if [ "$EXTERNAL_MYSQL_IN_DOCKER" = "yes" ] && [ -n "$EXTERNAL_MYSQL_NETWORK" ]; then
            echo -e "${BLUE}将 backend 连接到 MySQL 网络 ($EXTERNAL_MYSQL_NETWORK)...${NC}"
            docker network connect "$EXTERNAL_MYSQL_NETWORK" forsion_backend 2>/dev/null || true
            echo -e "${GREEN}✓ 网络连接完成${NC}"
        fi
    fi
    
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
    if [ "$USE_DOCKER_MYSQL" = "yes" ]; then
        echo -e "${YELLOW}等待 Docker MySQL 就绪...${NC}"
        
        COMPOSE_CMD="docker compose"
        if ! docker compose version &> /dev/null; then
            COMPOSE_CMD="docker-compose"
        fi
        
        local max_retries=30
        local retry=0
        
        while [ $retry -lt $max_retries ]; do
            if $COMPOSE_CMD exec -T mysql mysqladmin ping -h localhost -u root -prootpassword &> /dev/null; then
                echo -e "${GREEN}✓ Docker MySQL 已就绪${NC}"
                return 0
            fi
            retry=$((retry + 1))
            sleep 2
            echo -n "."
        done
        
        echo ""
        echo -e "${YELLOW}⚠ MySQL 启动超时，请手动检查${NC}"
        return 1
    else
        echo -e "${BLUE}ℹ 使用外部 MySQL，跳过等待${NC}"
        # 简单等待后端连接外部数据库
        sleep 5
    fi
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
    parse_args "$@"
    check_requirements
    ask_mysql_config
    setup_env
    start_services
    wait_for_mysql
    init_database
    show_completion
}

main "$@"

