const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

router.use(auth);

// DELETE /api/activities/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT user_id FROM item_activities WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Activity tidak ditemukan' });

    const isOwner   = String(rows[0].user_id) === String(req.user.id);
    const isManager = req.user.permissions?.all || ['super_admin', 'manager'].includes(req.user.role_name);
    if (!isOwner && !isManager) return res.status(403).json({ error: 'Akses ditolak' });

    await db.query('DELETE FROM item_activities WHERE id=$1', [req.params.id]);
    res.json({ message: 'Activity dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
