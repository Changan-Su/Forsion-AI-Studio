import { v4 as uuidv4 } from 'uuid';
import { query, getConnection } from '../config/database.js';
import type { UserCredit, CreditTransaction } from '../types/index.js';

export async function ensureCreditAccount(userId: string): Promise<UserCredit> {
  const existing = await query<any[]>(
    `SELECT * FROM user_credits WHERE user_id = ?`,
    [userId]
  );

  if (existing.length > 0) {
    const row = existing[0];
    return {
      id: row.id,
      userId: row.user_id,
      balance: parseFloat(row.balance),
      totalEarned: parseFloat(row.total_earned),
      totalSpent: parseFloat(row.total_spent),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const id = uuidv4();
  await query(
    `INSERT INTO user_credits (id, user_id, balance, total_earned, total_spent)
     VALUES (?, ?, 0.00, 0.00, 0.00)`,
    [id, userId]
  );

  return {
    id,
    userId,
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
  };
}

export async function getCreditBalance(userId: string): Promise<number> {
  const account = await ensureCreditAccount(userId);
  return account.balance;
}

export async function checkSufficientCredits(userId: string, amount: number): Promise<boolean> {
  const balance = await getCreditBalance(userId);
  return balance >= amount;
}

export async function addCredits(
  userId: string,
  amount: number,
  type: CreditTransaction['type'],
  description?: string,
  referenceId?: string
): Promise<void> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Get current balance
    const [accountRows] = await connection.query<any[]>(
      `SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE`,
      [userId]
    );

    let account = accountRows as any[];
    if (account.length === 0) {
      // Create account first (outside transaction, then re-query)
      await connection.commit();
      await ensureCreditAccount(userId);
      await connection.beginTransaction();
      const [newAccountRows] = await connection.query<any[]>(
        `SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE`,
        [userId]
      );
      account = newAccountRows as any[];
    }

    const currentBalance = parseFloat(account[0].balance);
    const newBalance = currentBalance + amount;
    const totalEarned = parseFloat(account[0].total_earned) + amount;

    // Update balance
    await connection.query(
      `UPDATE user_credits 
       SET balance = ?, total_earned = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [newBalance, totalEarned, userId]
    );

    // Record transaction
    const transactionId = uuidv4();
    await connection.query(
      `INSERT INTO credit_transactions 
       (id, user_id, type, amount, balance_before, balance_after, description, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, userId, type, amount, currentBalance, newBalance, description || null, referenceId || null]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deductCredits(
  userId: string,
  amount: number,
  description?: string,
  referenceId?: string,
  type: CreditTransaction['type'] = 'usage'
): Promise<boolean> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Get current balance with lock
    const [accountRows] = await connection.query<any[]>(
      `SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE`,
      [userId]
    );

    const account = accountRows as any[];
    if (account.length === 0) {
      await connection.rollback();
      return false;
    }

    const currentBalance = parseFloat(account[0].balance);
    
    // For adjustment type, allow negative balance
    if (type !== 'adjustment' && currentBalance < amount) {
      await connection.rollback();
      return false;
    }

    const newBalance = currentBalance - amount;
    const totalSpent = parseFloat(account[0].total_spent) + amount;

    // Update balance
    await connection.query(
      `UPDATE user_credits 
       SET balance = ?, total_spent = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [newBalance, totalSpent, userId]
    );

    // Record transaction
    const transactionId = uuidv4();
    await connection.query(
      `INSERT INTO credit_transactions 
       (id, user_id, type, amount, balance_before, balance_after, description, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, userId, type, amount, currentBalance, newBalance, description || null, referenceId || null]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function setCredits(
  userId: string,
  targetBalance: number,
  type: 'adjustment',
  description?: string
): Promise<void> {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Get current balance
    const [accountRows] = await connection.query<any[]>(
      `SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE`,
      [userId]
    );

    let account = accountRows as any[];
    if (account.length === 0) {
      // Create account first
      await connection.commit();
      await ensureCreditAccount(userId);
      await connection.beginTransaction();
      const [newAccountRows] = await connection.query<any[]>(
        `SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE`,
        [userId]
      );
      account = newAccountRows as any[];
    }

    const currentBalance = parseFloat(account[0].balance);
    const difference = targetBalance - currentBalance;
    
    // Update balance directly to target
    await connection.query(
      `UPDATE user_credits 
       SET balance = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [targetBalance, userId]
    );

    // Record transaction with the difference amount
    if (Math.abs(difference) > 0.01) { // Only record if there's a meaningful change
      const transactionId = uuidv4();
      await connection.query(
        `INSERT INTO credit_transactions 
         (id, user_id, type, amount, balance_before, balance_after, description, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId, 
          userId, 
          type, 
          Math.abs(difference), // Store absolute difference
          currentBalance, 
          targetBalance, 
          description || `Balance adjusted to ${targetBalance}`,
          null
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  // Ensure limit is a safe integer and embed directly in SQL (mysql2 LIMIT doesn't work well with prepared stmt params)
  const limitInt = Math.max(1, Math.min(1000, Math.floor(limit)));
  const rows = await query<any[]>(
    `SELECT * FROM credit_transactions 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ${limitInt}`,
    [userId]
  );

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: parseFloat(row.amount),
    balanceBefore: parseFloat(row.balance_before),
    balanceAfter: parseFloat(row.balance_after),
    description: row.description,
    referenceId: row.reference_id,
    createdAt: row.created_at,
  }));
}

