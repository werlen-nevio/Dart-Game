import { Router } from 'express';
import { authService } from '../services/auth.service';
import { validate, schemas } from '../middleware/validation.middleware';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// Register
router.post('/register', validate(schemas.register), async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const user = await authService.register(email, username, password);

    logger.info(`User registered: ${user.username}`);
    res.status(201).json({ user });
  } catch (error: any) {
    logger.error('Registration error', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    logger.info(`User logged in: ${user.username}`);
    res.json({ user, accessToken });
  } catch (error: any) {
    logger.error('Login error', { error: error.message });
    res.status(401).json({ error: error.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshAccessToken(refreshToken);

    // Set new refresh token
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ accessToken });
  } catch (error: any) {
    logger.error('Refresh error', { error: error.message });
    res.clearCookie('refreshToken');
    res.status(401).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await authService.getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error: any) {
    logger.error('Get user error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
