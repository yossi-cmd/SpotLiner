import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../db/index.js';
import { auth, requireRole, optionalAuth } from '../middleware/auth.js';

const router = Router();
const uploadDir = process.env.UPLOAD_PATH || './uploads/audio';

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /audio\//.test(file.mimetype) || ['.mp3', '.m4a', '.ogg', '.wav'].includes(path.extname(file.originalname).toLowerCase());
    if (allowed) cb(null, true);
    else cb(new Error('Only audio files are allowed'));
  },
});

// List tracks (with optional search)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    let result;
    const featuredSub = "(SELECT COALESCE(json_agg(json_build_object('id', fa.id, 'name', fa.name) ORDER BY tfa.position), '[]'::json) FROM track_featured_artists tfa JOIN artists fa ON fa.id = tfa.artist_id WHERE tfa.track_id = t.id)";
    if (q) {
      result = await pool.query(
        `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.created_at, t.uploaded_by, t.artist_id, t.album_id, t.image_path,
         COALESCE(t.image_path, al.image_path, a.image_path) AS cover_image_path, ${featuredSub} AS featured_artists
         FROM tracks t
         LEFT JOIN albums al ON t.album_id = al.id
         LEFT JOIN artists a ON t.artist_id = a.id
         WHERE t.title ILIKE $1 OR t.artist ILIKE $1 OR t.album ILIKE $1
         ORDER BY t.created_at DESC
         LIMIT $2 OFFSET $3`,
        [`%${q}%`, limit, offset]
      );
    } else {
      result = await pool.query(
        `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.created_at, t.uploaded_by, t.artist_id, t.album_id, t.image_path,
         COALESCE(t.image_path, al.image_path, a.image_path) AS cover_image_path, ${featuredSub} AS featured_artists
         FROM tracks t
         LEFT JOIN albums al ON t.album_id = al.id
         LEFT JOIN artists a ON t.artist_id = a.id
         ORDER BY t.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }
    res.json({ tracks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// Get single track metadata
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const featuredSub = "(SELECT COALESCE(json_agg(json_build_object('id', fa.id, 'name', fa.name) ORDER BY tfa.position), '[]'::json) FROM track_featured_artists tfa JOIN artists fa ON fa.id = tfa.artist_id WHERE tfa.track_id = t.id)";
    const result = await pool.query(
      `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.created_at, t.uploaded_by, t.artist_id, t.album_id, t.image_path,
       COALESCE(t.image_path, al.image_path, a.image_path) AS cover_image_path, ${featuredSub} AS featured_artists
       FROM tracks t
       LEFT JOIN albums al ON t.album_id = al.id
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Track not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch track' });
  }
});

// Stream audio (Range support). Token can be in query for <audio src> (no headers).
router.get('/:id/stream', (req, res, next) => {
  const qToken = req.query.token;
  if (qToken && !req.headers.authorization) req.headers.authorization = 'Bearer ' + qToken;
  next();
}, optionalAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT file_path FROM tracks WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Track not found' });
    const filePath = path.join(uploadDir, path.basename(r.rows[0].file_path));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.m4a' ? 'audio/mp4' : ext === '.ogg' ? 'audio/ogg' : 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stream failed' });
  }
});

