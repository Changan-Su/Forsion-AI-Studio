#!/bin/bash

# 快速部署脚本 - 一键部署到 Linux 服务器
# 使用方法: curl -fsSL https://raw.githubusercontent.com/your-repo/main/quick-deploy.sh | bash -s -- YOUR_GITHUB_TOKEN

set -e

GITHUB_TOKEN="${1:-${GITHUB_TOKEN}}"
REPO_URL="${GITHUB_REPO_URL:-https://github.com/your-username/forsion-ai-studio.git}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/forsion-ai-studio}"

if [ -z "$GITHUB_TOKEN" ]; then
    echo "错误: 需要提供 GitHub Token"
    echo "使用方法:"
    echo "  export GITHUB_TOKEN=your_token"
    echo "  curl -fsSL https://raw.githubusercontent.com/your-repo/main/quick-deploy.sh | bash"
    exit 1
fi

# 构建带 token 的 URL
REPO_PATH=$(echo "$REPO_URL" | sed -E 's|https?://github.com/||' | sed 's|\.git$||')
AUTH_URL="https://${GITHUB_TOKEN}@github.com/${REPO_PATH}.git"

echo "开始部署 Forsion AI Studio..."
echo "仓库: $REPO_URL"
echo "部署目录: $DEPLOY_DIR"
echo ""

# 下载部署脚本
if [ ! -f "deploy.sh" ]; then
    echo "下载部署脚本..."
    curl -fsSL https://raw.githubusercontent.com/${REPO_PATH}/main/deploy.sh -o deploy.sh
    chmod +x deploy.sh
fi

# 设置环境变量并运行
export GITHUB_REPO_URL="$REPO_URL"
export GITHUB_TOKEN="$GITHUB_TOKEN"
export DEPLOY_DIR="$DEPLOY_DIR"

./deploy.sh

