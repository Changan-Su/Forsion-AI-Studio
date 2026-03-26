/**
 * Web Worker for Pyodide Python execution.
 * Loaded lazily — Pyodide is fetched from CDN on first init.
 */

declare const self: DedicatedWorkerGlobalScope;
declare function importScripts(...urls: string[]): void;

// Pyodide globals injected by importScripts
declare let loadPyodide: () => Promise<any>;

let pyodide: any = null;

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';

// ── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      importScripts(PYODIDE_CDN + 'pyodide.js');
      pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });
      // Pre-load commonly used packages (numpy/matplotlib are in the Pyodide repo but not in the
      // default runtime — must loadPackage once; avoids requiring users to micropip.install.)
      await pyodide.loadPackage(['micropip', 'numpy', 'matplotlib']);
      self.postMessage({ type: 'ready' });
    } catch (err: any) {
      self.postMessage({ type: 'error', id: 'init', error: `Pyodide init failed: ${err.message}` });
    }
    return;
  }

  if (msg.type === 'execute') {
    const { id, code, files } = msg;
    const startTime = Date.now();

    if (!pyodide) {
      self.postMessage({ type: 'error', id, error: 'Pyodide not initialized' });
      return;
    }

    try {
      // Mount workspace files into Emscripten FS
      try { pyodide.FS.mkdir('/workspace'); } catch { /* already exists */ }

      // Snapshot existing workspace files
      const existingFiles = new Set<string>();
      try {
        const entries = pyodide.FS.readdir('/workspace');
        for (const entry of entries) {
          if (entry !== '.' && entry !== '..') existingFiles.add(entry);
        }
      } catch { /* dir may not exist yet */ }

      // Write input files
      for (const f of files) {
        const parts = f.path.split('/');
        let dir = '/workspace';
        for (let i = 0; i < parts.length - 1; i++) {
          dir += '/' + parts[i];
          try { pyodide.FS.mkdir(dir); } catch { /* exists */ }
        }
        pyodide.FS.writeFile('/workspace/' + f.path, new Uint8Array(f.content));
      }

      // Capture stdout/stderr
      let stdout = '';
      let stderr = '';
      pyodide.setStdout({ batched: (text: string) => { stdout += text + '\n'; } });
      pyodide.setStderr({ batched: (text: string) => { stderr += text + '\n'; } });

      // Inject matplotlib patch for auto-saving plots
      const preamble = `
import sys, os
os.chdir('/workspace')
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    _plot_counter = [0]
    _orig_show = plt.show
    def _auto_show(*args, **kwargs):
        _plot_counter[0] += 1
        _fname = f'/workspace/_plot_{_plot_counter[0]}.png'
        plt.savefig(_fname, dpi=100, bbox_inches='tight')
        print(f'[Plot saved to _plot_{_plot_counter[0]}.png]')
        plt.clf()
    plt.show = _auto_show
except ImportError:
    pass
`;
      await pyodide.runPythonAsync(preamble);

      // Execute user code with timeout
      const timeoutMs = 30000;
      const result = await Promise.race([
        pyodide.runPythonAsync(code),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timed out (30s)')), timeoutMs)),
      ]);

      // If code returns a value, append it to stdout
      if (result !== undefined && result !== null) {
        const repr = pyodide.isPyProxy(result) ? result.toString() : String(result);
        if (repr && repr !== 'None') stdout += repr + '\n';
      }

      // Scan for new/modified files in /workspace
      const generatedFiles: Array<{ path: string; content: ArrayBuffer; mimeType: string }> = [];
      try {
        const scanDir = (dir: string, prefix: string) => {
          const entries = pyodide.FS.readdir(dir);
          for (const entry of entries) {
            if (entry === '.' || entry === '..') continue;
            const fullPath = dir + '/' + entry;
            const relPath = prefix ? prefix + '/' + entry : entry;
            try {
              const stat = pyodide.FS.stat(fullPath);
              if (pyodide.FS.isDir(stat.mode)) {
                scanDir(fullPath, relPath);
              } else {
                // Check if this is a new or modified file
                const data: Uint8Array = pyodide.FS.readFile(fullPath);
                const isInput = files.some((f: any) => f.path === relPath);
                if (!isInput || !existingFiles.has(entry)) {
                  const mimeType = relPath.endsWith('.png') ? 'image/png'
                    : relPath.endsWith('.jpg') || relPath.endsWith('.jpeg') ? 'image/jpeg'
                    : relPath.endsWith('.svg') ? 'image/svg+xml'
                    : relPath.endsWith('.csv') ? 'text/csv'
                    : relPath.endsWith('.json') ? 'application/json'
                    : relPath.endsWith('.py') ? 'text/x-python'
                    : 'application/octet-stream';
                  generatedFiles.push({
                    path: relPath,
                    content: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
                    mimeType,
                  });
                }
              }
            } catch { /* skip unreadable */ }
          }
        };
        scanDir('/workspace', '');
      } catch { /* scan failure is non-fatal */ }

      self.postMessage(
        { type: 'result', id, stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), generatedFiles, durationMs: Date.now() - startTime },
        // Transfer ArrayBuffers for efficiency
        generatedFiles.map(f => f.content)
      );

    } catch (err: any) {
      self.postMessage({ type: 'error', id, error: err.message || String(err) });
    }
  }
};
