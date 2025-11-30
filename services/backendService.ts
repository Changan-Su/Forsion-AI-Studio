
import { User, AppSettings, UserRole } from '../types';

// Points to your local Python FastAPI server
const API_URL = 'http://localhost:3001/api';

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
  // 1. Login
  async login(username: string, password: string): Promise<User | null> {
    try {
      // Try Online Backend
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('auth_token', data.token);
        // Store username for offline settings retrieval context if needed
        localStorage.setItem('current_username', data.user.username); 
        return data.user as User;
      }
      throw new Error("Backend login failed"); // Trigger fallback if 401 or network error
    } catch (e) {
      console.warn("Backend unavailable, using Offline Mock Mode for Login.");
      
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
  },

  // 2. Register
  async register(username: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
          return { success: true };
      }
      if (!res.ok && res.status !== 404) throw new Error("Backend Error");
      return { success: false, message: data.message || "Registration failed" };
    } catch (e) {
      console.warn("Backend unavailable, using Offline Mock Mode for Registration.");
      
      // Offline Fallback
      const users = getMockUsers();
      if (users.find(u => u.username === username)) {
        return { success: false, message: "Username already exists (Offline)" };
      }
      
      const newUser = {
        id: `user-${Date.now()}`,
        username,
        password, // In real app, never store plain text
        role: UserRole.USER, // Default role (Always USER for new registrations)
        settings: {}
      };
      
      users.push(newUser);
      saveMockUsers(users);
      
      return { success: true };
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
      if (res.ok) return await res.json();
      throw new Error("Fetch settings failed");
    } catch (e) {
      // Offline Fallback
      if (currentUser) {
        return getMockSettings(currentUser);
      }
      return { externalApiConfigs: {} };
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
      if (res.ok) return await res.json();
      throw new Error("Update settings failed");
    } catch (e) {
      // Offline Fallback
      if (currentUser) {
        const current = getMockSettings(currentUser);
        const updated = { ...current, ...newSettings };
        saveMockSettings(currentUser, updated);
        return updated;
      }
    }
    return newSettings as AppSettings;
  },

  // 5. Change Password
  async changePassword(username: string, newPassword: string): Promise<boolean> {
     try {
       const res = await fetch(`${API_URL}/auth/password`, {
         method: 'POST',
         headers: getHeaders(),
         body: JSON.stringify({ new_password: newPassword })
       });
       const data = await res.json();
       return data.success === true;
     } catch (e) {
       console.warn("Backend unavailable, using Offline Mock Mode for Password Change.");
       
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
  }
};
