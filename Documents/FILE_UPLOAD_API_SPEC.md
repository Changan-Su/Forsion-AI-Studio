# 文件上传功能 - 后端适配规范

版本：v1.0.0 | 最后更新：2025年1月

## 📋 概述

本文档描述前端文件上传功能的实现方式，以及后端需要适配的 API 规范。

### 当前状态

前端已实现文件上传功能，支持：
- ✅ 图片上传（PNG、JPG、GIF、WebP 等）
- ✅ PDF 文档上传
- ✅ Word 文档上传（.doc、.docx）
- ✅ 文本文件上传（.txt、.md）

### 问题

当前后端 `/api/chat/completions` 接口**未正确处理多模态消息格式**，导致上传的文件无法被 AI 模型读取。

---

## 🔧 后端需要适配的内容

### 1. 消息格式变更

#### 原有格式（纯文本）

```json
{
  "model_id": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "stream": true
}
```

#### 新格式（多模态 - OpenAI Vision 格式）

当用户上传图片时，前端会发送以下格式：

```json
{
  "model_id": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "请描述这张图片"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
          }
        }
      ]
    }
  ],
  "stream": true
}
```

### 2. 后端处理逻辑

后端在将消息转发给上游 AI API 时，需要**保留 `content` 的原始格式**：

```javascript
// ❌ 错误做法 - 假设 content 总是字符串
const userMessage = messages[messages.length - 1];
const content = userMessage.content; // 可能是 string 或 array

// ✅ 正确做法 - 保持原始格式
const userMessage = messages[messages.length - 1];
// 直接透传 content，不做类型转换
```

### 3. 上游 API 调用示例

#### OpenAI / OpenAI 兼容 API

```javascript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: modelId, // e.g., "gpt-4o", "gpt-4-vision-preview"
    messages: messages, // 直接透传，保留多模态格式
    temperature: temperature,
    stream: stream
  })
});
```

#### Gemini API（如果需要）

Gemini API 使用不同的格式，需要转换：

```javascript
// 将 OpenAI 格式转换为 Gemini 格式
function convertToGeminiFormat(messages) {
  return messages.map(msg => {
    const parts = [];
    
    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      msg.content.forEach(item => {
        if (item.type === 'text') {
          parts.push({ text: item.text });
        } else if (item.type === 'image_url') {
          // 从 data URL 提取 base64
          const base64Data = item.image_url.url.split(',')[1];
          const mimeType = item.image_url.url.match(/data:([^;]+);/)?.[1] || 'image/png';
          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          });
        }
      });
    }
    
    return {
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: parts
    };
  });
}
```

---

## 📝 API 规范详情

### POST /api/chat/completions

#### 请求体

```typescript
interface ChatCompletionRequest {
  model_id: string;          // 模型 ID
  messages: Message[];       // 消息列表
  temperature?: number;      // 温度，默认 0.7
  max_tokens?: number;       // 最大 token 数
  stream?: boolean;          // 是否流式响应，默认 true
}

// 消息类型（兼容两种格式）
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];  // 可以是字符串或多模态数组
}

// 多模态内容部分
type ContentPart = TextPart | ImagePart;

interface TextPart {
  type: 'text';
  text: string;
}

interface ImagePart {
  type: 'image_url';
  image_url: {
    url: string;  // data:image/xxx;base64,... 格式
  };
}
```

#### 响应格式

保持不变，遵循 OpenAI Chat Completions API 格式。

---

## 🖼️ 图片处理说明

### 支持的图片格式

| 格式 | MIME Type | 说明 |
|------|-----------|------|
| PNG | image/png | 推荐，支持透明 |
| JPEG | image/jpeg | 照片常用格式 |
| GIF | image/gif | 支持动图 |
| WebP | image/webp | 高压缩比 |

### 图片大小限制

建议后端对图片大小进行限制：
- 单张图片：不超过 20MB
- Base64 编码后：约增加 33% 大小

### 前端已做的处理

1. 图片以 Base64 Data URL 格式发送
2. 格式：`data:image/png;base64,{base64_data}`
3. 前端会保留原始 MIME 类型

