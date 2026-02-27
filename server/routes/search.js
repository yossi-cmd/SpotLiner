import { Router } from 'express';
import pool from '../db/index.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ tracks: [], artists: [], albums: [] });
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);
    const [tracksRes, artistsRes, albumsRes] = await Promise.all([
      pool.query(
        `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.created_at, t.artist_id, t.album_id, t.image_path,
         COALESCE(t.image_path, al.image_path, a.image_path) AS cover_image_path,
         (SELECT COALESCE(json_agg(json_build_object('id', fa.id, 'name', fa.name) ORDER BY tfa.position), '[]'::json) FROM track_featured_artists tfa JOIN artists fa ON fa.id = tfa.artist_id WHERE tfa.track_id = t.id) AS featured_artists
         FROM tracks t
         LEFT JOIN albums al ON t.album_id = al.id
         LEFT JOIN artists a ON t.artist_id = a.id
         WHERE t.title ILIKE $1 OR t.artist ILIKE $1 OR t.album ILIKE $1
         ORDER BY t.created_at DESC LIMIT $2`,
        [`%${q}%`, limit]
      ),
      pool.query(
        `SELECT id, name FROM artists WHERE name ILIKE $1 ORDER BY name LIMIT 10`,
        [`%${q}%`]
      ),
      pool.query(
        `SELECT al.id, al.name, a.name AS artist_name, a.id AS artist_id
         FROM albums al JOIN artists a ON a.id = al.artist_id
         WHERE al.name ILIKE $1 OR a.name ILIKE $1
         ORDER BY al.name LIMIT 10`,
        [`%${q}%`]
      ),
    ]);
    res.json({
      tracks: tracksRes.rows,
      artists: artistsRes.rows,
      albums: albumsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
