const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

// GET /api/roles
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM roles ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/roles/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM roles WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Role tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/roles
router.post('/', auth, async (req, res) => {
  const { name, display_name, permissions } = req.body;
  if (!name || !display_name) return res.status(400).json({ error: 'name dan display_name wajib diisi' });
  try {
    const { rows } = await db.query(
      'INSERT INTO roles (name, display_name, permissions) VALUES ($1, $2, $3) RETURNING *',
      [name, display_name, JSON.stringify(permissions || {})]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Nama role sudah ada' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/roles/:id
router.put('/:id', auth, async (req, res) => {
  const { display_name, permissions } = req.body;
  if (!display_name) return res.status(400).json({ error: 'display_name wajib diisi' });
  try {
    const { rows } = await db.query(
      'UPDATE roles SET display_name = $1, permissions = $2 WHERE id = $3 RETURNING *',
      [display_name, JSON.stringify(permissions || {}), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Role tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/roles/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM roles WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Role tidak ditemukan' });
    res.json({ message: 'Role dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
