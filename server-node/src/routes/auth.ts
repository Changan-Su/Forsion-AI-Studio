import { Router } from 'express';
import { 
  getUserByUsername, 
  verifyPassword, 
  createUser, 
  updateLastLogin,
  updatePassword as updateUserPassword 
} from '../services/userService.js';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ detail: 'Username and password are required' });
    }

    const user = await getUserByUsername(username);
    if (!user || !user.password) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ detail: 'Account is not active' });
    }

    // Update last login
    await updateLastLogin(username);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Login failed' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ detail: 'Username and password are required' });
    }

    if (password.length < 4) {
      return res.status(400).json({ detail: 'Password must be at least 4 characters' });
    }

    const existing = await getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ detail: 'Username already exists' });
    }

    const user = await createUser(username, password, 'USER');

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ detail: 'Registration failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await getUserByUsername(req.user!.username);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      status: user.status,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ detail: 'Failed to get user' });
  }
});

// Update password
router.put('/password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ detail: 'Current and new password are required' });
    }

    const user = await getUserByUsername(req.user!.username);
    if (!user || !user.password) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const isValid = await verifyPassword(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ detail: 'Current password is incorrect' });
    }

    await updateUserPassword(req.user!.username, newPassword);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Update password error:', error);
    res.status(500).json({ detail: 'Failed to update password' });
  }
});

export default router;

