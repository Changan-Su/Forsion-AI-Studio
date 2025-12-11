#!/bin/bash

# 更新脚本 - 更新已部署的 Forsion AI Studio

set -e

DEPLOY_DIR="${DEPLOY_DIR:-/opt/forsion-ai-studio}"
BRANCH="${BRANCH:-main}"

if [ ! -d "$DEPLOY_DIR" ]; then
    echo "错误: 部署目录不存在: $DEPLOY_DIR"
    echo "请先运行 deploy.sh 进行初始部署"
    exit 1
fi

echo "更新 Forsion AI Studio..."
echo "部署目录: $DEPLOY_DIR"
echo "分支: $BRANCH"
echo ""

cd "$DEPLOY_DIR"

# 拉取最新代码
echo "拉取最新代码..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# 更新 Python 依赖
echo "更新 Python 依赖..."
cd server
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 检查数据库迁移
echo "检查数据库迁移..."
python3 -m server.init_db

# 重启服务（如果使用 systemd）
if systemctl is-active --quiet forsion-backend; then
    echo "重启服务..."
    sudo systemctl restart forsion-backend
    echo "✓ 服务已重启"
else
    echo "⚠ systemd 服务未运行，请手动重启后端服务"
fi

echo ""
echo "✓ 更新完成！"

