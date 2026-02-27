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
      `SELECT al.id, al.name, al.artist_id, al.created_by, al.image_path, a.name AS artist_name, a.image_path AS artist_image_path, COUNT(t.id) AS track_count
       FROM albums al
       JOIN artists a ON a.id = al.artist_id
       LEFT JOIN tracks t ON t.album_id = al.id
       GROUP BY al.id, al.name, al.artist_id, al.created_by, al.image_path, a.name, a.image_path
       ORDER BY al.name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ albums: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const album = await pool.query(
      `SELECT al.id, al.name, al.artist_id, al.created_by, al.image_path, a.name AS artist_name, a.image_path AS artist_image_path
       FROM albums al
       JOIN artists a ON a.id = al.artist_id
       WHERE al.id = $1`,
      [req.params.id]
    );
    if (!album.rows.length) return res.status(404).json({ error: 'Album not found' });
    const featuredSub = "(SELECT COALESCE(json_agg(json_build_object('id', fa.id, 'name', fa.name) ORDER BY tfa.position), '[]'::json) FROM track_featured_artists tfa JOIN artists fa ON fa.id = tfa.artist_id WHERE tfa.track_id = t.id)";
    const tracks = await pool.query(
      `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.created_at, t.uploaded_by, t.artist_id, t.album_id, t.image_path,
       COALESCE(t.image_path, al.image_path, a.image_path) AS cover_image_path, ${featuredSub} AS featured_artists
       FROM tracks t
       LEFT JOIN albums al ON t.album_id = al.id
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE t.album_id = $1 ORDER BY t.id`,
      [req.params.id]
    );
    res.json({ ...album.rows[0], tracks: tracks.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch album' });
  }
});

// Create album (admin/uploader only)
router.post('/', auth, requireRole(['admin', 'uploader']), async (req, res) => {
  try {
    const { name, artist_id, image_path } = req.body;
    if (!name?.trim() || !artist_id) return res.status(400).json({ error: 'Name and artist_id required' });
    const artist = await pool.query('SELECT id FROM artists WHERE id = $1', [artist_id]);
    if (!artist.rows.length) return res.status(400).json({ error: 'Artist not found' });
    const existing = await pool.query('SELECT id FROM albums WHERE artist_id = $1 AND name = $2', [artist_id, name.trim()]);
    if (existing.rows.length) return res.status(400).json({ error: 'Album already exists for this artist' });
    const r = await pool.query(
      'INSERT INTO albums (name, artist_id, created_by, image_path) VALUES ($1, $2, $3, $4) RETURNING id, name, artist_id, created_by, created_at, image_path',
      [name.trim(), artist_id, req.userId, image_path || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// Update album (creator or admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const album = await pool.query('SELECT id, name, artist_id, created_by FROM albums WHERE id = $1', [req.params.id]);
    if (!album.rows.length) return res.status(404).json({ error: 'Album not found' });
    const canEdit = req.userRole === 'admin' || album.rows[0].created_by === req.userId;
    if (!canEdit) return res.status(403).json({ error: 'Cannot edit this album' });
    const { name, artist_id, image_path } = req.body;
    const artistId = artist_id != null ? artist_id : album.rows[0].artist_id;
    const newName = (name != null && name !== undefined) ? String(name).trim() : album.rows[0].name;
    if (!newName) return res.status(400).json({ error: 'Name required' });
    if (artist_id != null) {
      const art = await pool.query('SELECT id, name FROM artists WHERE id = $1', [artist_id]);
      if (!art.rows.length) return res.status(400).json({ error: 'Artist not found' });
    }
    if (image_path !== undefined) {
      await pool.query('UPDATE albums SET name = $1, artist_id = $2, image_path = $3 WHERE id = $4', [newName, artistId, image_path || null, req.params.id]);
    } else {
      await pool.query('UPDATE albums SET name = $1, artist_id = $2 WHERE id = $3', [newName, artistId, req.params.id]);
    }
    const artistName = (await pool.query('SELECT name FROM artists WHERE id = $1', [artistId])).rows[0]?.name;
    await pool.query('UPDATE tracks SET album = $1, artist = $2, artist_id = $3 WHERE album_id = $4', [newName, artistName || '', artistId, req.params.id]);
    const out = await pool.query('SELECT id, name, artist_id, created_by, created_at, image_path FROM albums WHERE id = $1', [req.params.id]);
    res.json({ ...out.rows[0], artist_name: artistName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update album' });
  }
});

// Delete album (creator or admin) – deletes all tracks in album and their audio files
router.delete('/:id', auth, async (req, res) => {
  try {
    const album = await pool.query('SELECT id, created_by FROM albums WHERE id = $1', [req.params.id]);
    if (!album.rows.length) return res.status(404).json({ error: 'Album not found' });
    const canDelete = req.userRole === 'admin' || album.rows[0].created_by === req.userId;
    if (!canDelete) return res.status(403).json({ error: 'Cannot delete this album' });
    const tracks = await pool.query('SELECT id, file_path FROM tracks WHERE album_id = $1', [req.params.id]);
    for (const t of tracks.rows) {
      const filePath = path.join(uploadDir, path.basename(t.file_path));
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('Could not delete track file:', filePath, e.message);
      }
    }
    await pool.query('DELETE FROM tracks WHERE album_id = $1', [req.params.id]);
    await pool.query('DELETE FROM albums WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete album' });
  }
});

export default router;