// Update track (uploaded_by or admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const track = await pool.query('SELECT id, title, artist_id, album_id, uploaded_by FROM tracks WHERE id = $1', [req.params.id]);
    if (!track.rows.length) return res.status(404).json({ error: 'Track not found' });
    const canEdit = req.userRole === 'admin' || track.rows[0].uploaded_by === req.userId;
    if (!canEdit) return res.status(403).json({ error: 'Cannot edit this track' });
    const { title, artist_id, album_id, image_path, featured_artist_ids } = req.body;
    let artistName = null;
    let albumName = null;
    let artistId = track.rows[0].artist_id;
    let albumId = track.rows[0].album_id;
    if (artist_id != null) {
      const a = await pool.query('SELECT id, name FROM artists WHERE id = $1', [artist_id]);
      if (!a.rows.length) return res.status(400).json({ error: 'Artist not found' });
      artistId = artist_id;
      artistName = a.rows[0].name;
    }
    if (album_id != null) {
      const al = await pool.query('SELECT id, name FROM albums WHERE id = $1', [album_id]);
      if (!al.rows.length) return res.status(400).json({ error: 'Album not found' });
      albumId = album_id;
      albumName = al.rows[0].name;
    }
    const newTitle = (title != null && title !== undefined) ? String(title).trim() : track.rows[0].title;
    if (!newTitle) return res.status(400).json({ error: 'Title required' });
    if (artistName == null && artistId) {
      const a = await pool.query('SELECT name FROM artists WHERE id = $1', [artistId]);
      artistName = a.rows[0]?.name || '';
    }
    if (albumName == null && albumId) {
      const al = await pool.query('SELECT name FROM albums WHERE id = $1', [albumId]);
      albumName = al.rows[0]?.name || '';
    }
    if (image_path !== undefined) {
      await pool.query(
        'UPDATE tracks SET title = $1, artist = $2, album = $3, artist_id = $4, album_id = $5, image_path = $6 WHERE id = $7',
        [newTitle, artistName || '', albumName || '', artistId, albumId, image_path || null, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE tracks SET title = $1, artist = $2, album = $3, artist_id = $4, album_id = $5 WHERE id = $6',
        [newTitle, artistName || '', albumName || '', artistId, albumId, req.params.id]
      );
    }
    const trackId = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM track_featured_artists WHERE track_id = $1', [trackId]);
    const featuredIds = Array.isArray(featured_artist_ids) ? featured_artist_ids.map((id) => parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0) : [];
    const uniqueFeatured = [...new Set(featuredIds)].filter((id) => id !== artistId);
    for (let i = 0; i < uniqueFeatured.length; i++) {
      const aid = uniqueFeatured[i];
      const a = await pool.query('SELECT id FROM artists WHERE id = $1', [aid]);
      if (a.rows.length) await pool.query('INSERT INTO track_featured_artists (track_id, artist_id, position) VALUES ($1, $2, $3)', [trackId, aid, i]);
    }
    const featuredSub = "(SELECT COALESCE(json_agg(json_build_object('id', fa.id, 'name', fa.name) ORDER BY tfa.position), '[]'::json) FROM track_featured_artists tfa JOIN artists fa ON fa.id = tfa.artist_id WHERE tfa.track_id = t.id)";
    const r = await pool.query(
      `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.created_at, t.image_path, t.artist_id, t.album_id, ${featuredSub} AS featured_artists FROM tracks t WHERE t.id = $1`,
      [trackId]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update track' });
  }
});

// Upload track (admin/uploader only) – artist_id/album_id from list, or artist/album text (legacy)
router.post('/', auth, requireRole(['admin', 'uploader']), upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
    const { title, artist, album, artist_id, album_id, image_path: trackImagePath } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const duration = parseInt(req.body.duration_seconds, 10) || 0;

    let artistId = artist_id ? parseInt(artist_id, 10) : null;
    let artistName = '';
    let albumId = null;
    let albumName = '';

    if (artistId) {
      const a = await pool.query('SELECT id, name FROM artists WHERE id = $1', [artistId]);
      if (!a.rows.length) return res.status(400).json({ error: 'Artist not found' });
      artistName = a.rows[0].name;
    } else if (artist?.trim()) {
      artistName = artist.trim();
      const existing = await pool.query('SELECT id FROM artists WHERE name = $1', [artistName]);
      artistId = existing.rows[0]?.id;
      if (!artistId) {
        const r = await pool.query('INSERT INTO artists (name, created_by) VALUES ($1, $2) RETURNING id', [artistName, req.userId]);
        artistId = r.rows[0].id;
      }
    } else {
      return res.status(400).json({ error: 'Artist required (select or enter)' });
    }

    if (album_id) {
      const al = await pool.query('SELECT id, name, artist_id FROM albums WHERE id = $1', [parseInt(album_id, 10)]);
      if (al.rows.length && al.rows[0].artist_id === artistId) {
        albumId = al.rows[0].id;
        albumName = al.rows[0].name;
      }
    } else if (album?.trim()) {
      albumName = album.trim();
      const existing = await pool.query('SELECT id FROM albums WHERE artist_id = $1 AND name = $2', [artistId, albumName]);
      albumId = existing.rows[0]?.id;
      if (!albumId) {
        const r = await pool.query('INSERT INTO albums (name, artist_id, created_by) VALUES ($1, $2, $3) RETURNING id', [albumName, artistId, req.userId]);
        albumId = r.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO tracks (title, artist, album, artist_id, album_id, duration_seconds, file_path, uploaded_by, image_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, artist, album, duration_seconds, created_at, image_path`,
      [title.trim(), artistName, albumName, artistId, albumId, duration, req.file.filename, req.userId, trackImagePath || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete track (uploaded_by or admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const track = await pool.query('SELECT id, file_path, uploaded_by FROM tracks WHERE id = $1', [req.params.id]);
    if (!track.rows.length) return res.status(404).json({ error: 'Track not found' });
    const canDelete = req.userRole === 'admin' || track.rows[0].uploaded_by === req.userId;
    if (!canDelete) return res.status(403).json({ error: 'Cannot delete this track' });
    const filePath = path.join(uploadDir, path.basename(track.rows[0].file_path));
    await pool.query('DELETE FROM tracks WHERE id = $1', [req.params.id]);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('Could not delete track file:', filePath, e.message);
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete track' });
  }
});

export default router;
