import { Router } from 'express';
import { getSections } from '../services/content.js';

const router = Router();

router.get('/content', (_req, res) => {
  try {
    res.json({ sections: getSections() });
  } catch (err) {
    console.error('Hub content error:', err);
    res.status(500).json({ error: 'Could not load hub content' });
  }
});

export default router;
