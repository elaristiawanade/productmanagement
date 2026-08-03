-- Dummy data for local/dev testing of the C-Level Dashboard module (Leader Notes /
-- Leader Task / My Task / Dashboard tabs) only. Safe to re-run (idempotent).
--
-- All accounts below share the password: 1234
--
--   admin@admin.com   / 1234  (Super Admin — sees & writes every department)
--   sarah@company.com / 1234  (Commissioner, department HC)
--   rian@company.com  / 1234  (Manager, department Sales)
--   wulan@company.com / 1234  (SME, department Finance)
--   fajar@company.com / 1234  (Commissioner, department Product)
--   dewi@company.com  / 1234  (SME, no department — cross-functional)
--
-- Plus the base app's existing demo users, auto-mapped to a department by
-- migration_v10 (developer/qa -> IT, po/manager -> PMG): budi@company.com
-- (Manager, PMG), citra@company.com (PO, PMG), andi@company.com (Developer,
-- IT), rafi@company.com (QA, IT) — all password: password (see DEVELOPMENT.md).

-- ─── DUMMY USERS (HC / Sales / Finance / Product — no auto-mapped role) ─────

INSERT INTO users (name, email, password_hash, role_id, avatar_color, department)
SELECT 'Sarah Amelia', 'sarah@company.com', '$2a$10$GPxEqwfOQeP.5yxu0gqVyufQy23s4ti/DNiRx9rIUaPdVe6y/k66K',
       (SELECT id FROM roles WHERE name = 'commissioner'), '#e11d48', 'HC'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'sarah@company.com');

INSERT INTO users (name, email, password_hash, role_id, avatar_color, department)
SELECT 'Rian Saputra', 'rian@company.com', '$2a$10$GPxEqwfOQeP.5yxu0gqVyufQy23s4ti/DNiRx9rIUaPdVe6y/k66K',
       (SELECT id FROM roles WHERE name = 'manager'), '#c2410c', 'Sales'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'rian@company.com');

INSERT INTO users (name, email, password_hash, role_id, avatar_color, department)
SELECT 'Wulan Sari', 'wulan@company.com', '$2a$10$GPxEqwfOQeP.5yxu0gqVyufQy23s4ti/DNiRx9rIUaPdVe6y/k66K',
       (SELECT id FROM roles WHERE name = 'sme'), '#0d9488', 'Finance'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'wulan@company.com');

INSERT INTO users (name, email, password_hash, role_id, avatar_color, department)
SELECT 'Fajar Nugroho', 'fajar@company.com', '$2a$10$GPxEqwfOQeP.5yxu0gqVyufQy23s4ti/DNiRx9rIUaPdVe6y/k66K',
       (SELECT id FROM roles WHERE name = 'commissioner'), '#65a30d', 'Product'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'fajar@company.com');

INSERT INTO users (name, email, password_hash, role_id, avatar_color, department)
SELECT 'Dewi Lestari', 'dewi@company.com', '$2a$10$GPxEqwfOQeP.5yxu0gqVyufQy23s4ti/DNiRx9rIUaPdVe6y/k66K',
       (SELECT id FROM roles WHERE name = 'sme'), '#7c3aed', NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'dewi@company.com');

-- ─── DUMMY LEADER NOTES (today, spread across all 6 departments) ───────────

INSERT INTO leader_notes (user_id, department, note_date, goals_this_week)
SELECT (SELECT id FROM users WHERE email = 'budi@company.com'), 'PMG', CURRENT_DATE,
       'Finalisasi roadmap Q4, approval budget campaign marketing, dan kickoff project API Gateway.'
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'budi@company.com')
  AND NOT EXISTS (SELECT 1 FROM leader_notes WHERE department = 'PMG' AND note_date = CURRENT_DATE);

