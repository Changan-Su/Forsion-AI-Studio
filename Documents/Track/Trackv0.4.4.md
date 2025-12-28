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

