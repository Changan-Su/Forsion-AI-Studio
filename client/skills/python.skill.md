---
id: python
name: Python
description: Execute Python code with numpy, pandas, matplotlib, scipy and more
icon: Code2
isBuiltin: true
tools:
  - name: run_python
    description: Execute Python code in a sandboxed Pyodide environment. Workspace files are accessible at /workspace/. Supports numpy, pandas, matplotlib, scipy, scikit-learn, sympy, and more. Use plt.show() to save plots.
    executor: builtin
    parameters:
      type: object
      properties:
        code:
          type: string
          description: Python code to execute
      required:
        - code
---

# Python Skill

You can run Python code in a browser-based sandbox powered by Pyodide.

## Available packages
Pre-loaded (instant):
- `numpy` — numerical computing, arrays, linear algebra
- `pandas` — data manipulation, DataFrames, CSV/JSON I/O
- `matplotlib` — plotting and visualization
- `scipy` — scientific computing, optimization, statistics, signal processing
- `scikit-learn` — machine learning (classification, regression, clustering)
- `sympy` — symbolic mathematics, equation solving
- `regex` — advanced regular expressions

Always available (Python standard library):
- `math`, `statistics`, `random`, `itertools`, `functools`
- `json`, `csv`, `re`, `datetime`, `collections`, `dataclasses`
- `io`, `os`, `sys`, `pathlib`, `textwrap`, `decimal`, `fractions`

## File I/O
- Workspace files are at `/workspace/<path>` (e.g. `/workspace/data.csv`).
- Read files with `pd.read_csv('/workspace/data.csv')` or standard `open()`.
- Write output files to `/workspace/` — they appear in the workspace panel.
- New or modified files in `/workspace/` are automatically saved back.

## Plotting
- Use `matplotlib.pyplot` as usual.
- Call `plt.show()` to save the figure as PNG to the workspace (auto-saved, no `savefig` needed).
- Then use `show_image` (from workspace tools) to display the plot inline.

## Execution limits
- 30 second timeout per execution.
- No network access (no `requests`, `urllib`).
- No OS-level operations (no subprocess, no file access outside `/workspace/`).
- Print to stdout to see output; stderr is also captured.

## Tips
- For data analysis: load CSV → process with pandas → plot with matplotlib → show_image.
- For math: use sympy for symbolic math, numpy for numerical.
- For ML: scikit-learn for quick models (train/test split, fit, predict, evaluate).
- Always `print()` results you want to show the user.
