# =====================================================
# Forsion AI Studio - Windows 部署脚本
# 使用方法: 在 PowerShell 中运行 .\deploy.ps1
# =====================================================

$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "========================================" "Cyan"
Write-ColorOutput "Forsion AI Studio 部署脚本 (Windows)" "Cyan"
Write-ColorOutput "========================================" "Cyan"
Write-Host ""

# 检查 Docker
Write-ColorOutput "检查系统要求..." "Yellow"

$dockerInstalled = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerInstalled) {
    Write-ColorOutput "✗ Docker 未安装" "Red"
    Write-ColorOutput "请安装 Docker Desktop: https://docs.docker.com/desktop/install/windows-install/" "Red"
    exit 1
}
Write-ColorOutput "✓ Docker 已安装" "Green"

# 检查 Docker 是否运行
try {
    docker info | Out-Null
    Write-ColorOutput "✓ Docker 正在运行" "Green"
} catch {
    Write-ColorOutput "✗ Docker 未运行，请启动 Docker Desktop" "Red"
    exit 1
}

# 检查 Docker Compose
$composeInstalled = docker compose version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "✗ Docker Compose 未安装" "Red"
    exit 1
}
Write-ColorOutput "✓ Docker Compose 已安装" "Green"

# 检查后端目录（仅用于统一部署，不是必需的）
if (-not (Test-Path "server-node")) {
    Write-ColorOutput "ℹ 后端目录 server-node 不存在" "Yellow"
    Write-ColorOutput "  如果后端已单独部署，前端只需配置 API 地址即可" "Blue"
    Write-ColorOutput "  如果使用 docker-compose 统一部署，需要 server-node 目录" "Blue"
} else {
    Write-ColorOutput "✓ 后端目录 server-node 存在（可用于统一部署）" "Green"
}

Write-Host ""

# 检查 .env 文件
if (-not (Test-Path ".env")) {
    Write-ColorOutput "创建 .env 配置文件..." "Yellow"
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-ColorOutput "✓ 已从 .env.example 创建 .env 文件" "Green"
        Write-ColorOutput "⚠ 请编辑 .env 文件修改默认密码！" "Yellow"
    } else {
        # 创建默认 .env
        @"
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=forsion_ai_studio
MYSQL_USER=forsion
MYSQL_PASSWORD=forsion123
JWT_SECRET=$(([guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()).Replace('-',''))
VITE_API_URL=http://localhost:3001
"@ | Out-File -FilePath ".env" -Encoding UTF8
        Write-ColorOutput "✓ 已创建默认 .env 文件" "Green"
    }
}

Write-Host ""
Write-ColorOutput "启动 Docker 服务..." "Yellow"

# 停止现有容器
Write-ColorOutput "停止现有容器（如果有）..." "Blue"
docker compose down 2>&1 | Out-Null

# 构建并启动
Write-ColorOutput "构建并启动容器..." "Blue"

# 检查是否要部署后端
if (Test-Path "server-node") {
    # 有后端目录，可以统一部署
    # 注意：由于 MySQL 服务使用了 profiles，需要显式指定 --profile mysql
    docker compose --profile mysql up -d --build
} else {
    # 没有后端目录，只部署前端（后端需要单独部署）
    Write-ColorOutput "⚠ 只部署前端服务，确保后端 API 已部署并可访问" "Yellow"
    docker compose up -d --build frontend
}

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "✗ 启动失败" "Red"
    Write-ColorOutput "请查看日志: docker compose logs" "Red"
    exit 1
}

Write-Host ""
Write-ColorOutput "等待服务启动..." "Yellow"
Start-Sleep -Seconds 10

# 检查服务状态
Write-ColorOutput "检查服务状态..." "Yellow"
docker compose ps

Write-Host ""

# 等待 MySQL 就绪
Write-ColorOutput "等待 MySQL 就绪..." "Yellow"
$maxRetries = 30
$retry = 0
while ($retry -lt $maxRetries) {
    $mysqlReady = docker compose exec -T mysql mysqladmin ping -h localhost -u root -prootpassword 2>&1
    if ($mysqlReady -match "mysqld is alive") {
        Write-ColorOutput "✓ MySQL 已就绪" "Green"
        break
    }
    $retry++
    Start-Sleep -Seconds 2
}

if ($retry -ge $maxRetries) {
    Write-ColorOutput "⚠ MySQL 启动超时，请手动检查" "Yellow"
}

Write-Host ""

# 初始化数据库
Write-ColorOutput "初始化数据库..." "Yellow"
docker compose exec -T backend npm run db:migrate 2>&1 | Out-Null
docker compose exec -T backend npm run db:seed 2>&1 | Out-Null
Write-ColorOutput "✓ 数据库初始化完成" "Green"

Write-Host ""
Write-ColorOutput "========================================" "Green"
Write-ColorOutput "✓ 部署完成！" "Green"
Write-ColorOutput "========================================" "Green"
Write-Host ""
Write-ColorOutput "访问地址:" "Cyan"
Write-ColorOutput "  前端界面: http://localhost" "White"
Write-ColorOutput "  管理后台: http://localhost/admin" "White"
Write-ColorOutput "  API 服务: http://localhost/api/health" "White"
Write-Host ""
Write-ColorOutput "默认管理员账号:" "Cyan"
Write-ColorOutput "  用户名: admin" "White"
Write-ColorOutput "  密码: Admin123!@#" "White"
Write-Host ""
Write-ColorOutput "⚠ 请立即修改默认密码！" "Yellow"
Write-Host ""
Write-ColorOutput "常用命令:" "Cyan"
Write-ColorOutput "  查看日志: docker compose logs -f" "White"
Write-ColorOutput "  停止服务: docker compose down" "White"
Write-ColorOutput "  重启服务: docker compose restart" "White"
