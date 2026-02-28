import { Router } from 'express';
import pool from '../db/index.js';
import { auth, requireRole } from '../middleware/auth.js';
import { sendCustomPush } from '../push.js';

const router = Router();
router.use(auth, requireRole(['admin']));

/** List users who have at least one push subscription (for admin send form). */
router.get('/push-subscribers', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.display_name,
       (SELECT COUNT(*) FROM push_subscriptions ps WHERE ps.user_id = u.id) AS subscription_count
       FROM users u
       WHERE EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)
       ORDER BY u.display_name, u.email`
    );
    res.json({
      users: r.rows.map((row) => ({
        id: row.id,
        email: row.email,
        display_name: row.display_name,
        subscription_count: parseInt(row.subscription_count, 10),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

/** Send a custom push to selected users (admin only). */
router.post('/send-push', async (req, res) => {
  try {
    const { title, body, url, icon, image, badge, tag, userIds } = req.body;
    if (title == null || body == null || (typeof title === 'string' && !title.trim()) || (typeof body === 'string' && !body.trim())) {
      return res.status(400).json({ error: 'title and body required' });
    }
    const ids = Array.isArray(userIds) ? userIds.map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id)) : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Select at least one user' });
    }
    let sent = 0;
    let failed = 0;
    const errors = [];
    for (const uid of ids) {
      const result = await sendCustomPush({
        title: title || 'הודעה',
        body: body || '',
        url: url || '/',
        userId: uid,
        icon: icon || null,
        image: image || null,
        badge: badge || null,
        tag: tag || null,
      });
      sent += result.sent;
      failed += result.failed ?? 0;
      if (result.errors?.length) errors.push(...result.errors);
    }
    res.json({ sent, failed, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send push' });
  }
});

export default router;
