import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import pool from '../db/index.js';
import { auth, requireRole, optionalAuth } from '../middleware/auth.js';

const router = Router();
const uploadDir = path.resolve(process.env.UPLOAD_PATH || './uploads/audio');

router.get('/', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const result = await pool.query(
      `SELECT a.id, a.name, a.created_by, a.image_path, COUNT(t.id) AS track_count
       FROM artists a
       LEFT JOIN tracks t ON t.artist_id = a.id
       GROUP BY a.id, a.name, a.created_by, a.image_path
       ORDER BY a.name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ artists: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const artist = await pool.query('SELECT id, name, created_by, created_at, image_path FROM artists WHERE id = $1', [req.params.id]);
    if (!artist.rows.length) return res.status(404).json({ error: 'Artist not found' });
    const tracks = await pool.query(
      `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.created_at, t.uploaded_by, t.artist_id, t.album_id, t.image_path,
       COALESCE(t.image_path, al.image_path, a.image_path) AS cover_image_path
       FROM tracks t
       LEFT JOIN albums al ON t.album_id = al.id
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE t.artist_id = $1 ORDER BY t.created_at DESC`,
      [req.params.id]
    );
    res.json({ ...artist.rows[0], tracks: tracks.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// Create artist (admin/uploader only)
router.post('/', auth, requireRole(['admin', 'uploader']), async (req, res) => {
  try {
    const { name, image_path } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const existing = await pool.query('SELECT id FROM artists WHERE name = $1', [name.trim()]);
    if (existing.rows.length) return res.status(400).json({ error: 'Artist already exists' });
    const r = await pool.query(
      'INSERT INTO artists (name, created_by, image_path) VALUES ($1, $2, $3) RETURNING id, name, created_by, created_at, image_path',
      [name.trim(), req.userId, image_path || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create artist' });
  }
});

// Update artist (creator or admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const artist = await pool.query('SELECT id, created_by FROM artists WHERE id = $1', [req.params.id]);
    if (!artist.rows.length) return res.status(404).json({ error: 'Artist not found' });
    const canEdit = req.userRole === 'admin' || artist.rows[0].created_by === req.userId;
    if (!canEdit) return res.status(403).json({ error: 'Cannot edit this artist' });
    const { name, image_path } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    if (image_path !== undefined) {
      await pool.query('UPDATE artists SET name = $1, image_path = $2 WHERE id = $3', [name.trim(), image_path || null, req.params.id]);
    } else {
      await pool.query('UPDATE artists SET name = $1 WHERE id = $2', [name.trim(), req.params.id]);
    }
    await pool.query('UPDATE tracks SET artist = $1 WHERE artist_id = $2', [name.trim(), req.params.id]);
    const out = await pool.query('SELECT id, name, created_by, created_at, image_path FROM artists WHERE id = $1', [req.params.id]);
    res.json(out.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update artist' });
  }
});

// Delete artist (creator or admin) – deletes all tracks and albums of this artist
router.delete('/:id', auth, async (req, res) => {
  try {
    const artist = await pool.query('SELECT id, created_by FROM artists WHERE id = $1', [req.params.id]);
    if (!artist.rows.length) return res.status(404).json({ error: 'Artist not found' });
    const canDelete = req.userRole === 'admin' || artist.rows[0].created_by === req.userId;
    if (!canDelete) return res.status(403).json({ error: 'Cannot delete this artist' });
    const tracks = await pool.query('SELECT id, file_path FROM tracks WHERE artist_id = $1', [req.params.id]);
    for (const t of tracks.rows) {
      const filePath = path.join(uploadDir, path.basename(t.file_path));
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('Could not delete track file:', filePath, e.message);
      }
    }
    await pool.query('DELETE FROM tracks WHERE artist_id = $1', [req.params.id]);
    await pool.query('DELETE FROM artists WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete artist' });
  }
});

export default router;
