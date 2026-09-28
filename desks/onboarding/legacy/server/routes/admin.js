import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db/pool.js';
import { requireAdmin, verifyAdminPin } from '../middleware/adminAuth.js';
import {
  getSections,
  addItem,
  updateItem,
  removeItem,
} from '../services/content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_PATH = path.resolve(__dirname, '../../documents');
const UPLOAD_DIR = path.join(DOCS_PATH, 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

const router = Router();

// Section recap checkpoints — one per active section
function totalCheckpoints() {
  return getSections().length;
}

router.post('/verify-pin', async (req, res) => {
  try {
    const { staffId, pin } = req.body;
    if (!staffId || !pin) return res.status(400).json({ error: 'Staff ID and PIN required' });
    const result = await verifyAdminPin(staffId, pin);
    if (!result.ok) return res.status(401).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) {
    console.error('Verify PIN error:', err);
    res.status(500).json({ error: 'Could not verify PIN' });
  }
});

router.get('/overview', requireAdmin, async (_req, res) => {
  try {
    const total = totalCheckpoints();
    const result = await query(`
      SELECT
        s.id, s.email, s.full_name, s.campus, s.job_title, s.is_admin,
        s.created_at, s.last_active_at,
        COUNT(DISTINCT cc.checkpoint_id) AS checkpoints_passed,
        COUNT(DISTINCT dr.item_id) AS documents_read
      FROM staff s
      LEFT JOIN checkpoint_completions cc ON cc.staff_id = s.id
      LEFT JOIN document_reads dr ON dr.staff_id = s.id
      GROUP BY s.id
      ORDER BY s.last_active_at DESC
    `);

    const staff = result.rows.map((row) => ({
      ...row,
      checkpoints_passed: Number(row.checkpoints_passed),
      documents_read: Number(row.documents_read),
      completion_pct: total ? Math.round((Number(row.checkpoints_passed) / total) * 100) : 0,
      complete: Number(row.checkpoints_passed) >= total,
    }));

    res.json({
      totalCheckpoints: total,
      staffCount: staff.length,
      completedCount: staff.filter((s) => s.complete).length,
      staff,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Could not fetch admin overview' });
  }
});

router.get('/content', requireAdmin, (_req, res) => {
  try {
    res.json({ sections: getSections() });
  } catch (err) {
    res.status(500).json({ error: 'Could not load content' });
  }
});

router.post('/content/items', requireAdmin, upload.single('file'), (req, res) => {
  try {
    const { sectionId, title, itemId } = req.body;
    if (!sectionId || !title?.trim()) {
      return res.status(400).json({ error: 'Section and title are required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const relativePath = path.join('uploads', req.file.filename).replace(/\\/g, '/');
    const id = itemId?.trim() || `doc-${Date.now()}`;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const type = ['.mp4', '.mov', '.webm'].includes(ext) ? 'video' : undefined;

    const data = addItem(sectionId, {
      id,
      title: title.trim(),
      files: [relativePath],
      ...(type && { type }),
    });

    res.status(201).json({ sections: data.sections, itemId: id, filePath: relativePath });
  } catch (err) {
    console.error('Add item error:', err);
    res.status(400).json({ error: err.message || 'Could not add document' });
  }
});

router.put('/content/items/:itemId', requireAdmin, (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const data = updateItem(req.params.itemId, { title: title.trim() });
    res.json({ sections: data.sections });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not update document' });
  }
});

router.delete('/content/items/:itemId', requireAdmin, (req, res) => {
  try {
    const { data, removed } = removeItem(req.params.itemId);

    for (const filePath of removed.files || []) {
      const full = path.resolve(DOCS_PATH, filePath);
      if (full.startsWith(DOCS_PATH) && fs.existsSync(full)) {
        fs.unlinkSync(full);
      }
    }

    res.json({ sections: data.sections, removed });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not remove document' });
  }
});

export default router;
