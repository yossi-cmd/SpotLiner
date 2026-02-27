import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { auth, requireRole } from '../middleware/auth.js';

const router = Router();
const uploadDir = path.resolve(process.env.UPLOAD_PATH || './uploads/audio', '..', 'images');

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase() || '.jpg';
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const safeExt = allowed.includes(ext) ? ext : '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
  },
});

// Upload image (auth, uploader/admin) – returns path relative to uploads root for URL
router.post('/image', auth, requireRole(['admin', 'uploader']), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
  const relativePath = `images/${req.file.filename}`;
  res.json({ path: relativePath });
});

export default router;
