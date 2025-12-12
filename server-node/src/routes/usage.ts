import { Router } from 'express';
import { getUsageStats, getRecentLogs, logApiUsage } from '../services/usageService.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get usage statistics (admin only)
router.get('/admin/usage', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const username = req.query.username as string | undefined;

    const stats = await getUsageStats(days, username);
    res.json(stats);
  } catch (error: any) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ detail: 'Failed to get usage statistics' });
  }
});

// Get recent logs (admin only)
router.get('/admin/usage/logs', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const username = req.query.username as string | undefined;

    const logs = await getRecentLogs(limit, username);
    res.json(logs);
  } catch (error: any) {
    console.error('Get usage logs error:', error);
    res.status(500).json({ detail: 'Failed to get usage logs' });
  }
});

// Log API usage (internal use, but exposed for compatibility)
router.post('/usage/log', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { 
      model_id, 
      model_name, 
      provider, 
      tokens_input, 
      tokens_output, 
      success, 
      error_message 
    } = req.query;

    await logApiUsage(
      req.user!.username,
      model_id as string,
      model_name as string,
      provider as string,
      parseInt(tokens_input as string) || 0,
      parseInt(tokens_output as string) || 0,
      success !== 'false',
      error_message as string
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Log usage error:', error);
    res.status(500).json({ detail: 'Failed to log usage' });
  }
});

export default router;

