import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { auth, requireRole } from '../middleware/auth.js';
import pool from '../db/index.js';

const router = Router();
const API_KEY = process.env.YOUTUBE_API_KEY;
const imagesDir = path.resolve(process.env.UPLOAD_PATH || './uploads/audio', '..', 'images');
const audioDir = path.resolve(process.env.UPLOAD_PATH || './uploads/audio');
const YT_DLP_CMD = process.env.YT_DLP_CMD || 'yt-dlp';

function extractPlaylistId(urlOrId) {
  if (!urlOrId?.trim()) return null;
  const s = urlOrId.trim();
  if (!s.includes('.')) return s;
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    return u.searchParams.get('list') || null;
  } catch {
    return null;
  }
}

async function fetchPlaylistMeta(playlistId) {
  const base = 'https://www.googleapis.com/youtube/v3';
  const res = await fetch(
    `${base}/playlists?part=snippet&id=${encodeURIComponent(playlistId)}&key=${API_KEY}`
  );
  const data = await res.json();
  if (!data?.items?.length) return null;
  const sn = data.items[0].snippet;
  const thumb = sn.thumbnails?.maxres?.url || sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url;
  return { title: sn.title || 'Playlist', thumbnailUrl: thumb || null };
}

async function fetchPlaylistItems(playlistId, pageToken = '') {
  const base = 'https://www.googleapis.com/youtube/v3';
  const url = `${base}/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=50&key=${API_KEY}${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

// GET /api/youtube/playlist?url=... or ?id=...
router.get('/playlist', auth, requireRole(['admin', 'uploader']), async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({ error: 'YouTube API not configured (YOUTUBE_API_KEY)' });
    }
    const urlOrId = req.query.url || req.query.id;
    const playlistId = extractPlaylistId(urlOrId);
    if (!playlistId) {
      return res.status(400).json({ error: 'Invalid playlist URL or ID' });
    }
    const meta = await fetchPlaylistMeta(playlistId);
    if (!meta) return res.status(404).json({ error: 'Playlist not found' });

    const items = [];
    let pageToken = '';
    do {
      const data = await fetchPlaylistItems(playlistId, pageToken);
      const list = data.items || [];
      for (const it of list) {
        const title = it.snippet?.title || '—';
        const videoId = it.snippet?.resourceId?.videoId || null;
        items.push({ title, videoId });
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    res.json({
      title: meta.title,
      thumbnailUrl: meta.thumbnailUrl,
      items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch playlist' });
  }
});

// POST /api/youtube/upload-thumbnail – body: { url }
router.post('/upload-thumbnail', auth, requireRole(['admin', 'uploader']), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url?.trim()) return res.status(400).json({ error: 'url required' });
    const resImg = await fetch(url, { headers: { 'User-Agent': 'Spotliner/1' } });
    if (!resImg.ok) throw new Error('Failed to fetch image');
    const contentType = resImg.headers.get('content-type') || '';
    const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(imagesDir, filename);
  const buf = Buffer.from(await resImg.arrayBuffer());
  fs.mkdirSync(imagesDir, { recursive: true });
    fs.writeFileSync(filePath, buf);
    const relativePath = `images/${filename}`;
    res.json({ path: relativePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to save thumbnail' });
  }
});

function getVideoDuration(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const out = spawnSync(YT_DLP_CMD, ['--dump-json', '--no-download', url], {
    encoding: 'utf8',
    timeout: 15000,
  });
  if (out.status !== 0) return null;
  try {
    const data = JSON.parse(out.stdout);
    return Math.round(Number(data.duration) || 0);
  } catch {
    return null;
  }
}

function downloadAudio(videoId, outputPath) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const out = spawnSync(
    YT_DLP_CMD,
    [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputPath,
      '--no-playlist',
      '--no-warnings',
      url,
    ],
    { encoding: 'utf8', timeout: 300000 }
  );
  return out.status === 0;
}

// POST /api/youtube/download-track – body: { videoId, title, artist_id, album_id?, image_path? }
// Requires yt-dlp installed. Creates track in DB from downloaded audio.
router.post('/download-track', auth, requireRole(['admin', 'uploader']), async (req, res) => {
  try {
    const { videoId, title, artist_id, album_id, image_path } = req.body || {};
    if (!videoId?.trim() || !title?.trim() || !artist_id) {
      return res.status(400).json({ error: 'videoId, title and artist_id required' });
    }
    const artist = await pool.query('SELECT id, name FROM artists WHERE id = $1', [parseInt(artist_id, 10)]);
    if (!artist.rows.length) return res.status(400).json({ error: 'Artist not found' });
    const artistName = artist.rows[0].name;
    let albumId = null;
    let albumName = '';
    if (album_id) {
      const al = await pool.query('SELECT id, name FROM albums WHERE id = $1', [parseInt(album_id, 10)]);
      if (al.rows.length) {
        albumId = al.rows[0].id;
        albumName = al.rows[0].name;
      }
    }

    const duration = getVideoDuration(videoId.trim());
    const safeId = videoId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `yt-${safeId}-${Date.now()}.mp3`;
    const outputPath = path.join(audioDir, filename);

    fs.mkdirSync(audioDir, { recursive: true });
    const ok = downloadAudio(videoId.trim(), outputPath);
    if (!ok || !fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch {}
      return res.status(502).json({
        error: 'Failed to download audio. Install yt-dlp (https://github.com/yt-dlp/yt-dlp) and ensure it is on PATH.',
      });
    }

    const artistId = parseInt(artist_id, 10);
    const durationSec = duration || 0;
    const result = await pool.query(
      `INSERT INTO tracks (title, artist, album, artist_id, album_id, duration_seconds, file_path, uploaded_by, image_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, artist, album, duration_seconds, created_at, image_path`,
      [title.trim(), artistName, albumName, artistId, albumId, durationSec, filename, req.userId, image_path || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
