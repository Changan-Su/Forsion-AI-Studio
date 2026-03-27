# 项目进度追踪

**项目**：Forsion AI Studio
**当前版本**：v1.0
**当前阶段**：v1.0 开发完成，待验收
**最后更新**：2026-03-26

---

## 当前版本：v1.0 功能清单

| 功能 | 状态 | 说明 | 关联文件 |
|------|------|------|---------|
| Skills 市场页面 | 开发完成 | SkillsMarket 组件 + SettingsModal Skills Tab | client/components/SkillsMarket.tsx |
| Skill 作用域控制 | 开发完成 | 全局/Session/禁用三档 + localStorage 持久化 | client/components/SkillsMarket.tsx |
| Skill 执行可视化 | 开发完成 | ToolCallBlock 增强：三态显示 + 重试 + 超时 | client/components/ToolCallBlock.tsx |
| 跨应用数据授权 | 开发完成 | 授权弹窗 + 后端 app_authorizations 表 + CRUD API | client/components/AuthorizationDialog.tsx, src/routes/dataHub.ts |
| 新用户引导流程 | 开发完成 | 3 步 Tooltip 引导 + 状态持久化 | client/components/OnboardingFlow.tsx |
| 用户级数据分区 | 开发完成 | user_data_partitions 表 + 数据中枢 CRUD API | src/services/dataHubService.ts, src/routes/dataHub.ts |
| 跨应用 Skill 调用 | 开发完成 | Calendar Skill (.skill.md) + http executor | client/skills/calendar.skill.md |
| 统一用户画像 | 开发完成 | _profile 命名空间 + 模型偏好追踪 | src/services/userProfileService.ts |
| App 数据同步接口 | 开发完成 | POST /api/data-hub/sync + full/incremental 模式 | src/routes/dataHub.ts |
| 对话历史云同步 | 开发完成 | chat_sessions + chat_messages 表 + CRUD API + 批量迁移 | src/routes/chatSync.ts |
| 多主题风格系统 | 开发完成 | 5 套主题 (default/notion/monet/apple/forsion1) + CSS | client/index.html, client/App.tsx |
| 智能模型推荐 | 暂缓 | P2，推迟到 v1.5 | |
| 非官方 Skills 渠道 | 暂缓 | P2，预留接口，v2.0 实现 | |
| 官方 Skills 管理（后台） | 开发完成 | skills_catalog 表 + Admin CRUD API + 公开目录 API | src/routes/skillsCatalog.ts |

**进度**：12/14 功能开发完成（2 个暂缓）| 35/35 Task 已完成

---

## 技术上下文

**技术栈**：TypeScript + React 19 + Vite
**包管理器**：npm
**项目结构**：
- `client/` — 前端源代码（React SPA）
- `client/components/` — React 组件（PascalCase）
- `client/services/` — API 客户端和业务服务
- `client/skills/` — 内置 .skill.md 文件
- `docs/` — 文档（PRD 工作流产出物）
- `src/` — 后端源代码（Node.js + Express）

**已确认约束**：
- 无 React Router，全局状态驱动的 SPA
- Skills 为 `.skill.md` 文件，解析器 `skillParser.ts`
- SettingsModal 现有 4 个 Tab（general / skills / account / developer）
- IndexedDB 用于 Workspace 文件存储
- 主题通过 `themePreset` 状态管理（5 套：default / notion / monet / apple / forsion1）
- 后端独立仓库：Forsion-Backend-Service

**假设记录**：
- [T-012] Calendar Skill 使用 `{{API_BASE_URL}}` 占位符，需在 agentRuntime 中替换为实际 API 地址
- [T-010] user_data_partitions 的 payload 字段使用 MySQL JSON 类型
- [T-021] chat_sessions 和 chat_messages 表结构基于前端 ChatSession 和 Message 类型推断
- [T-034] 用户画像每 10 次对话触发一次重算，通过 usageService 调用链集成

---

## 下一步行动

> Agent 下次被触发时从这里继续。

- [ ] 人工验收：运行 `npm run db:migrate` 执行新表创建
- [ ] 人工验收：启动前后端服务，验证 Skills Market UI 和主题切换
- [ ] 人工验收：测试跨应用数据授权流程（需 Calendar App 推送数据）
- [ ] 人工验收：测试对话云同步（新设备登录查看历史会话）

---

## 等待用户确认

> 需要用户做出决策才能继续的事项。

无

---

## 已知问题 / 待修复

- SettingsModal 的 `builtinProviders` 变量在 developer tab 中引用但未定义（已有 bug，非本次引入）
- Calendar Skill 的 http executor URL 模板需要 agentRuntime 支持 `{{API_BASE_URL}}` 替换

---

## 已完成步骤记录

- **步骤一**（2026-03-26）：3 轮对话式需求采集
- **步骤二**（2026-03-26）：目录初始化
- **步骤三**（2026-03-26）：初版 PRD 产出
- **步骤四**（2026-03-26）：原型产出（5 模块 + 5 主题）
- **步骤五**（2026-03-26）：6 个核心业务流程图
- **步骤六**（2026-03-26）：最终版 PRD 定稿（§五 + §十一）
- **开发执行**（2026-03-26）：Full Auto 模式执行全部 35 Task（8 Epic），涉及文件：
  - 前端新增：SkillsMarket.tsx, AuthorizationDialog.tsx, OnboardingFlow.tsx, calendar.skill.md
  - 前端修改：SettingsModal.tsx, ToolCallBlock.tsx, AgentConfigPanel.tsx, App.tsx, types.ts, index.html
  - 后端新增：dataHubService.ts, userProfileService.ts, dataHub.ts, chatSync.ts, skillsCatalog.ts, migrate-data-hub.ts
  - 后端修改：index.ts（注册新路由）
