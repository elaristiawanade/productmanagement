const router    = require('express').Router();
const db        = require('../config/db');
const auth      = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');

router.use(auth);

// GET /api/roadmap?product_id=
router.get('/', async (req, res) => {
  const { product_id } = req.query;
  const where  = product_id ? 'WHERE r.product_id = $1' : '';
  const params = product_id ? [product_id] : [];
  try {
    const { rows } = await db.query(`
      SELECT r.*, p.name AS product_name, p.color AS product_color, u.name AS created_by_name
      FROM product_roadmap r
      JOIN products p ON p.id = r.product_id
      LEFT JOIN users u ON u.id = r.created_by
      ${where}
      ORDER BY r.product_id, r.sort_order, r.id
    `, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/roadmap
router.post('/', checkRole('super_admin', 'manager', 'po'), async (req, res) => {
  const { product_id, feature_name, description, status, product_version, sort_order } = req.body;
  if (!product_id || !feature_name) return res.status(400).json({ error: 'product_id dan feature_name wajib' });
  try {
    const { rows } = await db.query(
      `INSERT INTO product_roadmap (product_id, feature_name, description, status, product_version, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [product_id, feature_name, description || null, status || 'planned', product_version || null, sort_order || 0, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/roadmap/:id
router.put('/:id', checkRole('super_admin', 'manager', 'po'), async (req, res) => {
  const { feature_name, description, status, product_version, sort_order } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE product_roadmap SET feature_name=$1, description=$2, status=$3, product_version=$4, sort_order=$5 WHERE id=$6 RETURNING *`,
      [feature_name, description || null, status, product_version || null, sort_order || 0, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Roadmap item tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/roadmap/:id
router.delete('/:id', checkRole('super_admin', 'manager', 'po'), async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM product_roadmap WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Roadmap item tidak ditemukan' });
    res.json({ message: 'Roadmap item dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
