/**
 * Workspace file storage backed by IndexedDB.
 * Each agent session gets an isolated virtual filesystem.
 */
import { WorkspaceFile, WorkspaceFileMetadata } from '../types';

const DB_NAME = 'forsion_workspaces';
const DB_VERSION = 1;
const STORE_NAME = 'files';

class WorkspaceService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: ['sessionId', 'path'] });
          store.createIndex('by-session', 'sessionId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDB();
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  private wrap<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async writeFile(sessionId: string, path: string, content: ArrayBuffer, mimeType: string): Promise<void> {
    const store = await this.tx('readwrite');
    const now = Date.now();
    const existing = await this.wrap(store.get([sessionId, path])) as WorkspaceFile | undefined;
    const record: WorkspaceFile = {
      sessionId,
      path,
      content,
      mimeType,
      size: content.byteLength,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.wrap(store.put(record));
    this.notifyChange(sessionId);
  }

  async writeTextFile(sessionId: string, path: string, text: string, mimeType?: string): Promise<void> {
    const encoder = new TextEncoder();
    const content = encoder.encode(text).buffer as ArrayBuffer;
    await this.writeFile(sessionId, path, content, mimeType ?? 'text/plain');
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async readFile(sessionId: string, path: string): Promise<WorkspaceFile | null> {
    const store = await this.tx('readonly');
    const record = await this.wrap(store.get([sessionId, path]));
    return (record as WorkspaceFile) ?? null;
  }

  async readTextFile(sessionId: string, path: string): Promise<string | null> {
    const file = await this.readFile(sessionId, path);
    if (!file) return null;
    const decoder = new TextDecoder();
    return decoder.decode(file.content);
  }

  async readFileAsDataUrl(sessionId: string, path: string): Promise<string | null> {
    const file = await this.readFile(sessionId, path);
    if (!file) return null;
    return new Promise((resolve) => {
      const blob = new Blob([file.content], { type: file.mimeType });
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  // ── List ───────────────────────────────────────────────────────────────────

  async listFiles(sessionId: string): Promise<WorkspaceFileMetadata[]> {
    const store = await this.tx('readonly');
    const index = store.index('by-session');
    const records = await this.wrap(index.getAll(sessionId)) as WorkspaceFile[];
    return records.map(({ path, mimeType, size, createdAt, updatedAt }) => ({
      path, mimeType, size, createdAt, updatedAt,
    }));
  }

  async hasFiles(sessionId: string): Promise<boolean> {
    const store = await this.tx('readonly');
    const index = store.index('by-session');
    const key = await this.wrap(index.getKey(sessionId));
    return key !== undefined;
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async deleteFile(sessionId: string, path: string): Promise<boolean> {
    const store = await this.tx('readwrite');
    const existing = await this.wrap(store.get([sessionId, path]));
    if (!existing) return false;
    await this.wrap(store.delete([sessionId, path]));
    this.notifyChange(sessionId);
    return true;
  }

  async deleteAllFiles(sessionId: string): Promise<void> {
    const store = await this.tx('readwrite');
    const index = store.index('by-session');
    const keys = await this.wrap(index.getAllKeys(sessionId));
    for (const key of keys) {
      store.delete(key);
    }
    this.notifyChange(sessionId);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  private notifyChange(sessionId: string) {
    window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { sessionId } }));
  }
}

export const workspaceService = new WorkspaceService();
