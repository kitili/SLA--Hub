import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

async function getProgressForStaff(staffId) {
  const reads = await query(
    'SELECT item_id FROM document_reads WHERE staff_id = $1',
    [staffId]
  );
  const checkpoints = await query(
    'SELECT checkpoint_id FROM checkpoint_completions WHERE staff_id = $1',
    [staffId]
  );

  return {
    readItems: reads.rows.map((r) => r.item_id),
    passedCheckpoints: checkpoints.rows.map((r) => r.checkpoint_id),
  };
}

router.get('/:staffId', async (req, res) => {
  try {
    const staffCheck = await query('SELECT id FROM staff WHERE id = $1', [req.params.staffId]);
    if (!staffCheck.rows.length) return res.status(404).json({ error: 'Staff not found' });

    const progress = await getProgressForStaff(req.params.staffId);
    res.json({ progress });
  } catch (err) {
    console.error('Progress get error:', err);
    res.status(500).json({ error: 'Could not fetch progress' });
  }
});

router.post('/read', async (req, res) => {
  try {
    const { staffId, itemId } = req.body;
    if (!staffId || !itemId) return res.status(400).json({ error: 'staffId and itemId required' });

    await query(
      `INSERT INTO document_reads (staff_id, item_id)
       VALUES ($1, $2)
       ON CONFLICT (staff_id, item_id) DO UPDATE SET read_at = NOW()`,
      [staffId, itemId]
    );
    await query('UPDATE staff SET last_active_at = NOW() WHERE id = $1', [staffId]);

    const progress = await getProgressForStaff(staffId);
    res.json({ progress });
  } catch (err) {
    console.error('Progress read error:', err);
    res.status(500).json({ error: 'Could not save read status' });
  }
});

router.post('/checkpoint', async (req, res) => {
  try {
    const { staffId, checkpointId } = req.body;
    if (!staffId || !checkpointId) return res.status(400).json({ error: 'staffId and checkpointId required' });

    await query(
      `INSERT INTO checkpoint_completions (staff_id, checkpoint_id)
       VALUES ($1, $2)
       ON CONFLICT (staff_id, checkpoint_id) DO UPDATE SET passed_at = NOW()`,
      [staffId, checkpointId]
    );
    await query('UPDATE staff SET last_active_at = NOW() WHERE id = $1', [staffId]);

    const progress = await getProgressForStaff(staffId);
    res.json({ progress });
  } catch (err) {
    console.error('Progress checkpoint error:', err);
    res.status(500).json({ error: 'Could not save checkpoint' });
  }
});

router.post('/reset-checkpoint', async (req, res) => {
  try {
    const { staffId, checkpointId, itemId } = req.body;
    if (!staffId || !checkpointId) return res.status(400).json({ error: 'staffId and checkpointId required' });

    await query(
      'DELETE FROM checkpoint_completions WHERE staff_id = $1 AND checkpoint_id = $2',
      [staffId, checkpointId]
    );
    if (itemId) {
      await query('DELETE FROM document_reads WHERE staff_id = $1 AND item_id = $2', [staffId, itemId]);
    }

    const progress = await getProgressForStaff(staffId);
    res.json({ progress });
  } catch (err) {
    console.error('Progress reset error:', err);
    res.status(500).json({ error: 'Could not reset checkpoint' });
  }
});

export default router;
