import { Router } from 'express';
import {
  createInviteCode,
  listInviteCodes,
  getInviteCodeById,
  updateInviteCode,
  deleteInviteCode,
} from '../services/inviteCodeService.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// List all invite codes (admin only)
router.get('/admin/invite-codes', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const codes = await listInviteCodes();
    res.json(codes);
  } catch (error: any) {
    console.error('List invite codes error:', error);
    res.status(500).json({ detail: 'Failed to list invite codes' });
  }
});

// Create invite code (admin only)
router.post('/admin/invite-codes', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { code, max_uses, initial_credits, expires_at, notes } = req.body;

    if (!code) {
      return res.status(400).json({ detail: 'Code is required' });
    }

    if (!max_uses || max_uses < 1) {
      return res.status(400).json({ detail: 'max_uses must be at least 1' });
    }

    const initialCredits = initial_credits || 0;
    const expiresAt = expires_at ? new Date(expires_at) : undefined;

    const inviteCode = await createInviteCode(
      code,
      max_uses,
      initialCredits,
      expiresAt,
      notes,
      req.user!.userId
    );

    res.status(201).json(inviteCode);
  } catch (error: any) {
    console.error('Create invite code error:', error);
    if (error.message === 'Invite code already exists') {
      return res.status(400).json({ detail: error.message });
    }
    res.status(500).json({ detail: 'Failed to create invite code' });
  }
});

// Get invite code by ID (admin only)
router.get('/admin/invite-codes/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const code = await getInviteCodeById(req.params.id);
    if (!code) {
      return res.status(404).json({ detail: 'Invite code not found' });
    }
    res.json(code);
  } catch (error: any) {
    console.error('Get invite code error:', error);
    res.status(500).json({ detail: 'Failed to get invite code' });
  }
});

// Update invite code (admin only)
router.put('/admin/invite-codes/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { max_uses, initial_credits, expires_at, is_active, notes } = req.body;

    const updates: any = {};
    if (max_uses !== undefined) updates.maxUses = max_uses;
    if (initial_credits !== undefined) updates.initialCredits = initial_credits;
    if (expires_at !== undefined) updates.expiresAt = expires_at ? new Date(expires_at) : null;
    if (is_active !== undefined) updates.isActive = is_active;
    if (notes !== undefined) updates.notes = notes;

    const code = await updateInviteCode(req.params.id, updates);
    if (!code) {
      return res.status(404).json({ detail: 'Invite code not found' });
    }

    res.json(code);
  } catch (error: any) {
    console.error('Update invite code error:', error);
    res.status(500).json({ detail: 'Failed to update invite code' });
  }
});

// Delete invite code (admin only)
router.delete('/admin/invite-codes/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const success = await deleteInviteCode(req.params.id);
    if (!success) {
      return res.status(404).json({ detail: 'Invite code not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete invite code error:', error);
    res.status(500).json({ detail: 'Failed to delete invite code' });
  }
});

export default router;


