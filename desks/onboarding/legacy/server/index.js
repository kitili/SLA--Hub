import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { initDb, getPool } from './db/pool.js';
import staffRoutes from './routes/staff.js';
import progressRoutes from './routes/progress.js';
import adminRoutes from './routes/admin.js';
import hubRoutes from './routes/hub.js';
import { initContent } from './services/content.js';

const app = express();
const PORT = process.env.PORT || 3001;
const DOCS_PATH = path.resolve(__dirname, '../documents');

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173'];

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: Boolean(getPool()),
    docsPath: DOCS_PATH,
  });
});

// In dev, port 3001 is API-only — point browsers to the Vite frontend
if (process.env.SERVE_CLIENT !== 'true') {
  app.get('/', (_req, res) => {
    const devUrl = process.env.DEV_CLIENT_URL || 'http://localhost:5173';
    res.redirect(devUrl);
  });
}

app.use('/api/staff', staffRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/hub', hubRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/view/*splat', (req, res) => {
  const raw = req.params.splat;
  const relativePath = Array.isArray(raw) ? raw.join('/') : raw;
  const filePath = path.resolve(DOCS_PATH, relativePath);

  if (!filePath.startsWith(DOCS_PATH)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const filename = path.basename(filePath);

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(filePath);
});

if (process.env.SERVE_CLIENT === 'true') {
  const clientDist = path.resolve(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*splat', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

async function start() {
  try {
    initContent();
    await initDb();
  } catch (err) {
    console.error('Database init failed:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Silverleaf Onboarding API running on http://localhost:${PORT}`);
  });
}

start();
