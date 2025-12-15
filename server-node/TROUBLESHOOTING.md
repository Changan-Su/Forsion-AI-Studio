# 服务器启动故障排除指南

## ✅ 已确认正常

1. **MySQL 容器正在运行** ✓
2. **数据库配置正确** ✓
   - DB_HOST=localhost
   - DB_PORT=3306
   - DB_USER=root
   - DB_PASSWORD=rootpassword
   - DB_NAME=forsion_ai_studio
3. **数据库迁移成功** ✓
4. **数据库种子成功** ✓

## 🔍 如何查看启动错误

### 方法 1: 在前台运行（推荐）

在终端中运行：

```powershell
cd server-node
npm run dev
```

这样可以看到完整的启动日志和任何错误信息。

### 方法 2: 检查端口占用

```powershell
# 检查端口 3001 是否被占用
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

# 如果被占用，停止占用端口的进程
# 或修改 .env 中的 PORT 为其他端口（如 3002）
```

### 方法 3: 检查 Node.js 进程

```powershell
# 查看所有 node 进程
Get-Process | Where-Object {$_.ProcessName -eq "node"}

# 停止所有 node 进程（如果需要）
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

## 🐛 常见问题

### 问题 1: 数据库连接失败

**症状**: 看到 "Access denied" 或 "Connection refused"

**解决**:
1. 确认 MySQL 容器正在运行：
   ```powershell
   docker ps --filter "name=forsion_mysql"
   ```
2. 检查 `.env` 文件中的密码是否正确（应该是 `rootpassword`）
3. 测试数据库连接：
   ```powershell
   npm run db:migrate
   ```

### 问题 2: 端口被占用

**症状**: 看到 "EADDRINUSE" 错误

**解决**:
1. 找到占用端口的进程并停止它
2. 或修改 `.env` 中的 `PORT=3001` 为其他端口

### 问题 3: 模块找不到

**症状**: 看到 "Cannot find module" 错误

**解决**:
```powershell
npm install
```

### 问题 4: TypeScript 编译错误

**症状**: 看到 TypeScript 相关错误

**解决**:
```powershell
npm install
npm run build
```

## 📝 启动成功的标志

看到以下输出表示启动成功：

```
🚀 Starting Forsion AI Studio Server (Node.js)...
✅ Database connection successful
✅ Server is running on http://localhost:3001
📊 Admin panel: http://localhost:3001/admin
📚 API: http://localhost:3001/api
```

## 🧪 测试服务器

启动成功后，测试 API：

```powershell
# 测试设置端点
Invoke-WebRequest -Uri "http://localhost:3001/api/settings" -Method GET

# 或使用浏览器访问
# http://localhost:3001/api/settings
```

## 💡 下一步

如果服务器成功启动，你可以：

1. **启动前端**:
   ```powershell
   cd ..
   npm run dev
   ```

2. **访问应用**:
   - 前端: http://localhost:50173
   - 后端 API: http://localhost:3001/api
   - 管理面板: http://localhost:3001/admin

## 📞 需要帮助？

如果问题仍然存在，请：

1. 在前台运行 `npm run dev` 查看完整错误信息
2. 复制完整的错误输出
3. 检查 MySQL 容器日志：
   ```powershell
   docker logs forsion_mysql
   ```



