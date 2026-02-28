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
import adminRoutes from './routes/admin.js';
import { runStartupMigrations } from './db/index.js';
import { getVapidPublicKey } from './push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const uploadsBase = path.resolve(process.env.UPLOAD_PATH || './uploads/audio', '..');
const apiBase = process.env.VERCEL ? '' : '/api';

const app = express();
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
// Allow notification images to load from any origin (browser fetches image when showing push)
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
app.use('/uploads', express.static(uploadsBase));

app.use(`${apiBase}/auth`, authRoutes);
app.use(`${apiBase}/upload`, uploadRoutes);
app.use(`${apiBase}/tracks`, tracksRoutes);
app.use(`${apiBase}/search`, searchRoutes);
app.use(`${apiBase}/playlists`, playlistsRoutes);
app.use(`${apiBase}/me`, meRoutes);
app.use(`${apiBase}/artists`, artistsRoutes);
app.use(`${apiBase}/albums`, albumsRoutes);
app.use(`${apiBase}/youtube`, youtubeRoutes);
app.use(`${apiBase}/admin`, adminRoutes);

app.get(`${apiBase}/health`, (req, res) => res.json({ ok: true }));

app.get(`${apiBase}/config`, (req, res) => {
  res.json({ vapidPublicKey: getVapidPublicKey() });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 50MB)' });
  }
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

if (!process.env.VERCEL) {
  runStartupMigrations()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Spotliner server running at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Server startup failed:', err);
      process.exit(1);
    });
}

export default app;
