# MySQL Docker 启动脚本
Write-Host "正在启动 MySQL Docker 容器..." -ForegroundColor Cyan

# 检查 Docker 是否可用
try {
    docker --version | Out-Null
} catch {
    Write-Host "错误: 未找到 Docker。请先安装 Docker Desktop。" -ForegroundColor Red
    Write-Host "下载地址: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# 启动 MySQL 容器
Write-Host "`n启动 MySQL 容器..." -ForegroundColor Yellow
docker-compose up -d

# 等待 MySQL 启动
Write-Host "`n等待 MySQL 服务启动（约 10-15 秒）..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# 检查容器状态
$containerStatus = docker ps --filter "name=forsion_mysql" --format "{{.Status}}"
if ($containerStatus) {
    Write-Host "`n✓ MySQL 容器已启动" -ForegroundColor Green
    Write-Host "  容器状态: $containerStatus" -ForegroundColor Gray
    Write-Host "`n数据库配置:" -ForegroundColor Cyan
    Write-Host "  主机: localhost" -ForegroundColor White
    Write-Host "  端口: 3306" -ForegroundColor White
    Write-Host "  数据库: forsion_ai_studio" -ForegroundColor White
    Write-Host "  用户名: root" -ForegroundColor White
    Write-Host "  密码: rootpassword" -ForegroundColor White
    Write-Host "`n或者使用:" -ForegroundColor Cyan
    Write-Host "  用户名: forsion" -ForegroundColor White
    Write-Host "  密码: forsion123" -ForegroundColor White
} else {
    Write-Host "`n✗ MySQL 容器启动失败" -ForegroundColor Red
    Write-Host "请检查 Docker Desktop 是否正在运行" -ForegroundColor Yellow
    docker-compose logs mysql
}


