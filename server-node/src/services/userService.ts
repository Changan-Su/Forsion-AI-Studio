import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import type { User, UserSettings } from '../types/index.js';
import { getDefaultModelId } from './settingsService.js';

export async function createUser(
  username: string,
  password: string,
  role: 'USER' | 'ADMIN' = 'USER'
): Promise<User> {
  const id = uuidv4();
  const hashedPassword = await bcrypt.hash(password, 10);

  await query(
    `INSERT INTO users (id, username, password, role, status) VALUES (?, ?, ?, ?, 'active')`,
    [id, username, hashedPassword, role]
  );

  // Create default settings
  const settingsId = uuidv4();
  await query(
    `INSERT INTO user_settings (id, user_id, theme, theme_preset, custom_models, external_api_configs) 
     VALUES (?, ?, 'light', 'default', '[]', '{}')`,
    [settingsId, id]
  );

  return {
    id,
    username,
    role,
    status: 'active',
  };
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const rows = await query<any[]>(
    `SELECT * FROM users WHERE username = ?`,
    [username]
  );
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    email: row.email,
    role: row.role,
    status: row.status,
    permissions: row.permissions,
    maxRequestsPerDay: row.max_requests_per_day,
    notes: row.notes,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await query<any[]>(
    `SELECT * FROM users WHERE id = ?`,
    [id]
  );
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    permissions: row.permissions,
    maxRequestsPerDay: row.max_requests_per_day,
    notes: row.notes,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function listUsers(): Promise<User[]> {
  const rows = await query<any[]>(`SELECT id, username, email, role, status, created_at FROM users`);
  return rows.map(row => ({
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function updateUser(username: string, updates: Partial<User>): Promise<User | null> {
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.email !== undefined) {
    setClauses.push('email = ?');
    values.push(updates.email);
  }
  if (updates.role !== undefined) {
    setClauses.push('role = ?');
    values.push(updates.role);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.permissions !== undefined) {
    setClauses.push('permissions = ?');
    values.push(updates.permissions);
  }
  if (updates.maxRequestsPerDay !== undefined) {
    setClauses.push('max_requests_per_day = ?');
    values.push(updates.maxRequestsPerDay);
  }
  if (updates.notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(updates.notes);
  }

  if (setClauses.length === 0) {
    return getUserByUsername(username);
  }

  values.push(username);
  await query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE username = ?`,
    values
  );

  return getUserByUsername(username);
}

export async function updatePassword(username: string, newPassword: string): Promise<boolean> {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const result = await query<any>(
    `UPDATE users SET password = ? WHERE username = ?`,
    [hashedPassword, username]
  );
  return result.affectedRows > 0;
}

export async function deleteUser(username: string): Promise<boolean> {
  const result = await query<any>(
    `DELETE FROM users WHERE username = ?`,
    [username]
  );
  return result.affectedRows > 0;
}

export async function updateLastLogin(username: string): Promise<void> {
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE username = ?`,
    [username]
  );
}

export async function getUserSettings(userId: string): Promise<any> {
  const rows = await query<any[]>(
    `SELECT * FROM user_settings WHERE user_id = ?`,
    [userId]
  );

  const defaultModelId = await getDefaultModelId();

  if (rows.length === 0) {
    return {
      theme: 'dark',  // Default to dark theme
      themePreset: 'default',
      customModels: [],
      externalApiConfigs: {},
      developerMode: false,
      defaultModelId,
    };
  }

  const row = rows[0];
  return {
    theme: row.theme,
    themePreset: row.theme_preset,
    customModels: JSON.parse(row.custom_models || '[]'),
    externalApiConfigs: JSON.parse(row.external_api_configs || '{}'),
    developerMode: !!row.developer_mode,
    defaultModelId,
  };
}

export async function updateUserSettings(userId: string, settings: any): Promise<any> {
  const existing = await query<any[]>(
    `SELECT id FROM user_settings WHERE user_id = ?`,
    [userId]
  );

  if (existing.length === 0) {
    const id = uuidv4();
    await query(
      `INSERT INTO user_settings (id, user_id, theme, theme_preset, custom_models, external_api_configs, developer_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        settings.theme || 'light',
        settings.themePreset || 'default',
        JSON.stringify(settings.customModels || []),
        JSON.stringify(settings.externalApiConfigs || {}),
        settings.developerMode ? 1 : 0,
      ]
    );
  } else {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (settings.theme !== undefined) {
      setClauses.push('theme = ?');
      values.push(settings.theme);
    }
    if (settings.themePreset !== undefined) {
      setClauses.push('theme_preset = ?');
      values.push(settings.themePreset);
    }
    if (settings.customModels !== undefined) {
      setClauses.push('custom_models = ?');
      values.push(JSON.stringify(settings.customModels));
    }
    if (settings.externalApiConfigs !== undefined) {
      setClauses.push('external_api_configs = ?');
      values.push(JSON.stringify(settings.externalApiConfigs));
    }
    if (settings.developerMode !== undefined) {
      setClauses.push('developer_mode = ?');
      values.push(settings.developerMode ? 1 : 0);
    }

    if (setClauses.length > 0) {
      values.push(userId);
      await query(
        `UPDATE user_settings SET ${setClauses.join(', ')} WHERE user_id = ?`,
        values
      );
    }
  }

  return getUserSettings(userId);
}

export async function ensureAdminExists(): Promise<void> {
  const admin = await getUserByUsername(process.env.ADMIN_USERNAME || 'admin');
  if (!admin) {
    await createUser(
      process.env.ADMIN_USERNAME || 'admin',
      process.env.ADMIN_PASSWORD || 'admin',
      'ADMIN'
    );
    console.log('✅ Created default admin user');
  }
}

