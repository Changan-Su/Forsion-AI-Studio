# 后端启动指南

## ✅ 已完成的配置

1. **数据库配置已修复**
   - `.env` 文件中的密码已更新为 `rootpassword`（匹配 docker-compose.yml）
   - 数据库连接配置正确

2. **数据库迁移成功**
   - 所有表已创建
   - 数据库结构完整

3. **数据库种子成功**
   - 管理员用户已创建
   - 默认模型已设置

## 🚀 启动服务器

### 方法 1: 使用 npm run dev（推荐）
```bash
cd server-node
npm run dev
```

### 方法 2: 直接使用 tsx
```bash
cd server-node
npx tsx watch src/index.ts
```

## 🔍 如果启动失败

### 检查步骤：

1. **确认 MySQL 正在运行**
   ```bash
   docker ps | grep forsion_mysql
   ```
   应该看到容器状态为 "Up"

2. **检查 .env 文件**
   ```bash
   cat .env | grep DB_
   ```
   应该显示：
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=rootpassword
   DB_NAME=forsion_ai_studio
   ```

3. **测试数据库连接**
   ```bash
   npm run db:migrate
   ```
   应该显示 "✅ All migrations completed successfully!"

4. **查看详细错误**
   直接运行 `npm run dev` 并查看终端输出的完整错误信息

## 📝 常见问题

### 问题 1: "Access denied for user 'root'"
- **解决**: 确保 `.env` 文件中的 `DB_PASSWORD=rootpassword`

### 问题 2: "Cannot find module"
- **解决**: 运行 `npm install` 安装依赖

### 问题 3: 端口 3001 已被占用
- **解决**: 
  - 停止占用端口的进程
  - 或修改 `.env` 中的 `PORT` 为其他端口

## ✅ 成功启动的标志

看到以下输出表示启动成功：
```
🚀 Starting Forsion AI Studio Server (Node.js)...
✅ Database connection successful
✅ Server is running on http://localhost:3001
📊 Admin panel: http://localhost:3001/admin
📚 API: http://localhost:3001/api
```

## 🧪 测试服务器

启动后，在浏览器或使用 curl 测试：
```bash
curl http://localhost:3001/api/settings
```

应该返回 JSON 格式的设置数据。



