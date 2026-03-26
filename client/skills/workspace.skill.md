---
id: workspace
name: Workspace
description: Read, write, and execute files in the session workspace
icon: Wrench
isBuiltin: true
isWorkspace: true
tools:
  - name: read_file
    description: Read the text content of a file from the workspace.
    executor: builtin
    parameters:
      type: object
      properties:
        path:
          type: string
          description: 'File path, e.g. "data.csv"'
      required:
        - path
  - name: write_file
    description: Write or create a text file in the workspace.
    executor: builtin
    parameters:
      type: object
      properties:
        path:
          type: string
          description: File path
        content:
          type: string
          description: File content
      required:
        - path
        - content
  - name: list_files
    description: List all files in the workspace with their sizes and types.
    executor: builtin
    parameters:
      type: object
      properties: {}
      required: []
  - name: delete_file
    description: Delete a file from the workspace.
    executor: builtin
    parameters:
      type: object
      properties:
        path:
          type: string
          description: File path to delete
      required:
        - path
  - name: run_python
    description: Execute Python code in a sandboxed environment. Can access workspace files at /workspace/ path. Supports pandas, numpy, matplotlib. Use plt.show() to save plots to the workspace.
    executor: builtin
    parameters:
      type: object
      properties:
        code:
          type: string
          description: Python code to execute
      required:
        - code
  - name: show_image
    description: Display an image from the workspace inline in the chat.
    executor: builtin
    parameters:
      type: object
      properties:
        path:
          type: string
          description: Image file path in workspace
      required:
        - path
---

# Workspace Skill

You have a **persistent virtual filesystem** for this session. Use it to store, process, and share files.

## File operations
- `list_files` — always call this first if you are unsure what files exist.
- `read_file` — read any text file (CSV, JSON, Markdown, code, etc.). Output is capped at 10,000 characters.
- `write_file` — create or overwrite a file. Use structured formats (JSON, CSV, Markdown) where appropriate.
- `delete_file` — remove files that are no longer needed.

## Python execution (`run_python`)
- Files in the workspace are accessible at `/workspace/<path>`.
- Supported libraries: `pandas`, `numpy`, `matplotlib`, `json`, `csv`, `math`, `re`, `datetime`, and Python standard library.
- Plots: call `plt.show()` — it saves the figure as a PNG to the workspace automatically. Then use `show_image` to display it.
- Print to stdout to see output; stderr is also captured.
- Execution is sandboxed (no network access, no OS calls).

## Images
- After generating or downloading an image, use `show_image` to display it inline.
- Supported formats: PNG, JPEG, GIF, WebP.

## Best practices
- Use descriptive filenames so the user can identify files easily.
- For multi-step data analysis: write intermediate results to files, then read them back.
- Always report which files were created or modified after completing a task.
