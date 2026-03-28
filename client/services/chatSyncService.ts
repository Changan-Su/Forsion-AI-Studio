import { ChatSession, Message } from '../types';
import { API_BASE_URL, APP_ID } from '../config';

const getHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const isAuthed = () => !!localStorage.getItem('auth_token');

interface RemoteSessionMeta {
  id: string;
  app_id: string;
  title: string;
  model_id: string;
  emoji: string | null;
  archived: boolean;
  agent_config: any;
  updated_at: string;
  created_at: string;
}

interface RemoteMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: number;
  model_id: string | null;
  reasoning: string | null;
  is_error: boolean;
  tool_calls: any;
  tool_results: any;
  attachments: any;
}

function remoteToLocal(meta: RemoteSessionMeta, messages: Message[] = []): ChatSession {
  return {
    id: meta.id,
    title: meta.title,
    modelId: meta.model_id || '',
    messages,
    updatedAt: new Date(meta.updated_at).getTime(),
    emoji: meta.emoji || undefined,
    archived: meta.archived || false,
    agentConfig: meta.agent_config || undefined,
  };
}

function remoteMessageToLocal(m: RemoteMessage): Message {
  return {
    id: m.id,
    role: m.role as Message['role'],
    content: m.content || '',
    timestamp: m.timestamp,
    modelId: m.model_id || undefined,
    reasoning: m.reasoning || undefined,
    isError: m.is_error || false,
    toolCalls: m.tool_calls || undefined,
    toolResults: m.tool_results || undefined,
    attachments: m.attachments || undefined,
  };
}

export const chatSyncService = {
  /**
   * Pull session list (metadata only, no messages) from server.
   * Returns local ChatSession[] with empty messages arrays.
   */
  async fetchSessionList(): Promise<ChatSession[]> {
    if (!isAuthed()) return [];
    try {
      const res = await fetch(
        `${API_BASE_URL}/chat/sessions?app_id=${APP_ID}&limit=200`,
        { headers: getHeaders() }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.sessions || []).map((s: RemoteSessionMeta) => remoteToLocal(s));
    } catch {
      return [];
    }
  },

  /**
   * Lazy-load messages for a specific session from server.
   */
  async fetchSessionMessages(sessionId: string): Promise<Message[]> {
    if (!isAuthed()) return [];
    try {
      const res = await fetch(
        `${API_BASE_URL}/chat/sessions/${sessionId}/messages?limit=200`,
        { headers: getHeaders() }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.messages || []).map(remoteMessageToLocal);
    } catch {
      return [];
    }
  },

  /**
   * Upload a single session (metadata + messages) to server.
   * Called after AI finishes generating a response.
   */
  async uploadSession(session: ChatSession): Promise<boolean> {
    if (!isAuthed()) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/chat/sessions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          id: session.id,
          app_id: APP_ID,
          title: session.title,
          model_id: session.modelId,
          emoji: session.emoji || null,
          archived: session.archived || false,
          agent_config: session.agentConfig || null,
        }),
      });
      if (!res.ok) return false;

      if (session.messages.length > 0) {
        const msgRes = await fetch(
          `${API_BASE_URL}/chat/sessions/${session.id}/messages`,
          {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
              messages: session.messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
                modelId: m.modelId,
                reasoning: m.reasoning,
                isError: m.isError || false,
                toolCalls: m.toolCalls,
                toolResults: m.toolResults,
                attachments: m.attachments?.map(a => ({
                  type: a.type,
                  mimeType: a.mimeType,
                  name: a.name,
                  url: '',
                })),
              })),
            }),
          }
        );
        return msgRes.ok;
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Bulk upload all local sessions to server (initial sync on login).
   */
  async bulkUpload(sessions: ChatSession[]): Promise<boolean> {
    if (!isAuthed() || sessions.length === 0) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/chat/sessions/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          app_id: APP_ID,
          sessions: sessions.map(s => ({
            id: s.id,
            title: s.title,
            modelId: s.modelId,
            emoji: s.emoji || null,
            archived: s.archived || false,
            agentConfig: s.agentConfig || null,
            messages: s.messages.map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              modelId: m.modelId,
              reasoning: m.reasoning,
              isError: m.isError || false,
              toolCalls: m.toolCalls,
              toolResults: m.toolResults,
              attachments: m.attachments?.map(a => ({
                type: a.type,
                mimeType: a.mimeType,
                name: a.name,
                url: '',
              })),
            })),
          })),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Delete a session on the server.
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!isAuthed()) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Merge remote session list with local sessions.
   * Remote sessions not present locally are added (with empty messages, to be lazy-loaded).
   * Local sessions not present remotely are kept (will be uploaded later).
   * When both exist, the newer updatedAt wins for metadata; messages stay local until lazy-loaded.
   */
  mergeSessionLists(local: ChatSession[], remote: ChatSession[]): ChatSession[] {
    const merged = new Map<string, ChatSession>();

    for (const s of local) {
      merged.set(s.id, s);
    }

    for (const rs of remote) {
      const existing = merged.get(rs.id);
      if (!existing) {
        merged.set(rs.id, rs);
      } else if (rs.updatedAt > existing.updatedAt) {
        merged.set(rs.id, {
          ...rs,
          messages: existing.messages.length > 0 ? existing.messages : rs.messages,
          agentConfig: existing.agentConfig || rs.agentConfig,
        });
      }
    }

    return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  },
};
