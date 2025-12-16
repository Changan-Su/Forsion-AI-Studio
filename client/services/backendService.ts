
import { User, AppSettings, UserRole } from '../types';
import { DEFAULT_MODEL_ID } from '../constants';
import { API_BASE_URL } from '../config';

// Single source of truth for backend base URL
const API_URL = API_BASE_URL;
const API_ROOT = API_URL.replace(/\/api$/, '') || API_URL;

type ConnectionListener = (online: boolean) => void;
let isOnline = true;
const connectionListeners = new Set<ConnectionListener>();

class AuthRequiredError extends Error {
  code = 'AUTH_REQUIRED' as const;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

const notifyConnection = (online: boolean) => {
  if (isOnline === online) return;
  isOnline = online;
  connectionListeners.forEach(listener => {
    try {
      listener(online);
    } catch (err) {
      console.error('Connection listener error', err);
    }
  });
};

const markOnline = () => notifyConnection(true);
const markOffline = () => notifyConnection(false);

const subscribeToConnection = (listener: ConnectionListener) => {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
};

const isNetworkError = (err: unknown) => {
  // In browsers, failed fetch typically throws TypeError
  return err instanceof TypeError;
};

const clearAuth = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('current_username');
  localStorage.removeItem('forsion_current_user');
};

const extractDetail = async (res: Response): Promise<string | undefined> => {
  try {
    const data: any = await res.json();
    return data?.detail || data?.message;
  } catch {
    return undefined;
  }
};

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// --- Offline Mock Helpers ---
// These ensure the app works even if the Python backend is not running.

const MOCK_STORAGE_KEYS = {
  USERS: 'forsion_mock_users',
  SETTINGS_PREFIX: 'forsion_mock_settings_',
};

const getMockUsers = (): any[] => {
  try {
    const s = localStorage.getItem(MOCK_STORAGE_KEYS.USERS);
    if (!s) {
       // Seed default admin if storage is empty
       const defaultAdmin = {
         id: 'admin-001',
         username: 'admin',
         password: 'admin',
         role: UserRole.ADMIN,
         settings: {}
       };
       localStorage.setItem(MOCK_STORAGE_KEYS.USERS, JSON.stringify([defaultAdmin]));
       return [defaultAdmin];
    }
    return JSON.parse(s);
  } catch { return []; }
};

const saveMockUsers = (users: any[]) => {
  localStorage.setItem(MOCK_STORAGE_KEYS.USERS, JSON.stringify(users));
};

const getMockSettings = (username: string): AppSettings => {
  try {
    const s = localStorage.getItem(`${MOCK_STORAGE_KEYS.SETTINGS_PREFIX}${username}`);
    return s ? JSON.parse(s) : { externalApiConfigs: {} };
  } catch { return { externalApiConfigs: {} }; }
};

const saveMockSettings = (username: string, settings: AppSettings) => {
  localStorage.setItem(`${MOCK_STORAGE_KEYS.SETTINGS_PREFIX}${username}`, JSON.stringify(settings));
};

