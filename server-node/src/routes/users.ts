import { Router } from 'express';
import { 
  listUsers, 
  getUserByUsername, 
  createUser, 
  updateUser, 
  deleteUser,
  getUserSettings,
  updateUserSettings
} from '../services/userService.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get user settings
router.get('/settings', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await getUserByUsername(req.user!.username);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const settings = await getUserSettings(user.id);
    res.json(settings);
  } catch (error: any) {
    console.error('Get settings error:', error);
    res.status(500).json({ detail: 'Failed to get settings' });
  }
});

// Update user settings
router.put('/settings', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await getUserByUsername(req.user!.username);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const settings = await updateUserSettings(user.id, req.body);
    res.json(settings);
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ detail: 'Failed to update settings' });
  }
});

// ============ Admin Routes ============

// List all users (admin only)
router.get('/admin/users', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error: any) {
    console.error('List users error:', error);
    res.status(500).json({ detail: 'Failed to list users' });
  }
});

// Get user details (admin only)
router.get('/admin/users/:username', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await getUserByUsername(req.params.username);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ detail: 'Failed to get user' });
  }
});

// Create user (admin only)
router.post('/admin/users', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ detail: 'Username and password are required' });
    }

    const existing = await getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ detail: 'Username already exists' });
    }

    const user = await createUser(username, password, role || 'USER');
    res.status(201).json(user);
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ detail: 'Failed to create user' });
  }
});

// Update user (admin only)
router.put('/admin/users/:username', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await updateUser(req.params.username, req.body);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json({ detail: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/admin/users/:username', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.params.username === 'admin') {
      return res.status(400).json({ detail: 'Cannot delete admin user' });
    }

    const success = await deleteUser(req.params.username);
    if (!success) {
      return res.status(404).json({ detail: 'User not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ detail: 'Failed to delete user' });
  }
});

export default router;




