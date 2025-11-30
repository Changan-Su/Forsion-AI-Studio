import { User, AppSettings, UserRole, AIModel } from '../types';
import { STORAGE_KEYS, DEFAULT_API_KEY, DEFAULT_BASE_URL } from '../constants';

// --- MOCK DATABASE SCHEMA ---
interface DatabaseSchema {
  users: User[];
  settings: AppSettings;
}

// Default Settings
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  themePreset: 'default',
  customModels: [],
  externalApiConfigs: {
    'openai': { apiKey: DEFAULT_API_KEY, baseUrl: DEFAULT_BASE_URL },
    'deepseek': { apiKey: DEFAULT_API_KEY, baseUrl: DEFAULT_BASE_URL },
  }
};

const DEFAULT_ADMIN: User = {
  id: 'admin-001',
  username: 'admin',
  role: UserRole.ADMIN,
  // In a real backend, password would be hashed.
  // We store it here in the object for simulation purposes.
  // @ts-ignore
  password: 'admin' 
};

// --- BACKEND SERVICE ---

const loadDb = (): DatabaseSchema => {
  const usersStr = localStorage.getItem(STORAGE_KEYS.USERS);
  const settingsStr = localStorage.getItem(STORAGE_KEYS.SETTINGS);

  let users = usersStr ? JSON.parse(usersStr) : [DEFAULT_ADMIN];
  let settings = settingsStr ? JSON.parse(settingsStr) : DEFAULT_SETTINGS;

  return { users, settings };
};

const saveDb = (db: DatabaseSchema) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(db.users));
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(db.settings));
};

export const backendService = {
  // --- SETTINGS ENDPOINTS ---
  
  async getSettings(): Promise<AppSettings> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));
    const db = loadDb();
    return db.settings;
  },

  async updateSettings(newSettings: AppSettings): Promise<AppSettings> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const db = loadDb();
    db.settings = { ...db.settings, ...newSettings };
    saveDb(db);
    return db.settings;
  },

  // --- AUTH ENDPOINTS ---

  async login(username: string, password: string): Promise<User | null> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const db = loadDb();
    // @ts-ignore
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
      // Return user without password
      // @ts-ignore
      const { password: _, ...safeUser } = user;
      return safeUser as User;
    }
    return null;
  },

  async register(username: string, password: string): Promise<{ success: boolean; message?: string }> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const db = loadDb();
    
    if (db.users.find(u => u.username === username)) {
      return { success: false, message: 'Username already exists' };
    }

    const newUser = {
      id: `user-${Date.now()}`,
      username,
      password, // In real app, hash this
      role: UserRole.USER
    };

    db.users.push(newUser as any);
    saveDb(db);
    return { success: true };
  },

  async changePassword(username: string, newPassword: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const db = loadDb();
    const index = db.users.findIndex(u => u.username === username);
    
    if (index !== -1) {
      // @ts-ignore
      db.users[index].password = newPassword;
      saveDb(db);
      return true;
    }
    return false;
  }
};