const router    = require('express').Router();
const db        = require('../config/db');
const auth      = require('../middleware/auth');

router.use(auth);

function workingDaysThisMonth() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(Math.min(now, new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

// GET /api/standups/today
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      'SELECT * FROM standups WHERE user_id=$1 AND standup_date=$2',
      [req.user.id, today]
    );
    if (rows[0]) {
      res.json({ submitted: true, standup: rows[0] });
    } else {
      res.json({ submitted: false, standup: null });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/standups/achievement
router.get('/achievement', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        u.id AS user_id,
        u.name AS user_name,
        u.avatar_color,
        COUNT(CASE WHEN date_trunc('month', s.standup_date::timestamp) = date_trunc('month', CURRENT_DATE) THEN 1 END) AS this_month,
        COUNT(s.id) AS total_standups,
        COUNT(CASE WHEN s.has_blocker = true THEN 1 END) AS total_blockers,
        MAX(s.standup_date) AS last_standup
      FROM users u
      LEFT JOIN standups s ON s.user_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id, u.name, u.avatar_color
      ORDER BY this_month DESC, u.name
    `);

    const wdays = workingDaysThisMonth();
    const data  = rows.map(r => ({
      ...r,
      working_days_this_month: wdays,
      participation_pct: wdays > 0 ? Math.round((Number(r.this_month) / wdays) * 100) : 0,
    }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/standups
router.get('/', async (req, res) => {
  const { user_id, date_from, date_to } = req.query;
  const isManager = ['super_admin', 'manager', 'po'].includes(req.user.role_name) || req.user.permissions?.all;

  const filters = [];
  const params  = [];
  let i = 1;

  if (!isManager) {
    filters.push(`s.user_id = $${i++}`);
    params.push(req.user.id);
  } else if (user_id) {
    filters.push(`s.user_id = $${i++}`);
    params.push(user_id);
  }
  if (date_from) { filters.push(`s.standup_date >= $${i++}`); params.push(date_from); }
  if (date_to)   { filters.push(`s.standup_date <= $${i++}`); params.push(date_to); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const { rows } = await db.query(`
      SELECT s.*, u.name AS user_name, u.avatar_color
      FROM standups s
      JOIN users u ON u.id = s.user_id
      ${where}
      ORDER BY s.standup_date DESC, s.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/standups
router.post('/', async (req, res) => {
  const { standup_date, yesterday, today, has_blocker, blocker, blocker_plan } = req.body;
  if (!yesterday || !today) return res.status(400).json({ error: 'Yesterday dan Today wajib' });
  const date = standup_date || new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await db.query(
      `INSERT INTO standups (user_id, standup_date, yesterday, today, has_blocker, blocker, blocker_plan)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, date, yesterday, today, has_blocker || false, blocker || null, blocker_plan || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Standup hari ini sudah ada' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/standups/:id
router.put('/:id', async (req, res) => {
  const { standup_date, yesterday, today, has_blocker, blocker, blocker_plan } = req.body;
  try {
    const check = await db.query('SELECT user_id FROM standups WHERE id=$1', [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Standup tidak ditemukan' });

    const isOwner   = String(check.rows[0].user_id) === String(req.user.id);
    const isManager = ['super_admin', 'manager', 'po'].includes(req.user.role_name) || req.user.permissions?.all;
    if (!isOwner && !isManager) return res.status(403).json({ error: 'Akses ditolak' });

    const { rows } = await db.query(
      `UPDATE standups SET standup_date=$1, yesterday=$2, today=$3, has_blocker=$4, blocker=$5, blocker_plan=$6 WHERE id=$7 RETURNING *`,
      [standup_date, yesterday, today, has_blocker || false, blocker || null, blocker_plan || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
