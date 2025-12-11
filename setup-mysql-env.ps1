# 创建 MySQL 环境变量配置文件
$envFile = "server\.env"
$envContent = @"
# MySQL Database Configuration (for Docker)
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=rootpassword
MYSQL_DATABASE=forsion_ai_studio

# Optional: Enable SQL query logging for debugging
SQL_DEBUG=false
"@

if (Test-Path $envFile) {
    Write-Host "文件 $envFile 已存在，跳过创建" -ForegroundColor Yellow
} else {
    $envContent | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "✓ 已创建环境变量配置文件: $envFile" -ForegroundColor Green
    Write-Host "`n配置内容:" -ForegroundColor Cyan
    Write-Host $envContent
}


