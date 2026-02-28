import { Router } from 'express';
import pool from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// PoC: Push subscription for "new track by favorited artist" notifications. Can be removed later.
router.post('/push-test', async (req, res) => {
  try {
    const { sendTestPushToUser } = await import('../push.js');
    const result = await sendTestPushToUser(req.userId);
    if (result.sent) return res.json({ sent: true });
    return res.status(400).json({ sent: false, error: result.error });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Push test failed' });
  }
});

router.post('/push-subscription', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
      [req.userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const r = await pool.query(
      `SELECT id, track_id, artist_id, artist_name, track_title, uploader_name, recipient_name, sent_at
       FROM push_notification_log
       WHERE user_id = $1
       ORDER BY sent_at DESC
       LIMIT $2`,
      [req.userId, limit]
    );
    res.json({ notifications: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/notifications/:id/resend', async (req, res) => {
  try {
    const { resendPushNotification } = await import('../push.js');
    const result = await resendPushNotification(parseInt(req.params.id, 10), req.userId);
    if (result.sent) return res.json({ sent: true });
    return res.status(400).json({ sent: false, error: result.error });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Resend failed' });
  }
});

// Favorites
router.get('/favorites', async (req, res) => {
  try {
    const featuredSub = "(SELECT COALESCE(json_agg(json_build_object('id', fa.id, 'name', fa.name) ORDER BY tfa.position), '[]'::json) FROM track_featured_artists tfa JOIN artists fa ON fa.id = tfa.artist_id WHERE tfa.track_id = t.id)";
    const r = await pool.query(
      `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.created_at, t.artist_id, t.album_id, t.image_path,
       COALESCE(t.image_path, al.image_path, a.image_path) AS cover_image_path, ${featuredSub} AS featured_artists
       FROM favorites f JOIN tracks t ON t.id = f.track_id
       LEFT JOIN albums al ON t.album_id = al.id
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
      [req.userId]
    );
    res.json({ tracks: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/favorites/:trackId', async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO favorites (user_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, req.params.trackId]
    );
    res.status(201).json({ added: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

router.delete('/favorites/:trackId', async (req, res) => {
  try {
    await pool.query('DELETE FROM favorites WHERE user_id = $1 AND track_id = $2', [req.userId, req.params.trackId]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// History
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const featuredSub = "(SELECT COALESCE(json_agg(json_build_object('id', fa.id, 'name', fa.name) ORDER BY tfa.position), '[]'::json) FROM track_featured_artists tfa JOIN artists fa ON fa.id = tfa.artist_id WHERE tfa.track_id = t.id)";
    const r = await pool.query(
      `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.artist_id, t.album_id, t.image_path, h.played_at,
       COALESCE(t.image_path, al.image_path, a.image_path) AS cover_image_path, ${featuredSub} AS featured_artists
       FROM play_history h JOIN tracks t ON t.id = h.track_id
       LEFT JOIN albums al ON t.album_id = al.id
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE h.user_id = $1 ORDER BY h.played_at DESC LIMIT $2`,
      [req.userId, limit]
    );
    res.json({ tracks: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.post('/history', async (req, res) => {
  try {
    const { trackId } = req.body;
    if (!trackId) return res.status(400).json({ error: 'trackId required' });
    await pool.query('INSERT INTO play_history (user_id, track_id) VALUES ($1, $2)', [req.userId, trackId]);
    res.status(201).json({ recorded: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record history' });
  }
});

export default router;
