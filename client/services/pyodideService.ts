/**
 * Main-thread API for Pyodide Python execution via Web Worker.
 * Lazy-loads Pyodide (~10MB) only when first called.
 */
import { PythonExecutionResult } from '../types';
import { workspaceService } from './workspaceService';

class PyodideService {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private pendingRequests = new Map<string, {
    resolve: (result: PythonExecutionResult) => void;
    reject: (error: Error) => void;
  }>();
  private requestId = 0;

  async ensureReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(
          new URL('./pyodideWorker.ts', import.meta.url),
          { type: 'classic' }  // importScripts requires classic worker
        );

        this.worker.onmessage = (e: MessageEvent) => {
          const msg = e.data;

          if (msg.type === 'ready') {
            resolve();
            return;
          }

          if (msg.type === 'error' && msg.id === 'init') {
            reject(new Error(msg.error));
            return;
          }

          // Route execution results to pending requests
          const pending = this.pendingRequests.get(msg.id);
          if (!pending) return;
          this.pendingRequests.delete(msg.id);

          if (msg.type === 'result') {
            pending.resolve({
              stdout: msg.stdout,
              stderr: msg.stderr,
              generatedFiles: msg.generatedFiles,
              durationMs: msg.durationMs,
            });
          } else if (msg.type === 'error') {
            pending.reject(new Error(msg.error));
          }
        };

        this.worker.onerror = (err) => {
          reject(new Error(`Worker error: ${err.message}`));
        };

        this.worker.postMessage({ type: 'init' });
      } catch (err) {
        this.readyPromise = null;
        reject(err);
      }
    });

    return this.readyPromise;
  }

  async execute(
    sessionId: string,
    code: string,
    signal?: AbortSignal
  ): Promise<PythonExecutionResult> {
    await this.ensureReady();

    if (!this.worker) throw new Error('Pyodide worker not available');

    // Read workspace files to pass to worker
    const filesMeta = await workspaceService.listFiles(sessionId);
    const files: Array<{ path: string; content: ArrayBuffer }> = [];
    for (const meta of filesMeta) {
      const file = await workspaceService.readFile(sessionId, meta.path);
      if (file) {
        files.push({ path: meta.path, content: file.content });
      }
    }

    const id = `exec_${++this.requestId}`;

    const result = await new Promise<PythonExecutionResult>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Handle abort
      if (signal) {
        const onAbort = () => {
          this.pendingRequests.delete(id);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      this.worker!.postMessage(
        { type: 'execute', id, code, files },
        files.map(f => f.content) // transfer ArrayBuffers
      );
    });

    // Persist generated files back to workspace
    for (const gen of result.generatedFiles) {
      await workspaceService.writeFile(sessionId, gen.path, gen.content, gen.mimeType);
    }

    return result;
  }
}

export const pyodideService = new PyodideService();
