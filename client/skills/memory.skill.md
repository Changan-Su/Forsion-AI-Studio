---
id: memory
name: Memory
description: Persistent cross-session memory — a single markdown note the agent reads and writes
icon: Brain
isBuiltin: true
tools:
  - name: memory_read
    description: Read the full memory text. Use at the start of a conversation or when you need context about the user.
    executor: builtin
    parameters:
      type: object
      properties: {}
      required: []
  - name: memory_append
    description: "Append a natural-language line to the memory notebook. Write in Markdown (e.g. '- 用户名字叫 zzc','-用户最近学习线性代数','-用户已经学习到量子力学第一章了'，'用户希望用亲切的语气回复'). NEVER use JSON."
    executor: builtin
    parameters:
      type: object
      properties:
        text:
          type: string
          description: "A Markdown line to append, e.g. '- User prefers dark mode' or '## Projects\\n- Working on Forsion'"
      required:
        - text
  - name: memory_write
    description: "Replace the entire memory with new Markdown text. Use only for reorganizing. NEVER write JSON — use bullet points and headings."
    executor: builtin
    parameters:
      type: object
      properties:
        content:
          type: string
          description: "Full replacement Markdown content with headings and bullet points"
      required:
        - content
---

# Memory Skill

You have a persistent memory — a **plain Markdown text file** shared across all conversations. It is NOT a database, NOT JSON, NOT structured records. Write in natural language with Markdown formatting.

## CRITICAL FORMAT RULE
**NEVER write JSON, structured objects, or key-value pairs to memory.** Always write in natural human-readable Markdown — bullet points, headings, short sentences. The memory is a notebook, not a data store.

Bad (DO NOT do this):
```
{"name": "zzc", "preference": "dark mode", "language": "Chinese"}
```

Good (DO this):
```
- 用户名字叫 zzc
- 偏好深色模式和 Monet 主题
- 希望用中文交流
```

## When to READ memory
- At the beginning of a new conversation, call `memory_read` to recall user context.
- When the user references something from a previous conversation.

## When to APPEND
Call `memory_append` with a short, natural-language line when the user:
- Tells you their name or preferences
- Mentions a task, project, or goal
- Gives persistent instructions

Example call: `memory_append({ text: "- 用户名字叫 zzc" })`
Example call: `memory_append({ text: "- 正在开发 Forsion Backend Service 项目" })`

## When to WRITE (replace all)
Only use `memory_write` when reorganizing. First `memory_read`, then rewrite as clean Markdown, then `memory_write`.

## Guidelines
- Write concise bullet points in the user's language.
- Use `##` headings to organize sections (e.g. `## 用户信息`, `## 项目`, `## 偏好`).
- One fact per line, prefixed with `- `.
- Never store passwords, tokens, or API keys.
