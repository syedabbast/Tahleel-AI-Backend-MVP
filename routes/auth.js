const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getUserByEmail, createUser, getUserById } = require('../services/userService');

const router = express.Router();
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'supersecretkey'; // Use env var in production
const JWT_EXPIRES_IN = '7d'; // 7 days

/**
 * POST /api/auth/register
 * Register new user (Coach/Team)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, team } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password required.' });
    }

    // Check if user exists
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ success: false, error: 'Email already registered.' });

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await createUser({ name, email, passwordHash, team });

    // Issue JWT
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, team: newUser.team },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, team: newUser.team }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and issue JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required.' });

    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials.' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials.' });

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, team: user.team },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, team: user.team }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires JWT)
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, team: user.team }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Logout (stateless JWT, just remove on frontend)
 */
router.post('/logout', (req, res) => {
  // JWT is stateless, so logout is handled client-side.
  // Optionally, implement a blacklist for revoked tokens.
  res.json({ success: true, message: 'Logged out. Please delete token on frontend.' });
});

/**
 * Auth middleware for protected routes
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, error: 'Missing Authorization header.' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Missing token.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
}

module.exports = { router, authMiddleware };
