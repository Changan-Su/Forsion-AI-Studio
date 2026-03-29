/**
 * Memory service — single Markdown text per user, synced via backend API.
 */
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

const getHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export async function readMemory(): Promise<string> {
  const res = await fetch(`${API_URL}/ai-studio/memory`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Failed to read memory: ${res.status}`);
  const data = await res.json();
  return data.content ?? '';
}

export async function writeMemory(content: string): Promise<void> {
  const res = await fetch(`${API_URL}/ai-studio/memory`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Failed to write memory: ${res.status}`);
}

export async function appendMemory(text: string): Promise<void> {
  const res = await fetch(`${API_URL}/ai-studio/memory/append`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Failed to append to memory: ${res.status}`);
}

export function downloadMemoryFile(content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'memory.md';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importMemoryFile(file: File): Promise<string> {
  const text = await file.text();
  await writeMemory(text);
  return text;
}
