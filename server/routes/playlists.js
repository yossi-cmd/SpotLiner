import { Router } from 'express';
import pool from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, name, is_public, created_at FROM playlists WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ playlists: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, isPublic } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Playlist name required' });
    const r = await pool.query(
      'INSERT INTO playlists (user_id, name, is_public) VALUES ($1, $2, $3) RETURNING id, name, is_public, created_at',
      [req.userId, name.trim(), !!isPublic]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pl = await pool.query(
      'SELECT id, user_id, name, is_public, created_at FROM playlists WHERE id = $1',
      [req.params.id]
    );
    if (!pl.rows.length) return res.status(404).json({ error: 'Playlist not found' });
    const p = pl.rows[0];
    if (p.user_id !== req.userId && !p.is_public) return res.status(403).json({ error: 'Forbidden' });
    const featuredSub = "(SELECT COALESCE(json_agg(json_build_object('id', fa.id, 'name', fa.name) ORDER BY tfa.position), '[]'::json) FROM track_featured_artists tfa JOIN artists fa ON fa.id = tfa.artist_id WHERE tfa.track_id = t.id)";
    const tracks = await pool.query(
      `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.artist_id, t.album_id, t.image_path, pt.position,
       COALESCE(t.image_path, al.image_path, a.image_path) AS cover_image_path, ${featuredSub} AS featured_artists
       FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
       LEFT JOIN albums al ON t.album_id = al.id
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE pt.playlist_id = $1 ORDER BY pt.position, pt.track_id`,
      [req.params.id]
    );
    res.json({ ...p, tracks: tracks.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, isPublic } = req.body;
    const r = await pool.query(
      'UPDATE playlists SET name = COALESCE($2, name), is_public = COALESCE($3, is_public) WHERE id = $1 AND user_id = $4 RETURNING id, name, is_public',
      [req.params.id, name?.trim(), typeof isPublic === 'boolean' ? isPublic : undefined, req.userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Playlist not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Playlist not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

router.post('/:id/tracks', async (req, res) => {
  try {
    const { trackId, position } = req.body;
    if (!trackId) return res.status(400).json({ error: 'trackId required' });
    const pl = await pool.query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!pl.rows.length) return res.status(404).json({ error: 'Playlist not found' });
    const maxPos = await pool.query('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM playlist_tracks WHERE playlist_id = $1', [req.params.id]);
    const pos = typeof position === 'number' ? position : maxPos.rows[0].p;
    await pool.query(
      'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3) ON CONFLICT (playlist_id, track_id) DO NOTHING',
      [req.params.id, trackId, pos]
    );
    res.status(201).json({ added: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add track' });
  }
});

router.delete('/:id/tracks/:trackId', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2 AND playlist_id IN (SELECT id FROM playlists WHERE user_id = $3) RETURNING 1',
      [req.params.id, req.params.trackId, req.userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Track not in playlist or playlist not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove track' });
  }
});

export default router;
