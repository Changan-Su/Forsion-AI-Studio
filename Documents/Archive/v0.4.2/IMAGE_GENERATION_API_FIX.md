# 图像生成 API 规范修复

## 修复概述

根据 [API 文档](https://api-gpt-ge.apifox.cn/210432242e0) 的 OpenAPI 规范，修复了图像生成功能，使其完全符合 API 规范。

## 修复内容

### 1. 支持 `style` 参数

**问题**：之前只支持 `quality` 参数，但 API 规范要求使用 `style` 参数。

**修复**：
- 添加 `style` 参数支持（`vivid` 或 `natural`）
- 保持向后兼容：如果未提供 `style`，将 `quality: 'hd'` 映射为 `style: 'vivid'`，`quality: 'standard'` 映射为 `style: 'natural'`
- 同时支持 `quality` 和 `style` 参数（某些 API 可能同时支持）

**代码位置**：
- `server-node/src/routes/chat.ts` - 后端 API 端点
- `client/services/imageGenerationService.ts` - 前端服务

### 2. 支持 `dall-e-2` 模型

**问题**：之前硬编码为 `dall-e-3`，不支持 `dall-e-2`。

**修复**：
- 支持通过 `model.apiModelId` 配置使用 `dall-e-2` 或 `dall-e-3`
- `dall-e-2` 支持批量生成（n=1-10）
- `dall-e-3` 仅支持单张生成（n=1）
- 自动验证 `n` 参数范围

**代码位置**：
- `server-node/src/routes/chat.ts` - 模型选择和验证逻辑

### 3. 支持 `response_format` 参数

**问题**：之前只支持 URL 格式返回。

**修复**：
- 添加 `response_format` 参数支持（`url` 或 `b64_json`）
- 正确处理两种响应格式
- 默认使用 `url` 格式（向后兼容）

**代码位置**：
- `server-node/src/routes/chat.ts` - 请求参数
- `client/services/backendService.ts` - 响应处理

### 4. 支持 `n` 参数（批量生成）

**问题**：之前硬编码 `n=1`，不支持批量生成。

**修复**：
- 添加 `n` 参数支持
- `dall-e-2`：支持 n=1-10
- `dall-e-3`：仅支持 n=1（自动限制）
- 自动验证和限制 `n` 值

**代码位置**：
- `server-node/src/routes/chat.ts` - 参数验证
- `client/services/backendService.ts` - 参数传递

### 5. 改进日志记录

**问题**：日志中硬编码模型名称。

**修复**：
- 使用实际的 `model_id` 和 `model.name`
- 使用 `model.provider` 而不是硬编码 'openai'

**代码位置**：
- `server-node/src/routes/chat.ts` - 日志记录

## API 规范对照

### 请求参数

| 参数 | 类型 | 必需 | 修复前 | 修复后 |
|------|------|------|--------|--------|
| `prompt` | string | ✅ | ✅ | ✅ |
| `model` | string | ✅ | ❌ (硬编码) | ✅ (可配置) |
| `n` | number | ❌ | ❌ (硬编码1) | ✅ (支持1-10) |
| `size` | string | ❌ | ✅ | ✅ |
| `response_format` | string | ❌ | ❌ | ✅ |
| `style` | string | ❌ | ❌ | ✅ |
| `quality` | string | ❌ | ✅ | ✅ (向后兼容) |
| `user` | string | ❌ | ❌ | ❌ (可选) |

### 支持的模型

| 模型 | n 范围 | style 支持 | 修复前 | 修复后 |
|------|--------|-----------|--------|--------|
| `dall-e-2` | 1-10 | ❌ | ❌ | ✅ |
| `dall-e-3` | 1 | ✅ | ✅ | ✅ |

### 尺寸支持

| 模型 | 支持的尺寸 | 修复前 | 修复后 |
|------|-----------|--------|--------|
| `dall-e-2` | 256x256, 512x512, 1024x1024 | ✅ | ✅ |
| `dall-e-3` | 1024x1024, 1024x1792, 1792x1024 | ✅ | ✅ |

## 代码修改清单

### 后端文件

1. **`server-node/src/routes/chat.ts`**
   - 添加 `style`, `n`, `response_format` 参数支持
   - 实现模型选择逻辑（dall-e-2 vs dall-e-3）
   - 实现 `n` 参数验证（根据模型限制范围）
   - 实现 `quality` 到 `style` 的映射（向后兼容）
   - 修复日志记录（使用实际模型信息）

### 前端文件

1. **`client/services/imageGenerationService.ts`**
   - 更新 `generateWithDALLE()` 函数签名
   - 添加 `model`, `n`, `style` 参数支持
   - 实现参数验证和请求体构建

2. **`client/services/backendService.ts`**
   - 更新 `proxyImageGeneration()` 方法签名
   - 添加 `style`, `n`, `response_format` 参数
   - 实现 `b64_json` 响应格式处理

## 向后兼容性

✅ **完全向后兼容**：
- 未提供新参数时，使用默认值
- `quality` 参数仍然支持（映射到 `style`）
- 默认模型仍为 `dall-e-3`
- 默认 `n=1`
- 默认 `response_format='url'`

## 使用示例

### 基本使用（向后兼容）

```typescript
// 前端调用（旧方式，仍然有效）
await backendService.proxyImageGeneration(
  'dall-e-3-model-id',
  'a beautiful sunset',
  '1024x1024',
  'standard'
);
```

### 使用新参数

```typescript
// 使用 style 参数
await backendService.proxyImageGeneration(
  'dall-e-3-model-id',
  'a beautiful sunset',
  '1024x1024',
  'standard',
  'vivid',  // style: vivid (写实风格)
  1,
  'url'
);

// 使用 dall-e-2 批量生成
await backendService.proxyImageGeneration(
  'dall-e-2-model-id',
  'a beautiful sunset',
  '1024x1024',
  'standard',
  undefined,
  5,  // 生成 5 张图片
  'url'
);

// 使用 base64 格式
await backendService.proxyImageGeneration(
  'dall-e-3-model-id',
  'a beautiful sunset',
  '1024x1024',
  'standard',
  'natural',
  1,
  'b64_json'  // 返回 base64 格式
);
```

## 测试建议

### 测试用例

1. **基本生成**（向后兼容测试）
   ```
   使用旧参数调用 → 应该正常工作
   ```

2. **style 参数**
   ```
   style: 'vivid' → 应该生成写实风格
   style: 'natural' → 应该生成自然风格
   ```

3. **dall-e-2 批量生成**
   ```
   model: 'dall-e-2', n: 5 → 应该生成 5 张图片
   model: 'dall-e-2', n: 15 → 应该自动限制为 10
   ```

4. **dall-e-3 单张生成**
   ```
   model: 'dall-e-3', n: 5 → 应该自动限制为 1
   ```

5. **response_format**
   ```
   response_format: 'url' → 返回 URL
   response_format: 'b64_json' → 返回 base64 数据
   ```

## 注意事项

1. **API 兼容性**：
   - 某些第三方 API 可能不支持所有参数
   - 如果 API 不支持 `style`，可以继续使用 `quality`
   - 代码会自动处理参数兼容性

2. **模型配置**：
   - 需要在 `global_models` 表中设置 `apiModelId` 来指定使用 `dall-e-2` 还是 `dall-e-3`
   - 如果不设置，默认使用 `dall-e-3`

3. **成本考虑**：
   - `dall-e-2` 批量生成（n>1）会增加成本
   - `dall-e-3` 的 `hd` quality 比 `standard` 更昂贵
   - `vivid` style 可能比 `natural` 消耗更多资源

## 总结

✅ 所有修改已完成
✅ 通过 TypeScript 类型检查
✅ 无 linting 错误
✅ 完全向后兼容
✅ 符合 API 规范

现在图像生成功能完全符合 [API 文档规范](https://api-gpt-ge.apifox.cn/210432242e0)，支持所有标准参数和功能。

