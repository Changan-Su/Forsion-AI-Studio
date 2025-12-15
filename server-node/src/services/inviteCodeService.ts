import { v4 as uuidv4 } from 'uuid';
import { query, getConnection } from '../config/database.js';
import type { InviteCode } from '../types/index.js';

export async function createInviteCode(
  code: string,
  maxUses: number,
  initialCredits: number,
  expiresAt?: Date,
  notes?: string,
  createdBy?: string
): Promise<InviteCode> {
  // Check if code already exists
  const existing = await query<any[]>(
    `SELECT id FROM invite_codes WHERE code = ?`,
    [code]
  );

  if (existing.length > 0) {
    throw new Error('Invite code already exists');
  }

  const id = uuidv4();
  await query(
    `INSERT INTO invite_codes 
     (id, code, max_uses, used_count, initial_credits, created_by, expires_at, is_active, notes)
     VALUES (?, ?, ?, 0, ?, ?, ?, TRUE, ?)`,
    [id, code, maxUses, initialCredits, createdBy || null, expiresAt || null, notes || null]
  );

  const created = await query<any[]>(
    `SELECT * FROM invite_codes WHERE id = ?`,
    [id]
  );

  const row = created[0];
  return {
    id: row.id,
    code: row.code,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    initialCredits: parseFloat(row.initial_credits),
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    isActive: !!row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function validateInviteCode(code: string): Promise<{ valid: boolean; inviteCode?: InviteCode; error?: string }> {
  const rows = await query<any[]>(
    `SELECT * FROM invite_codes WHERE code = ?`,
    [code]
  );

  if (rows.length === 0) {
    return { valid: false, error: 'Invite code not found' };
  }

  const row = rows[0];
  const inviteCode: InviteCode = {
    id: row.id,
    code: row.code,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    initialCredits: parseFloat(row.initial_credits),
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    isActive: !!row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (!inviteCode.isActive) {
    return { valid: false, error: 'Invite code is not active' };
  }

  if (inviteCode.usedCount >= inviteCode.maxUses) {
    return { valid: false, error: 'Invite code has reached maximum uses' };
  }

  if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
    return { valid: false, error: 'Invite code has expired' };
  }

  return { valid: true, inviteCode };
}

export async function useInviteCode(code: string, userId: string): Promise<void> {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Lock the invite code row
    const rows = await query<any[]>(
      `SELECT * FROM invite_codes WHERE code = ? FOR UPDATE`,
      [code]
    );

    if (rows.length === 0) {
      await connection.rollback();
      throw new Error('Invite code not found');
    }

    const row = rows[0];
    const usedCount = row.used_count;
    const maxUses = row.max_uses;

    if (!row.is_active) {
      await connection.rollback();
      throw new Error('Invite code is not active');
    }

    if (usedCount >= maxUses) {
      await connection.rollback();
      throw new Error('Invite code has reached maximum uses');
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await connection.rollback();
      throw new Error('Invite code has expired');
    }

    // Increment used count
    await connection.query(
      `UPDATE invite_codes 
       SET used_count = used_count + 1, updated_at = NOW()
       WHERE code = ?`,
      [code]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listInviteCodes(): Promise<InviteCode[]> {
  const rows = await query<any[]>(
    `SELECT * FROM invite_codes ORDER BY created_at DESC`
  );

  return rows.map(row => ({
    id: row.id,
    code: row.code,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    initialCredits: parseFloat(row.initial_credits),
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    isActive: !!row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getInviteCodeByCode(code: string): Promise<InviteCode | null> {
  const rows = await query<any[]>(
    `SELECT * FROM invite_codes WHERE code = ?`,
    [code]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    code: row.code,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    initialCredits: parseFloat(row.initial_credits),
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    isActive: !!row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getInviteCodeById(id: string): Promise<InviteCode | null> {
  const rows = await query<any[]>(
    `SELECT * FROM invite_codes WHERE id = ?`,
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    code: row.code,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    initialCredits: parseFloat(row.initial_credits),
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    isActive: !!row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateInviteCode(
  id: string,
  updates: Partial<InviteCode>
): Promise<InviteCode | null> {
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.maxUses !== undefined) {
    setClauses.push('max_uses = ?');
    values.push(updates.maxUses);
  }
  if (updates.initialCredits !== undefined) {
    setClauses.push('initial_credits = ?');
    values.push(updates.initialCredits);
  }
  if (updates.isActive !== undefined) {
    setClauses.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }
  if (updates.expiresAt !== undefined) {
    setClauses.push('expires_at = ?');
    values.push(updates.expiresAt || null);
  }
  if (updates.notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(updates.notes || null);
  }

  if (setClauses.length === 0) {
    return getInviteCodeById(id);
  }

  values.push(id);
  await query(
    `UPDATE invite_codes SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
    values
  );

  return getInviteCodeById(id);
}

export async function deleteInviteCode(id: string): Promise<boolean> {
  const result = await query<any>(
    `DELETE FROM invite_codes WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}


