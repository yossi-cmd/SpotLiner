import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();

const SALT_ROUNDS = 10;
const JWT_EXPIRES = '24h';

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('displayName').optional().trim().isLength({ max: 255 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { email, password, displayName } = req.body;
      const emailNorm = (email || '').trim().toLowerCase();
      const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [emailNorm]);
      if (existing.rows.length) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, role, created_at',
        [emailNorm, passwordHash, displayName || null, 'user']
      );
      const user = result.rows[0];
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );
      res.status(201).json({
        user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
        token,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { email, password } = req.body;
      const emailNorm = (email || '').trim().toLowerCase();
      const result = await pool.query(
        'SELECT id, email, display_name, role, password_hash FROM users WHERE LOWER(email) = $1',
        [emailNorm]
      );
      if (!result.rows.length) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );
      res.json({
        user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
        token,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, role, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ id: u.id, email: u.email, displayName: u.display_name, role: u.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
