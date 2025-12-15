import { Router } from 'express';
import {
  getCreditBalance,
  getTransactionHistory,
  addCredits,
  deductCredits,
  ensureCreditAccount,
  setCredits,
} from '../services/creditService.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { getUserById } from '../services/userService.js';

const router = Router();

// Get current user's credit balance
router.get('/credits/balance', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    await ensureCreditAccount(user.id);
    const balance = await getCreditBalance(user.id);

    res.json({ balance });
  } catch (error: any) {
    console.error('Get credit balance error:', error);
    res.status(500).json({ detail: 'Failed to get credit balance' });
  }
});

// Get current user's transaction history
router.get('/credits/transactions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await getTransactionHistory(user.id, limit);

    res.json(transactions);
  } catch (error: any) {
    console.error('Get transaction history error:', error);
    res.status(500).json({ detail: 'Failed to get transaction history' });
  }
});

// Get user's credit balance (admin only)
router.get('/admin/credits/:userId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ detail: 'User ID is required' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ detail: `User with ID ${userId} not found` });
    }

    await ensureCreditAccount(user.id);
    const balance = await getCreditBalance(user.id);
    const transactions = await getTransactionHistory(user.id, 20);

    res.json({
      userId: user.id,
      username: user.username,
      balance: balance || 0,
      recentTransactions: transactions || [],
    });
  } catch (error: any) {
    console.error('Get user credits error:', error);
    console.error('Error stack:', error.stack);
    const errorMessage = error.message || 'Failed to get user credits';
    res.status(500).json({ detail: errorMessage });
  }
});

// Adjust user credits (admin only)
router.post('/admin/credits/:userId/adjust', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { amount, type, description } = req.body;

    if (amount === undefined || amount === null || typeof amount !== 'number') {
      return res.status(400).json({ detail: 'Amount is required and must be a number' });
    }

    if (!type || !['bonus', 'adjustment'].includes(type)) {
      return res.status(400).json({ detail: 'Type must be "bonus" or "adjustment"' });
    }

    const user = await getUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    await ensureCreditAccount(user.id);

    if (type === 'adjustment') {
      // Adjustment: Set balance to the specified amount (absolute value)
      await setCredits(
        user.id,
        amount,
        'adjustment',
        description || `Balance adjusted to ${amount}`
      );
    } else {
      // Bonus: Add the specified amount (relative value)
      if (amount > 0) {
        await addCredits(
          user.id,
          amount,
          'bonus',
          description || `Bonus credits added`,
          undefined
        );
      } else if (amount < 0) {
        const success = await deductCredits(
          user.id,
          Math.abs(amount),
          description || `Credits deducted`,
          undefined,
          'bonus'
        );
        if (!success) {
          return res.status(400).json({ detail: 'Insufficient credits to deduct' });
        }
      }
    }

    const balance = await getCreditBalance(user.id);

    res.json({
      success: true,
      balance,
      message: type === 'adjustment' 
        ? `Balance set to ${amount} successfully`
        : `Credits ${amount > 0 ? 'added' : 'deducted'} successfully`,
    });
  } catch (error: any) {
    console.error('Adjust credits error:', error);
    res.status(500).json({ detail: error.message || 'Failed to adjust credits' });
  }
});

export default router;