INSERT INTO leader_notes (user_id, department, note_date, goals_this_week)
SELECT (SELECT id FROM users WHERE email = 'andi@company.com'), 'IT', CURRENT_DATE,
       'Koordinasi lintas tim untuk migrasi server produksi — penetration testing dijadwalkan minggu depan.'
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'andi@company.com')
  AND NOT EXISTS (SELECT 1 FROM leader_notes WHERE department = 'IT' AND note_date = CURRENT_DATE);

INSERT INTO leader_notes (user_id, department, note_date, goals_this_week)
SELECT (SELECT id FROM users WHERE email = 'sarah@company.com'), 'HC', CURRENT_DATE,
       'Rekrutmen 3 posisi Backend Engineer — 2 kandidat sudah masuk tahap interview final.'
WHERE NOT EXISTS (SELECT 1 FROM leader_notes WHERE department = 'HC' AND note_date = CURRENT_DATE);

INSERT INTO leader_notes (user_id, department, note_date, goals_this_week)
SELECT (SELECT id FROM users WHERE email = 'rian@company.com'), 'Sales', CURRENT_DATE,
       'Follow-up 12 leads enterprise, 3 di antaranya sudah masuk tahap negosiasi kontrak.'
WHERE NOT EXISTS (SELECT 1 FROM leader_notes WHERE department = 'Sales' AND note_date = CURRENT_DATE);

INSERT INTO leader_notes (user_id, department, note_date, goals_this_week)
SELECT (SELECT id FROM users WHERE email = 'wulan@company.com'), 'Finance', CURRENT_DATE,
       'Audit laporan keuangan Q2 rampung, submit ke komisaris untuk review akhir.'
WHERE NOT EXISTS (SELECT 1 FROM leader_notes WHERE department = 'Finance' AND note_date = CURRENT_DATE);

INSERT INTO leader_notes (user_id, department, note_date, goals_this_week)
SELECT (SELECT id FROM users WHERE email = 'fajar@company.com'), 'Product', CURRENT_DATE,
       'Riset kompetitor selesai, mulai user interview untuk validasi 2 fitur baru.'
WHERE NOT EXISTS (SELECT 1 FROM leader_notes WHERE department = 'Product' AND note_date = CURRENT_DATE);

-- ─── DUMMY LEADER TASKS (mix of departments, statuses, priorities, deadlines) ─

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'FIN-001', 'Audit laporan keuangan Q2', 'Finance', 'medium', 'done',
       (SELECT id FROM users WHERE email = 'wulan@company.com'), CURRENT_DATE - 2,
       (SELECT id FROM users WHERE email = 'wulan@company.com')
WHERE NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'FIN-001');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'FIN-002', 'Submit laporan ke komisaris', 'Finance', 'high', 'in_review',
       (SELECT id FROM users WHERE email = 'wulan@company.com'), CURRENT_DATE + 3,
       (SELECT id FROM users WHERE email = 'wulan@company.com')
WHERE NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'FIN-002');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'HC-001', 'Rekrutmen 3 posisi Backend Engineer', 'HC', 'high', 'in_progress',
       (SELECT id FROM users WHERE email = 'sarah@company.com'), CURRENT_DATE + 12,
       (SELECT id FROM users WHERE email = 'sarah@company.com')
WHERE NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'HC-001');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'HC-002', 'Susun offering letter kandidat terpilih', 'HC', 'medium', 'todo',
       (SELECT id FROM users WHERE email = 'sarah@company.com'), CURRENT_DATE + 20,
       (SELECT id FROM users WHERE email = 'sarah@company.com')
