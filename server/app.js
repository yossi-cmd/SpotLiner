import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

import authRoutes from './routes/auth.js';
import tracksRoutes from './routes/tracks.js';
import searchRoutes from './routes/search.js';
import playlistsRoutes from './routes/playlists.js';
import meRoutes from './routes/me.js';
import artistsRoutes from './routes/artists.js';
import albumsRoutes from './routes/albums.js';
import uploadRoutes from './routes/upload.js';
import youtubeRoutes from './routes/youtube.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const uploadsBase = path.resolve(process.env.UPLOAD_PATH || './uploads/audio', '..');

const app = express();
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(uploadsBase));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tracks', tracksRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/me', meRoutes);
app.use('/api/artists', artistsRoutes);
app.use('/api/albums', albumsRoutes);
app.use('/api/youtube', youtubeRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 50MB)' });
  }
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Spotliner server running at http://localhost:${PORT}`);
});
