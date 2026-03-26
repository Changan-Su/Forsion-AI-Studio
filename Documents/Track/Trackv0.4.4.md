# Track v0.4.4 - 项目特定模型配置前端适配记录

## 1. 遇到的问题描述
在 Forsion Backend Service 升级到 v0.4.4 后，后端引入了项目特定模型配置机制。此前，Forsion AI Studio 通过 `GET /api/models` 获取全局所有启用的模型。

**需求：**
- 修改 Forsion AI Studio 前端，使其调用新的项目特定 API 接口。
- 确保只有在 Admin Panel 中为 `ai-studio` 项目勾选的模型才会显示在客户端中。

## 2. 分析思路与设计权衡
### 2.1 API 变更适配
后端新增了以下端点：
- `GET /api/projects/:projectId/models`: 获取指定项目可用的模型列表。

对于 Forsion AI Studio 项目，`projectId` 确定为 `ai-studio`。

### 2.2 实现位置定位
通过全局搜索 `/api/models`，定位到 API 调用主要集中在 `client/services/backendService.ts` 中的 `getGlobalModels` 函数。

## 3. 解决步骤与实现细节

### 3.1 修改后端服务调用 (`client/services/backendService.ts`)
更新 `getGlobalModels` 方法，将请求路径从 `/models` 更改为 `/projects/ai-studio/models`。

```typescript
// client/services/backendService.ts

  // 12. Get Global Models from backend (project-specific)
  async getGlobalModels(): Promise<any[]> {
    try {
      // 这里的路径由 /models 改为 /projects/ai-studio/models
      const res = await fetch(`${API_URL}/projects/ai-studio/models`, {
        headers: getHeaders()
      });
      markOnline();
      if (res.status === 401) {
        clearAuth();
        throw new AuthRequiredError();
      }
      if (res.ok) return await res.json();
      return [];
    } catch (error) {
      if (error instanceof AuthRequiredError) throw error;
      if (isNetworkError(error)) markOffline();
      else markOnline();
      console.warn('Failed to fetch global models', error);
      return [];
    }
  },
```

### 3.2 验证与检查
- **Lint 检查**：运行 `read_lints` 确认代码格式和类型定义无误。
- **全局搜索**：再次搜索 `/api/models`，确认除了旧的文档记录外，核心逻辑代码中已无旧接口的直接调用。

## 4. 遇到的坑与教训
### 4.1 项目 ID 硬编码
在当前的适配中，我们将 `ai-studio` 硬编码在了 API 请求路径中。
- **教训**：虽然目前项目结构较为固定，但未来如果 Forsion AI Studio 有多个环境或子项目标识，建议将其提取为常量或配置项。

## 5. 变更总结
- **修改文件**：`client/services/backendService.ts`
- **主要改动**：更新 `getGlobalModels` 的 fetch 路径。
- **影响范围**：应用启动时的模型同步逻辑（`App.tsx` 中的 `syncSettingsFromBackend`）。

## 6. 后续优化建议
- **配置化**：将 `ai-studio` 这一项目标识符放入全局配置文件（如 `config.ts`），方便后续维护。
- **错误处理**：如果后端返回 404（项目不存在），前端应有更友好的提示，而不是仅仅返回空数组。




---

# Agent SKILL.md 微型架构重构 (v0.4.4 增量)

## 1. 背景与目标

Agent 模式原有的 skills 和工具定义全部硬编码在 `skillsRegistry.ts` 中（TypeScript 常量），缺乏可读性、可扩展性和统一的格式规范。目标是将其重构为**标准 SKILL.md 文件格式**，形成微型 agent 架构：

- 内置 skills → `client/skills/*.skill.md`（构建时打包）
- 自定义 skills → session workspace 的 `.agent/skills/*.skill.md`（IndexedDB，每个会话独立）

## 2. 标准 SKILL.md 格式

每个文件由两部分组成：

- **YAML frontmatter**：机器可解析的工具定义（名称、描述、参数 schema、executor 类型）
- **Markdown body**：自然语言指令，agent 启用该 skill 时注入 system prompt

```markdown
---
id: web
name: Web Access
description: Search the web and fetch URLs
icon: Globe
isBuiltin: true
tools:
  - name: web_search
    description: ...
    executor: builtin
    parameters: { ... }
---

# Web Access Skill

Use `web_search` when you need up-to-date information...
```

## 3. 新增文件

| 文件 | 作用 |
|---|---|
| `client/skills/web.skill.md` | Web Access 内置 skill |
| `client/skills/code.skill.md` | Code Execution 内置 skill |
| `client/skills/productivity.skill.md` | Productivity 内置 skill |
| `client/skills/workspace.skill.md` | Workspace 内置 skill（自动注入） |
| `client/services/skillParser.ts` | SKILL.md 解析器 / 序列化器 |
| `client/services/agentWorkspace.ts` | `.agent/skills/` CRUD + 旧数据迁移 |
| `client/src/skill-md.d.ts` | Vite `?raw` 导入的 TypeScript 声明 |

## 4. 修改文件

### `types.ts`
- `ToolDefinition` 新增 `executorType?: 'builtin' | 'javascript' | 'http'` 和 `executorConfig?: CustomToolExecutorConfig`
- `SkillDefinition` 新增 `instructions?: string`（markdown body）和 `isWorkspace?: boolean`
- `CustomToolExecutorConfig` 相关类型定义移至 `ToolDefinition` 之前，避免前向引用问题

### `skillsRegistry.ts`（完全重写）
- 通过 `import rawWeb from '../skills/web.skill.md?raw'` + `parseSkillMd()` 替代硬编码常量
- `getToolsForSkills()` 新增 `extraSkills` 参数支持 workspace skills
- 新增 `getSkillInstructions()` 收集启用 skill 的 markdown body 用于 system prompt
- 保留旧的 localStorage 相关函数供迁移期兼容

### `agentRuntime.ts`
- 进入 agent 循环前异步加载该 session 的 `.agent/skills/`（`listWorkspaceSkills`）
- 将 skill instructions 拼接到 system prompt 末尾（`## Skill Instructions`）
- `executeOneTool` / `executeToolCallsBatch` 新增 `allTools` 参数，支持通过 `executorConfig` 执行自定义工具

### `builtinTools.ts`
- `executeBuiltinTool` 新增 `toolDef?: ToolDefinition` 参数
- 执行优先级：hardcoded executor → toolDef.executorConfig → localStorage custom executor

### `AgentConfigPanel.tsx`
- `useEffect` 打开时先执行 `migrateLocalStorageSkills` → 再 `listWorkspaceSkills`
- 显示 builtin + workspace skills 合并列表
- 新建/编辑 skill 保存到 `saveWorkspaceSkill`（SKILL.md → IndexedDB）
- 删除调用 `deleteWorkspaceSkill`

## 5. 向后兼容迁移

`agentWorkspace.migrateLocalStorageSkills(sessionId)`：
- 首次运行读取 `localStorage.forsion_custom_skills`
- 将每个 `CustomSkillDefinition` 转为 SKILL.md 写入当前 session 的 `.agent/skills/`
- 清除 localStorage 并写入迁移标记 `forsion_agent_skills_migrated = done`
- 幂等，多次调用无副作用

## 6. 构建验证

- `npx tsc --noEmit`：我新增/修改的文件无类型错误（其余预存错误不在本次范围内）
- `npx vite build`：构建成功，`?raw` import 和 `yaml` 包均正常解析
