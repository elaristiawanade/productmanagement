const router    = require('express').Router();
const multer    = require('multer');
const db        = require('../config/db');
const auth      = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');

router.use(auth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows    = lines.slice(1).map(l => {
    const vals = parseRow(l);
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

const STATUS_MAP = {
  'To Do': 'todo', 'In Progress': 'in_progress', 'In Review': 'in_review',
  'Done': 'done', 'Blocked': 'blocked', 'Backlog': 'backlog',
};
const PRIORITY_MAP = {
  'Highest': 'critical', 'High': 'high', 'Medium': 'medium',
  'Low': 'low', 'Lowest': 'low',
};
const TYPE_MAP = {
  'Story': 'story', 'Bug': 'bug', 'Task': 'task', 'Sub-task': 'task',
  'Epic': 'story',
};

// POST /api/import/jira
router.post('/jira', checkRole('super_admin', 'manager', 'po'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File CSV wajib' });
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id wajib' });

  const text = req.file.buffer.toString('utf-8');
  const { rows: csvRows } = parseCSV(text);

  const created = [];
  const skipped = [];
  const errors  = [];

  const { rows: prod } = await db.query('SELECT code FROM products WHERE id=$1', [product_id]);
  if (!prod[0]) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  const prodCode = prod[0].code;

  for (const row of csvRows) {
    const code  = row['Issue key'] || row['Key'] || '';
    const title = row['Summary'] || '';
    if (!title) { skipped.push({ code, reason: 'No summary' }); continue; }

    const type     = TYPE_MAP[row['Issue Type']] || 'story';
    const status   = STATUS_MAP[row['Status']] || 'backlog';
    const priority = PRIORITY_MAP[row['Priority']] || 'medium';
    const points   = parseInt(row['Story Points']) || 0;
    const deadline = row['Due Date'] ? row['Due Date'] : null;

    const itemCode = code || `${prodCode}-IMPORT-${Date.now()}`;

    try {
      const existing = await db.query('SELECT id FROM backlog_items WHERE product_id=$1 AND code=$2', [product_id, itemCode]);
      if (existing.rows[0]) { skipped.push({ code: itemCode, reason: 'Already exists' }); continue; }

      await db.query(
        `INSERT INTO backlog_items (product_id, code, title, type, priority, story_points, status, deadline, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [product_id, itemCode, title, type, priority, points, status, deadline, req.user.id]
      );
      created.push(itemCode);
    } catch (err) {
      errors.push({ code: itemCode, reason: err.message });
    }
  }

  res.json({ created: created.length, skipped: skipped.length, errors: errors.length, details: { created, skipped, errors } });
});

module.exports = router;