WHERE NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'HC-002');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'IT-001', 'Setup VPC baru', 'IT', 'critical', 'in_progress',
       (SELECT id FROM users WHERE email = 'andi@company.com'), CURRENT_DATE + 17,
       (SELECT id FROM users WHERE email = 'admin@admin.com')
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'andi@company.com')
  AND NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'IT-001');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'IT-002', 'Migrasi database', 'IT', 'high', 'todo',
       (SELECT id FROM users WHERE email = 'rafi@company.com'), CURRENT_DATE + 22,
       (SELECT id FROM users WHERE email = 'admin@admin.com')
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'rafi@company.com')
  AND NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'IT-002');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'IT-003', 'Penetration testing sistem baru', 'IT', 'high', 'todo',
       (SELECT id FROM users WHERE email = 'rafi@company.com'), CURRENT_DATE - 2,
       (SELECT id FROM users WHERE email = 'citra@company.com')
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'rafi@company.com')
  AND EXISTS (SELECT 1 FROM users WHERE email = 'citra@company.com')
  AND NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'IT-003');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'IT-004', 'Evaluasi vendor cloud alternatif untuk DR site', 'IT', 'medium', 'backlog',
       (SELECT id FROM users WHERE email = 'andi@company.com'), CURRENT_DATE + 30,
       (SELECT id FROM users WHERE email = 'citra@company.com')
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'andi@company.com')
  AND EXISTS (SELECT 1 FROM users WHERE email = 'citra@company.com')
  AND NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'IT-004');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'PMG-001', 'Review proposal budget Q4', 'PMG', 'critical', 'in_review',
       (SELECT id FROM users WHERE email = 'budi@company.com'), CURRENT_DATE + 5,
       (SELECT id FROM users WHERE email = 'budi@company.com')
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'budi@company.com')
  AND NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'PMG-001');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'PMG-002', 'Approve roadmap dengan tim Product', 'PMG', 'high', 'todo',
       (SELECT id FROM users WHERE email = 'citra@company.com'), CURRENT_DATE + 9,
       (SELECT id FROM users WHERE email = 'budi@company.com')
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'citra@company.com')
  AND EXISTS (SELECT 1 FROM users WHERE email = 'budi@company.com')
  AND NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'PMG-002');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'PMG-003', 'Rapat sinkronisasi OKR Q4 dengan seluruh Product Owner', 'PMG', 'medium', 'todo',
       (SELECT id FROM users WHERE email = 'citra@company.com'), CURRENT_DATE + 6,
       (SELECT id FROM users WHERE email = 'budi@company.com')
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'citra@company.com')
  AND EXISTS (SELECT 1 FROM users WHERE email = 'budi@company.com')
  AND NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'PMG-003');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'PRD-001', 'Riset kompetitor fitur baru', 'Product', 'low', 'backlog',
       (SELECT id FROM users WHERE email = 'fajar@company.com'), CURRENT_DATE + 27,
       (SELECT id FROM users WHERE email = 'fajar@company.com')
WHERE NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'PRD-001');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'PRD-002', 'User interview 5 pelanggan enterprise', 'Product', 'medium', 'todo',
       (SELECT id FROM users WHERE email = 'fajar@company.com'), CURRENT_DATE + 15,
       (SELECT id FROM users WHERE email = 'fajar@company.com')
WHERE NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'PRD-002');

INSERT INTO leader_tasks (code, title, department, priority, status, deadline, created_by)
SELECT 'PRD-003', 'Mobile Application Koperasi', 'Product', 'medium', 'todo', NULL,
       (SELECT id FROM users WHERE email = 'sarah@company.com')
WHERE NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'PRD-003');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'SLS-001', 'Follow-up leads enterprise Q3', 'Sales', 'medium', 'todo',
       (SELECT id FROM users WHERE email = 'rian@company.com'), CURRENT_DATE + 7,
       (SELECT id FROM users WHERE email = 'rian@company.com')
WHERE NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'SLS-001');

INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, deadline, created_by)
SELECT 'SLS-002', 'Siapkan proposal kontrak untuk 3 leads utama', 'Sales', 'high', 'in_review',
       (SELECT id FROM users WHERE email = 'rian@company.com'), CURRENT_DATE + 3,
       (SELECT id FROM users WHERE email = 'rian@company.com')
WHERE NOT EXISTS (SELECT 1 FROM leader_tasks WHERE code = 'SLS-002');

SELECT 'Seed C-Level (dummy data) selesai.' AS status;
