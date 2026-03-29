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
    description: Append a line or paragraph to the memory. Use when you learn something new about the user.
    executor: builtin
    parameters:
      type: object
      properties:
        text:
          type: string
          description: The text to append to the end of the memory
      required:
        - text
  - name: memory_write
    description: Replace the entire memory text. Use only when you need to reorganize or clean up the memory.
    executor: builtin
    parameters:
      type: object
      properties:
        content:
          type: string
          description: The new full memory content (replaces everything)
      required:
        - content
---

# Memory Skill

You have a persistent memory note that survives across conversations. It is a plain Markdown text — not a database. Think of it as your personal notebook about this user.

## When to READ memory
- At the beginning of a new conversation, read memory to recall who this user is and what they care about.
- When the user references something from a previous conversation.
- When you need to recall user preferences, names, or prior decisions.

## When to APPEND to memory
Proactively append when the user:
- Tells you their name, preferences, or how they like to be addressed
- Mentions a task, project, or goal
- Gives instructions that should persist (e.g. "always respond in Chinese")
- Shares facts about themselves, their team, or their workflow

Simply call `memory_append` with the new information. Keep each append concise — one line or short paragraph.

## When to WRITE (replace) memory
Only use `memory_write` to replace the entire memory when:
- The memory has gotten messy and needs reorganization
- The user explicitly asks you to clear or rewrite the memory
- You want to remove outdated information while keeping the rest

When rewriting, first `memory_read` to get the current content, edit it, then `memory_write` the cleaned version.

## Guidelines
- Keep the memory concise and factual.
- Use markdown formatting: headings, bullet points, etc.
- Do not store sensitive credentials, passwords, or API keys.
- The user can see and edit this memory from Settings — treat it like a shared document.
