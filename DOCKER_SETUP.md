# Docker MySQL 快速启动指南

## 1. 安装 Docker Desktop

如果还没有安装 Docker Desktop，请先安装：

1. 访问 https://www.docker.com/products/docker-desktop
2. 下载并安装 Docker Desktop for Windows
3. 安装完成后启动 Docker Desktop
4. 等待 Docker Desktop 完全启动（系统托盘图标不再闪烁）

## 2. 启动 MySQL 容器

安装好 Docker Desktop 后，在项目根目录运行：

```powershell
# 方式1: 使用 PowerShell 脚本（推荐）
.\start-mysql.ps1

# 方式2: 使用 docker-compose 命令
docker-compose up -d
```

## 3. 验证 MySQL 运行状态

```powershell
# 查看容器状态
docker ps

# 查看 MySQL 日志
docker-compose logs mysql
```

## 4. 初始化数据库

MySQL 容器启动后，运行数据库初始化脚本：

```powershell
cd server
.\.venv\Scripts\Activate.ps1
cd ..
python -m server.init_db
```

如果需要从旧的 JSON 文件迁移数据：

```powershell
python -m server.init_db --migrate
```

## 5. 启动后端服务

```powershell
cd server
.\.venv\Scripts\Activate.ps1
cd ..
uvicorn server.main:app --host 127.0.0.1 --port 3001 --reload
```

## 数据库配置信息

- **主机**: localhost
- **端口**: 3306
- **数据库名**: forsion_ai_studio
- **Root 用户**: root / rootpassword
- **应用用户**: forsion / forsion123

## 停止 MySQL 容器

```powershell
docker-compose down
```

## 删除数据（重置数据库）

```powershell
docker-compose down -v
```

注意：这会删除所有数据！

## 故障排除

### Docker Desktop 未启动
确保 Docker Desktop 正在运行，系统托盘应该有 Docker 图标。

### 端口被占用
如果 3306 端口已被占用，可以修改 `docker-compose.yml` 中的端口映射：
```yaml
ports:
  - "3307:3306"  # 改为其他端口
```
然后更新 `server/.env` 中的 `MYSQL_PORT=3307`

### 容器启动失败
查看详细日志：
```powershell
docker-compose logs mysql
```