---

## 📄 PDF/Word 文档处理

### 重要说明

**OpenAI Chat API 不原生支持 PDF/Word 文档**。只有以下几种处理方式：

1. **文本提取**（当前前端实现）- 对于不支持文档的模型，前端会调用后端的文件解析接口提取文本
2. **Gemini 原生支持** - Gemini API 原生支持 PDF 上传
3. **使用 Assistants API** - OpenAI 的 Assistants API 支持文件上传

### 当前实现

前端会根据模型能力自动选择处理方式：

| 模型类型 | 图片 | PDF/Word |
|----------|------|----------|
| Gemini 系列 | ✅ 原生支持 | ✅ 原生支持 |
| OpenAI 系列 (GPT-4V 等) | ✅ 原生支持 | ❌ 需要文本提取 |
| 其他 OpenAI 兼容 API | ✅ 可能支持 | ❌ 需要文本提取 |

### 文件解析接口（已有）

前端会调用以下接口进行文本提取：

```http
POST /api/parse-file
Content-Type: multipart/form-data

file: <binary>
```

响应：
```json
{
  "text": "提取的文本内容...",
  "base64": "原文件的 base64 编码",
  "filename": "document.pdf"
}
```

---

## 🔄 后端代码修改建议

### Node.js/Express 示例

```javascript
// routes/chat.js

app.post('/api/chat/completions', async (req, res) => {
  const { model_id, messages, temperature = 0.7, stream = true } = req.body;
  
  // 获取模型配置
  const model = await getModelConfig(model_id);
  
  // 根据模型提供商选择处理方式
  if (model.provider === 'gemini') {
    // Gemini API 需要转换格式
    const geminiMessages = convertToGeminiFormat(messages);
    return handleGeminiRequest(res, model, geminiMessages, { temperature, stream });
  } else {
    // OpenAI 兼容 API - 直接透传消息
    return handleOpenAIRequest(res, model, messages, { temperature, stream });
  }
});

async function handleOpenAIRequest(res, model, messages, options) {
  const response = await fetch(`${model.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${model.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model.apiModelId,
      messages: messages,  // ⚠️ 关键：直接透传，不要修改 content 格式
      temperature: options.temperature,
      stream: options.stream
    })
  });
  
  if (options.stream) {
    // 流式响应处理...
    res.setHeader('Content-Type', 'text/event-stream');
    // pipe response...
  } else {
    const data = await response.json();
    res.json(data);
  }
}
```

---

## ✅ 测试检查清单

后端适配完成后，请验证以下场景：

### 1. 纯文本消息
```bash
curl -X POST http://localhost:3001/api/chat/completions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```
✅ 应该正常返回文本响应

### 2. 图片消息
```bash
curl -X POST http://localhost:3001/api/chat/completions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "gpt-4o",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "这是什么图片？"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgo..."}}
      ]
    }],
    "stream": false
  }'
```
✅ 模型应该能够描述图片内容

### 3. 多图片消息
```bash
curl -X POST http://localhost:3001/api/chat/completions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "gpt-4o",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "比较这两张图片"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
      ]
    }],
    "stream": false
  }'
```
✅ 模型应该能够比较两张图片

### 4. 流式响应
✅ 确保流式响应在多模态消息时也能正常工作

---

## 📌 总结

### 后端需要做的改动

1. **修改 `/api/chat/completions` 接口**
   - 接受 `content` 为字符串或数组两种格式
   - 透传消息格式给上游 API，不做额外转换

2. **确保上游 API 调用正确**
   - OpenAI 兼容 API：直接透传
   - Gemini API：转换为 Gemini 格式

3. **可选：增强文件解析接口**
   - 确保 `/api/parse-file` 能正确提取 PDF/Word 文本

### 前端已完成

1. 图片转换为 Base64 Data URL
2. 构建 OpenAI Vision 兼容的多模态消息格式
3. 根据模型能力自动选择处理方式（原生上传 vs 文本提取）

---

**文档版本**：v1.0.0  
**创建日期**：2025年1月17日