export const backendService = {
  subscribeToConnection,
  isBackendOnline: () => isOnline,
  async pingBackend(): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/health`);
      // Any HTTP response means backend is reachable
      markOnline();
      return res.ok;
    } catch (error) {
      console.warn('Backend ping failed', error);
      if (isNetworkError(error)) markOffline();
      return false;
    }
  },
  // 1. Login
  async login(username: string, password: string): Promise<User | null> {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      markOnline();

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('current_username', data.user.username);
        return data.user as User;
      }

      // Invalid credentials are NOT "offline"
      if (res.status === 401 || res.status === 403) {
        return null;
      }

      const detail = await extractDetail(res);
      throw new Error(detail || 'Login failed');
    } catch (e) {
      if (isNetworkError(e)) {
        console.warn("Backend unavailable, using Offline Mock Mode for Login.");
        markOffline();

        // Offline Fallback
        const users = getMockUsers();
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
          localStorage.setItem('current_username', user.username);
          // Simulate a token
          localStorage.setItem('auth_token', `mock-token-${user.username}`);
          return { id: user.id, username: user.username, role: user.role };
        }
        return null;
      }

      // Backend reachable but error happened
      markOnline();
      throw e;
    }
  },

  // 3. Get Settings
  async getSettings(): Promise<AppSettings> {
    const currentUser = localStorage.getItem('current_username');
    
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'GET',
        headers: getHeaders()
      });
      markOnline();

      if (res.status === 401) {
        clearAuth();
        throw new AuthRequiredError();
      }

      if (res.ok) return await res.json();

      const detail = await extractDetail(res);
      throw new Error(detail || 'Fetch settings failed');
    } catch (e) {
      if (e instanceof AuthRequiredError) throw e;

      if (isNetworkError(e)) {
        markOffline();
        // Offline Fallback
        if (currentUser) {
          return { defaultModelId: DEFAULT_MODEL_ID, ...getMockSettings(currentUser) };
        }
        return { externalApiConfigs: {}, defaultModelId: DEFAULT_MODEL_ID };
      }

      // Backend reachable but request failed
      markOnline();
      throw e;
    }
  },

  // 4. Update Settings
  async updateSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
    const currentUser = localStorage.getItem('current_username');

    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(newSettings)
      });
      markOnline();

      if (res.status === 401) {
        clearAuth();
        throw new AuthRequiredError();
      }

      if (res.ok) return await res.json();

      const detail = await extractDetail(res);
      throw new Error(detail || 'Update settings failed');
    } catch (e) {
      if (e instanceof AuthRequiredError) throw e;

      if (isNetworkError(e)) {
        markOffline();
        // Offline Fallback
        if (currentUser) {
          const current = getMockSettings(currentUser);
          const updated = { ...current, ...newSettings };
          saveMockSettings(currentUser, updated);
          return updated;
        }
      } else {
        markOnline();
        throw e;
      }
    }
    return newSettings as AppSettings;
  },

  // 5. Change Password
  async changePassword(username: string, newPassword: string, currentPassword?: string): Promise<boolean> {
     try {
       const res = await fetch(`${API_URL}/auth/password`, {
         method: 'PUT',
         headers: getHeaders(),
         body: JSON.stringify({ 
           currentPassword: currentPassword || '', 
           newPassword 
         })
       });
       markOnline();
       if (res.status === 401) {
         clearAuth();
         throw new AuthRequiredError();
       }
       if (!res.ok) {
         const detail = await extractDetail(res);
         throw new Error(detail || 'Failed to update password');
       }
       const data = await res.json();
       return data.success === true;
     } catch (e) {
       if (e instanceof AuthRequiredError) throw e;
       if (isNetworkError(e)) {
         console.warn("Backend unavailable, using Offline Mock Mode for Password Change.");
         markOffline();
         
         // Offline Fallback
         const users = getMockUsers();
         const userIdx = users.findIndex(u => u.username === username);
         if (userIdx !== -1) {
           users[userIdx].password = newPassword;
           saveMockUsers(users);
           return true;
         }
         return false;
       }
       markOnline();
       throw e;
     }
  },

  // 6. Admin - List Users
  async listUsers(): Promise<User[]> {
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: getHeaders()
      });
      if (!res.ok) {
        markOnline();
        if (res.status === 401) {
          clearAuth();
          throw new AuthRequiredError();
        }
        const detail = await extractDetail(res);
        throw new Error(detail || 'Failed to load users');
      }
      markOnline();
      return await res.json();
    } catch (error) {
      if (error instanceof AuthRequiredError) throw error;
      if (isNetworkError(error)) markOffline();
      else markOnline();
      throw error;
    }
  },

  // 7. Admin - Create User
  async createUserAccount(username: string, password: string, role: UserRole = UserRole.USER): Promise<User> {
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ username, password, role })
      });
      if (!res.ok) {
        markOnline();
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create user');
      }
      markOnline();
      return await res.json();
    } catch (error) {
      markOffline();
      throw error;
    }
  },

  // 8. Admin - Get User Details
  async getUserDetails(username: string): Promise<User> {
    try {
      const res = await fetch(`${API_URL}/admin/users/${username}`, {
        headers: getHeaders()
      });
      if (!res.ok) {
        markOnline();
        if (res.status === 401) {
          clearAuth();
          throw new AuthRequiredError();
        }
        const detail = await extractDetail(res);
        throw new Error(detail || 'Failed to load user details');
      }
      markOnline();
      return await res.json();
    } catch (error) {
      if (error instanceof AuthRequiredError) throw error;
      if (isNetworkError(error)) markOffline();
      else markOnline();
      throw error;
    }
  },

  // 9. Admin - Delete User
  async deleteUserAccount(username: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/admin/users/${username}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) {
        markOnline();
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete user');
      }
      markOnline();
      return true;
    } catch (error) {
      markOffline();
      throw error;
    }
  },

  // 10. Parse File - Extract text from PDF, Word, etc.
  async parseFile(file: File): Promise<{ text: string | null; base64: string | null; filename: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${API_URL}/parse-file`, {
        method: 'POST',
        headers: {
          'Authorization': getHeaders()['Authorization'] || ''
        },
        body: formData
      });
      
      if (!res.ok) {
        throw new Error('File parsing failed');
      }
      
      markOnline();
      return await res.json();
    } catch (error) {
      console.warn('Backend file parsing failed, falling back to client-side', error);
      markOffline();
      // Return null to indicate client should handle
      return { text: null, base64: null, filename: file.name };
    }
  },

  // 11. Parse Base64 - Extract text from base64 encoded file
  async parseBase64(base64Data: string, filename: string, contentType: string): Promise<{ text: string | null }> {
    try {
      const res = await fetch(`${API_URL}/parse-base64`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          data: base64Data,
          filename: filename,
          content_type: contentType
        })
      });
      
      if (!res.ok) {
        throw new Error('Base64 parsing failed');
      }
      
      markOnline();
      return await res.json();
    } catch (error) {
      console.warn('Backend base64 parsing failed', error);
      markOffline();
      return { text: null };
    }
  },

  // 12. Get Global Models from backend
  async getGlobalModels(): Promise<any[]> {
    try {
      const res = await fetch(`${API_URL}/models`, {
        headers: getHeaders()
      });
      markOnline();
      if (res.status === 401) {
        clearAuth();
        throw new AuthRequiredError();
      }
      if (res.ok) return await res.json();
      return [];
    } catch (error) {
      if (error instanceof AuthRequiredError) throw error;
      if (isNetworkError(error)) markOffline();
      else markOnline();
      console.warn('Failed to fetch global models', error);
      return [];
    }
  },

  // 13. Log API Usage
  async logApiUsage(
    modelId: string,
    modelName: string,
    provider: string,
    tokensInput: number = 0,
    tokensOutput: number = 0,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      const params = new URLSearchParams({
        model_id: modelId,
        model_name: modelName,
        provider: provider,
        tokens_input: tokensInput.toString(),
        tokens_output: tokensOutput.toString(),
        success: success.toString(),
        ...(errorMessage && { error_message: errorMessage })
      });
      
      await fetch(`${API_URL}/usage/log?${params}`, {
        method: 'POST',
        headers: getHeaders()
      });
    } catch (error) {
      // Silent fail for usage logging
      console.warn('Failed to log API usage', error);
    }
  },

  // 14. Proxy Chat Completions (for global models)
  async proxyChatCompletions(
    modelId: string,
    messages: Array<{ role: string; content: string }>,
    temperature: number = 0.7,
    enableThinking: boolean = false,
    maxTokens?: number,
    signal?: AbortSignal
  ): Promise<{ content: string; reasoning?: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
    try {
      // Modify messages if thinking is enabled
      let finalMessages = [...messages];
      if (enableThinking && finalMessages.length > 0) {
        const lastMsgIdx = finalMessages.length - 1;
        if (finalMessages[lastMsgIdx].role === 'user') {
          const thinkingPrefix = "Think step by step carefully before answering. Show your reasoning process in <think></think> tags before providing your final answer.\n\n";
          finalMessages[lastMsgIdx] = {
            ...finalMessages[lastMsgIdx],
            content: thinkingPrefix + finalMessages[lastMsgIdx].content
          };
        }
      }

      const res = await fetch(`${API_URL}/chat/completions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          model_id: modelId,
          messages: finalMessages,
          temperature,
          max_tokens: maxTokens
        }),
        signal: signal
      });

      if (!res.ok) {
        markOnline();
        if (res.status === 401) {
          clearAuth();
          throw new AuthRequiredError();
        }
        const detail = await extractDetail(res);
        throw new Error(detail || `API error: ${res.status}`);
      }

      markOnline();
      const data = await res.json();
      
      // Extract content from OpenAI-style response
      const choice = data.choices?.[0];
      let content = choice?.message?.content || '';
      let reasoning = choice?.message?.reasoning_content || choice?.message?.reasoning;
      
      // Extract <think> tags from content if no explicit reasoning
      if (!reasoning && content) {
        const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
        let matches = content.match(thinkRegex);
        
        // If no complete tags, try to match incomplete tags (content might be truncated)
        if (!matches && content.includes('<think>')) {
          const incompleteRegex = /<think>([\s\S]*)$/i;
          const incompleteMatch = content.match(incompleteRegex);
          if (incompleteMatch) {
            reasoning = incompleteMatch[1].trim();
            content = content.replace(incompleteRegex, '').trim();
          }
        } else if (matches) {
          reasoning = matches
            .map((m: string) => m.replace(/<\/?think>/gi, '').trim())
            .join('\n');
          content = content.replace(thinkRegex, '').trim();
        }
      }
      
      return {
        content,
        reasoning,
        usage: data.usage
      };
    } catch (error) {
      if (error instanceof AuthRequiredError) throw error;
      if (isNetworkError(error)) markOffline();
      else markOnline();
      throw error;
    }
  },

  // 15. Register
  async register(username: string, password: string, inviteCode: string): Promise<User> {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, invite_code: inviteCode })
      });
      
      if (!res.ok) {
        markOnline();
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Registration failed');
      }
      
      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('current_username', data.user.username);
      markOnline();
      return data.user as User;
    } catch (error: any) {
      markOffline();
      throw error;
    }
  },

  // 16. Get Credit Balance
  async getCreditBalance(): Promise<number> {
    try {
      const res = await fetch(`${API_URL}/credits/balance`, {
        headers: getHeaders()
      });
      markOnline();
      if (res.status === 401) {
        clearAuth();
        throw new AuthRequiredError();
      }
      if (!res.ok) {
        const detail = await extractDetail(res);
        throw new Error(detail || 'Failed to get credit balance');
      }
      const data = await res.json();
      return data.balance || 0;
    } catch (error) {
      if (error instanceof AuthRequiredError) throw error;
      if (isNetworkError(error)) markOffline();
      else markOnline();
      return 0;
    }
  },

  // 17. Get Credit Transactions
  async getCreditTransactions(limit: number = 50): Promise<any[]> {
    try {
      const res = await fetch(`${API_URL}/credits/transactions?limit=${limit}`, {
        headers: getHeaders()
      });
      markOnline();
      if (res.status === 401) {
        clearAuth();
        throw new AuthRequiredError();
      }
      if (!res.ok) {
        const detail = await extractDetail(res);
        throw new Error(detail || 'Failed to get transactions');
      }
      return await res.json();
    } catch (error) {
      if (error instanceof AuthRequiredError) throw error;
      if (isNetworkError(error)) markOffline();
      else markOnline();
      return [];
    }
  },

  // 18. Admin - List Invite Codes
  async listInviteCodes(): Promise<any[]> {
    try {
      const res = await fetch(`${API_URL}/admin/invite-codes`, {
        headers: getHeaders()
      });
      if (!res.ok) {
        markOnline();
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to list invite codes');
      }
      markOnline();
      return await res.json();
    } catch (error) {
      markOffline();
      throw error;
    }
  },

  // 19. Admin - Create Invite Code
  async createInviteCode(
    code: string,
    maxUses: number,
    initialCredits: number,
    expiresAt?: string,
    notes?: string
  ): Promise<any> {
    try {
      const res = await fetch(`${API_URL}/admin/invite-codes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          code,
          max_uses: maxUses,
          initial_credits: initialCredits,
          expires_at: expiresAt,
          notes
        })
      });
      if (!res.ok) {
        markOnline();
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create invite code');
      }
      markOnline();
      return await res.json();
    } catch (error) {
      markOffline();
      throw error;
    }
  },

  // 20. Admin - Update Invite Code
  async updateInviteCode(
    id: string,
    updates: {
      max_uses?: number;
      initial_credits?: number;
      expires_at?: string | null;
      is_active?: boolean;
      notes?: string;
    }
  ): Promise<any> {
    try {
      const res = await fetch(`${API_URL}/admin/invite-codes/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        markOnline();
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update invite code');
      }
      markOnline();
      return await res.json();
    } catch (error) {
      markOffline();
      throw error;
    }
  },

  // 21. Admin - Delete Invite Code
  async deleteInviteCode(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/admin/invite-codes/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) {
        markOnline();
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete invite code');
      }
      markOnline();
      return true;
    } catch (error) {
      markOffline();
      throw error;
    }
  },

  // 22. Admin - List Credit Pricing
  async listCreditPricing(): Promise<any[]> {
    try {
      const res = await fetch(`${API_URL}/admin/credit-pricing`, {
        headers: getHeaders()
      });
      if (!res.ok) {
        markOnline();
        throw new Error('Failed to list pricing');
      }
      markOnline();
      return await res.json();
    } catch (error) {
      markOffline();
      return [];
    }
  },

  // 23. Admin - Set Credit Pricing
  async setCreditPricing(
    modelId: string,
    tokensPerCredit: number,
    inputMultiplier: number = 1.0,
    outputMultiplier: number = 1.0,
    provider?: string
  ): Promise<any> {
    try {
      const res = await fetch(`${API_URL}/admin/credit-pricing`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          model_id: modelId,
          tokens_per_credit: tokensPerCredit,
          input_multiplier: inputMultiplier,
          output_multiplier: outputMultiplier,
          provider
        })
      });
      if (!res.ok) {
        markOnline();
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to set pricing');
      }
      markOnline();
      return await res.json();
    } catch (error) {
      markOffline();
      throw error;
    }
  }
};
