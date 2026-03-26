---
id: code
name: Code Execution
description: Run JavaScript expressions in a sandbox
icon: Code2
isBuiltin: true
tools:
  - name: js_eval
    description: Evaluate a JavaScript expression or short script in a sandboxed environment and return the result. Use for calculations, data transformations, and logic that requires code.
    executor: builtin
    parameters:
      type: object
      properties:
        code:
          type: string
          description: JavaScript expression or statement to evaluate. Must return a value.
      required:
        - code
---

# Code Execution Skill

You can execute JavaScript code directly in the browser sandbox.

## When to use `js_eval`
- When a calculation is too complex or error-prone to do mentally.
- When the user asks you to run, test, or verify a code snippet.
- When you need to transform, sort, filter, or process data programmatically.
- For string manipulation, regex matching, or JSON parsing.

## Rules and limitations
- Execution is limited to 3 seconds; avoid infinite loops.
- No access to the DOM, network, or filesystem (use workspace tools for that).
- The code must **return** a value (either as an expression or explicit `return` statement).
- Complex multi-step logic: use a block with `return` at the end.
- Prefer showing the result clearly to the user after execution.

## Examples
```javascript
// Simple expression
2 ** 10

// Block with return
const arr = [3, 1, 4, 1, 5, 9];
arr.sort((a, b) => a - b);
return arr;
```
