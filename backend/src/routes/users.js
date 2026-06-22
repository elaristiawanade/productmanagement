const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const db        = require('../config/db');
const auth      = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');

router.use(auth);

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.name, u.email, u.avatar_color, u.is_active, u.created_at,
             r.id AS role_id, r.name AS role_name, r.display_name AS role_display,
             COUNT(DISTINCT bi.id) AS assigned_items,
             COALESCE(
               json_agg(DISTINCT jsonb_build_object('id', p.id, 'name', p.name))
               FILTER (WHERE p.id IS NOT NULL),
               '[]'
             ) AS products
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN backlog_items bi ON bi.assignee_id = u.id AND bi.status NOT IN ('done','backlog')
      LEFT JOIN user_products up ON up.user_id = u.id
      LEFT JOIN products p ON p.id = up.product_id
      GROUP BY u.id, r.id
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', checkRole('super_admin', 'manager'), async (req, res) => {
  const { name, email, password, role_id, avatar_color } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password wajib' });
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash, role_id, avatar_color) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, avatar_color, is_active, created_at',
      [name, email.toLowerCase().trim(), hash, role_id || null, avatar_color || '#4F46E5']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email sudah digunakan' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', checkRole('super_admin', 'manager'), async (req, res) => {
  const { name, email, role_id, avatar_color, is_active } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE users SET name=$1, email=$2, role_id=$3, avatar_color=$4, is_active=$5 WHERE id=$6 RETURNING id, name, email, avatar_color, is_active',
      [name, email?.toLowerCase().trim(), role_id || null, avatar_color, is_active ?? true, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email sudah digunakan' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/password  (admin reset)
router.put('/:id/password', checkRole('super_admin'), async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rowCount } = await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json({ message: 'Password berhasil direset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id  (soft delete)
router.delete('/:id', checkRole('super_admin'), async (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'Tidak bisa menonaktifkan diri sendiri' });
  try {
    const { rowCount } = await db.query('UPDATE users SET is_active=false WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json({ message: 'User dinonaktifkan' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id/products
router.get('/:id/products', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT p.* FROM products p JOIN user_products up ON up.product_id = p.id WHERE up.user_id = $1',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/products — replace all product assignments
router.put('/:id/products', checkRole('super_admin', 'manager'), async (req, res) => {
  const { product_ids } = req.body;
  if (!Array.isArray(product_ids)) return res.status(400).json({ error: 'product_ids harus array' });
  try {
    await db.query('DELETE FROM user_products WHERE user_id = $1', [req.params.id]);
    if (product_ids.length > 0) {
      const values = product_ids.map((pid, i) => `($1, $${i + 2})`).join(', ');
      await db.query(`INSERT INTO user_products (user_id, product_id) VALUES ${values}`, [req.params.id, ...product_ids]);
    }
    res.json({ message: 'Produk user diperbarui' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/roles — get all roles
router.get('/roles', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM roles ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
