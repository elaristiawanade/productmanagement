const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

router.use(auth);

// GET /api/attachments/file/:filename — serve file from DB
router.get('/file/:filename', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT original_name, mime_type, file_data FROM backlog_attachments WHERE filename=$1',
      [req.params.filename]
    );
    if (!rows[0] || !rows[0].file_data) return res.status(404).json({ error: 'File tidak ditemukan' });

    const buffer = Buffer.from(rows[0].file_data, 'base64');
    res.setHeader('Content-Type', rows[0].mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${rows[0].original_name}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/attachments/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT uploaded_by FROM backlog_attachments WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Attachment tidak ditemukan' });

    const isOwner   = String(rows[0].uploaded_by) === String(req.user.id);
    const isManager = req.user.permissions?.all || ['super_admin', 'manager'].includes(req.user.role_name);
    if (!isOwner && !isManager) return res.status(403).json({ error: 'Akses ditolak' });

    await db.query('DELETE FROM backlog_attachments WHERE id=$1', [req.params.id]);
    res.json({ message: 'Attachment dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
