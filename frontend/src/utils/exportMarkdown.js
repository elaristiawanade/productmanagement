// Export MD: one product's full data package (product, roadmap, features, epics, sprints,
// backlog tree, bugs, QA test cases, plus every comment / activity / progress / test-run
// history) as ONE Markdown file, meant to be uploaded to any AI (Claude, ChatGPT, Gemini…).
//
// Built entirely in the browser from the same GET endpoints the pages already use — like the
// Export CSV buttons — so the file holds exactly what the exporting account may see, and the
// backend/database need no change. Client Management is never included, and neither are
// e-mail addresses or attachments (text only).
//
// Heads-up on "features": backlog_items.feature_id / Impacted Features point at
// product_roadmap (GET /roadmap), while bugs / QA test cases point at the `features` table
// (GET /features). The file keeps the two apart and says so in its legend.
import { format, parseISO, isValid } from 'date-fns';
import client from '../api/client';
import { flattenBacklogTree } from './backlogHierarchy';

const BACKLOG_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'];
const BUG_STAGES       = ['open', 'in_progress', 'ready_to_test', 'reopen', 'done', 'improvement'];
const TC_STATUSES      = ['draft', 'todo', 'in_progress', 'in_review', 'finish'];
const SPRINT_STATUSES  = ['planned', 'active', 'completed'];
const RUN_RESULTS      = ['pass', 'fail', 'blocked', 'pending', 'skip'];
const TYPE_LABEL = { epic: 'Epic', story: 'Story', task: 'Task', bug: 'Bug', independent: 'Independent' };

const BACKLOG_PAGE_SIZE = 500;   // GET /backlog is paginated; we walk every page
const ACTIVITY_CONCURRENCY = 6;  // parallel GET …/activities requests (one per card)

// ─── Data collection ──────────────────────────────────────────────────────────

async function fetchAllBacklog(productId) {
  const byId = new Map();
  for (let page = 1; ; page++) {
    const { data } = await client.get('/backlog', {
      params: { product_id: productId, page, limit: BACKLOG_PAGE_SIZE }, silent: true,
    });
    for (const it of data.items) byId.set(it.id, it);   // de-dupe if rows shift between pages
    if (data.items.length < BACKLOG_PAGE_SIZE || byId.size >= data.total) break;
  }
  return [...byId.values()];
}

// Runs fn over list with at most `size` calls in flight; keeps the input order.
async function mapPool(list, size, fn) {
  const out = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, worker));
  return out;
}

/**
 * Fetches everything for one product. `canBugs` = the account may open Bugs Incident
 * (otherwise that section is left out instead of failing with 403). `onProgress(done, total)`
 * reports the per-card activity requests, the slow part of a big product.
 * A card whose history can't be loaded gets `null` (shown as "gagal dimuat") so one bad
 * request never sinks the whole export.
 */
export async function collectProductData(product, { canBugs = false, onProgress } = {}) {
  const pid = product.id;
  const q = { params: { product_id: pid }, silent: true };
  const get = (url) => client.get(url, q).then(r => r.data);

  const [backlog, epics, features, roadmap, sprints, testCases, testRuns, bugs, bugProgress] = await Promise.all([
    fetchAllBacklog(pid),
    get('/epics'), get('/features'), get('/roadmap'), get('/sprints'),
    get('/qa/test-cases'), get('/qa/test-runs'),
    canBugs ? get('/bugs') : Promise.resolve(null),
    canBugs ? get('/bugs/progress') : Promise.resolve(null),
  ]);

  const jobs = [
    ...backlog.map(it => ({ kind: 'item', id: it.id, url: `/backlog/${it.id}/activities` })),
    ...(bugs || []).map(b => ({ kind: 'bug', id: b.id, url: `/bugs/${b.id}/activities` })),
  ];
  let done = 0;
  onProgress?.(0, jobs.length);
  const results = await mapPool(jobs, ACTIVITY_CONCURRENCY, async (job) => {
    try {
      const { data } = await client.get(job.url, { silent: true });
      return data;
    } catch {
      return null;
    } finally {
      onProgress?.(++done, jobs.length);
    }
  });

  const itemActivities = new Map();
  const bugActivities = new Map();
  jobs.forEach((job, i) => (job.kind === 'item' ? itemActivities : bugActivities).set(job.id, results[i]));

  return {
    product, backlog, epics, features, roadmap, sprints, testCases, testRuns,
    bugs, bugProgress, itemActivities, bugActivities,
    failedHistories: results.filter(r => r === null).length,
  };
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

const toDate = (v) => {
  if (!v) return null;
  const d = typeof v === 'string' ? parseISO(v) : new Date(v);
  return isValid(d) ? d : null;
};
const dt    = (v) => { const d = toDate(v); return d ? format(d, 'yyyy-MM-dd HH:mm') : ''; };
const day   = (v) => { const d = toDate(v); return d ? format(d, 'yyyy-MM-dd') : ''; };
const month = (v) => { const d = toDate(v); return d ? format(d, 'yyyy-MM') : ''; };

// "@[Nama]" is how comments store a mention; plain "@Nama" reads better.
const clean = (v) => (v === null || v === undefined ? '' : String(v)).replace(/@\[([^\]]+)\]/g, '@$1').trim();
const one   = (v) => clean(v).replace(/\s*\r?\n\s*/g, ' ');
const enumv = (v) => (clean(v) ? `\`${one(v)}\`` : '');
const cell  = (v) => (one(v) || '—').replace(/\|/g, '\\|');
// Continuation lines of free text must not start a Markdown heading of their own.
const noHeading = (line) => line.replace(/^(\s*)#/, '$1\\#');

// "- **Key:** value · **Key:** value" — empty values are skipped, an all-empty line is dropped.
const pairs = (list) => {
  const parts = list
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `**${k}:** ${v}`);
  return parts.length ? `- ${parts.join(' · ')}` : null;
};

// Free text (description, steps, notes…) as a quoted block under a bold label, so whatever the
// user typed — headings, lists, pipes — can never break the file's own structure.
const textBlock = (label, v) => {
  const s = clean(v);
  if (!s) return null;
  return `**${label}:**\n${s.split(/\r?\n/).map(l => `> ${l}`.trimEnd()).join('\n')}`;
};

const table = (headers, rows) => {
  if (!rows.length) return '_Tidak ada data._';
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(r => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n');
};

// "todo 5 · in_progress 6 · done 7", known values first in workflow order, then anything else.
const countBy = (list, key, order) => {
  const counts = new Map();
  for (const row of list) {
    const k = row[key] || '(kosong)';
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const keys = [...order.filter(k => counts.has(k)), ...[...counts.keys()].filter(k => !order.includes(k)).sort()];
  return keys.map(k => `${k} ${counts.get(k)}`).join(' · ');
};

const names = (list, fallback) => (list || []).map(a => a.name).filter(Boolean).join(', ') || fallback || '';
const ref = (code, title) => (code ? `${code}${title ? ` · ${one(title)}` : ''}` : '');

const activityLines = (acts) => {
  if (acts === null) return ['_Riwayat gagal dimuat saat export._'];
  if (!acts || !acts.length) return ['_Belum ada komentar atau aktivitas._'];
  return acts.map(a => {
    const [first, ...rest] = clean(a.content).split(/\r?\n/);
    const kind = a.type === 'comment' ? 'Komentar' : 'Perubahan';
    // System entries (e.g. automatic Epic/Story status) have no user; their text already says "— oleh …".
    const who = one(a.user_name) ? ` · ${one(a.user_name)}` : '';
    return [`- ${dt(a.created_at)}${who} · ${kind}: ${first}`,
      ...rest.map(l => `  ${noHeading(l)}`)].join('\n');
  });
};

const blocks = (...parts) => parts.flat().filter(p => p !== null && p !== undefined && p !== '').join('\n\n');

// ─── Markdown builder ─────────────────────────────────────────────────────────

/**
 * Pure: turns collectProductData()'s result into the Markdown text.
 * meta = { exportedAt: Date, exportedBy: { name, roleDisplay }, origin: 'http://host' }
 */
export function buildProductMarkdown(data, meta) {
  const { product, backlog, epics, features, roadmap, sprints, testCases, testRuns,
    bugs, bugProgress, itemActivities, bugActivities, failedHistories } = data;
  const origin = (meta.origin || '').replace(/\/$/, '');
  const link = (path) => `${origin}${path}`;
  const by = meta.exportedBy || {};
  const exportedAt = meta.exportedAt || new Date();

  const featureById = new Map(features.map(f => [f.id, f]));
  const featureRef = (row) => (row.feature_code ? ref(row.feature_code, row.feature_name) : '');
  const runsByCase = new Map();
  for (const r of [...testRuns].sort((a, b) => String(a.executed_at || a.created_at).localeCompare(String(b.executed_at || b.created_at)))) {
    const list = runsByCase.get(r.test_case_id) || [];
    list.push(r);
    runsByCase.set(r.test_case_id, list);
  }
  const progressByBug = new Map();
  for (const p of [...(bugProgress || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    const list = progressByBug.get(p.bug_id) || [];
    list.push(p);
    progressByBug.set(p.bug_id, list);
  }
  const activeSprint = sprints.find(s => s.status === 'active');
  const delayed = backlog.filter(it => it.is_delayed).length;

  // ── header + legend ──
  const header = [
    `# PO Tracker — Paket Data Produk ${product.code} (${one(product.name)})`,
    [
      `> Diekspor dari PO Tracker pada ${format(exportedAt, 'yyyy-MM-dd HH:mm')} (zona waktu ${format(exportedAt, 'xxx')}) oleh ${one(by.name) || '—'}${by.roleDisplay ? ` (${one(by.roleDisplay)})` : ''}.`,
      '> Isi file mengikuti hak akses akun pengekspor — data yang tidak boleh dilihat akun ini tidak ikut.',
      '> Ini potret data saat export; perubahan sesudahnya tidak tercantum. Lampiran, alamat e-mail, dan Client Management tidak disertakan.',
      failedHistories ? `> Perhatian: riwayat ${failedHistories} kartu gagal dimuat saat export (ditandai di kartunya).` : null,
    ].filter(Boolean).join('\n'),
  ].join('\n\n');

  const legend = blocks(
    '## 1. Cara membaca file ini',
    [
      '- **Backlog** disusun sebagai pohon Epic → Story → Task/Bug: makin dalam level heading (`###` → `####` → `#####`), makin bawah posisinya di hierarki. Item *Independent* berdiri sendiri di akhir.',
      '- Kode kartu (mis. `HRS-7`, `BUG-001`, `TC-001`) dipakai untuk saling merujuk antar bagian.',
      '- Ada **dua jenis "feature"** yang berbeda:',
      '  - **Roadmap** (bagian 4): fitur di roadmap produk. Inilah yang dipakai *Impacted Features* di kartu Backlog (label relasi saja).',
      '  - **Product Features** (bagian 5, kode seperti `HRS-F1`): dipakai kolom *Feature* di Bugs Incident dan QA Test Case.',
      '  - Keduanya disinkronkan: setiap Product Feature punya tepat satu baris Roadmap (kolom "Dari Product Feature"), dan nama, status, versi, serta progress Roadmap mengikuti Feature-nya.',
      `- Status backlog: ${BACKLOG_STATUSES.map(s => `\`${s}\``).join(', ')}. Status Epic dan Story otomatis mengikuti anaknya. **TERLAMBAT** = deadline lewat dan status bukan \`done\`, \`backlog\`, atau \`in_review\` (item yang sedang di-review tidak dianggap terlambat).`,
      '- **Progress %** kartu Backlog dihitung otomatis: kartu tanpa anak dari status (`backlog`/`todo` 0%, `in_progress` 50%, `in_review` 80%, `done` 100%, `blocked` 25%); Epic/Story yang punya anak: rata-rata progress item di bawahnya, dibobot story point. Test case: dari hasil run terakhir (`pass` 100%, `fail` 50%, `blocked` 25%, belum dijalankan/`pending` 0%).',
      '- **Progress Feature/Roadmap** diatur manual lewat status, +20% per tahap: `planned` 20%, `research` 40%, `on_progress` 60%, `testing` 80%, `active`/`offline` 100% (Feature `on_hold` tetap di persen tahap terakhir). **Progress Produk** = rata-rata progress Feature-nya. Keduanya **tidak** dihitung dari Backlog.',
      '- Stage bug bawaan: `open` → `in_progress` → `ready_to_test` → (`reopen`) → `done`; `improvement` = masukan/ide, bukan bug. Super Admin bisa menambah Stage lain (ditulis dengan kodenya). Type: `bug`, `inquiry` (laporan yang perlu klarifikasi), atau `improvement` (usulan perbaikan; bisa dibuat menjadi kartu Backlog), plus Type tambahan dari Super Admin.',
      `- Status test case: ${TC_STATUSES.map(s => `\`${s}\``).join(', ')} (nama status kartu Backlog, ditambah \`draft\` dan \`finish\`; \`in_review\` dan \`finish\` tidak dianggap terlambat; progress test case tetap dari hasil run terakhir, bukan dari status). Test case bisa di-assign ke lebih dari satu orang. Hasil test run: ${RUN_RESULTS.map(s => `\`${s}\``).join(', ')}.`,
      `- Status sprint: ${SPRINT_STATUSES.map(s => `\`${s}\``).join(', ')}.`,
      '- "Perubahan" di riwayat = catatan otomatis sistem (status/stage/assignee berubah); "Komentar" = ditulis user.',
      '- Link mengarah ke kartu asli di PO Tracker (perlu login).',
    ].join('\n'),
  );

  // ── summary ──
  const runsTotal = testRuns.length;
  const summary = blocks(
    '## 2. Ringkasan',
    [
      `- **Backlog:** ${backlog.length} item${backlog.length ? ` — ${countBy(backlog, 'status', BACKLOG_STATUSES)}` : ''}${delayed ? ` · terlambat ${delayed}` : ''}`,
      `- **Tipe backlog:** ${backlog.length ? countBy(backlog, 'type', Object.keys(TYPE_LABEL)) : '—'}`,
      bugs
        ? `- **Bugs Incident:** ${bugs.length} tiket${bugs.length ? ` — ${countBy(bugs, 'stage', BUG_STAGES)}` : ''}`
        : '- **Bugs Incident:** tidak disertakan (akun pengekspor tidak punya akses Bugs Incident)',
      `- **QA Test Case:** ${testCases.length}${testCases.length ? ` — ${countBy(testCases, 'status', TC_STATUSES)}` : ''}; test run ${runsTotal}${runsTotal ? ` (${countBy(testRuns, 'result', RUN_RESULTS)})` : ''}`,
      `- **Sprint:** ${sprints.length}${sprints.length ? ` — ${countBy(sprints, 'status', SPRINT_STATUSES)}` : ''}${activeSprint ? ` · aktif: ${one(activeSprint.name)} (${day(activeSprint.start_date) || '?'} s/d ${day(activeSprint.end_date) || '?'})` : ''}`,
      `- **Roadmap:** ${roadmap.length} · **Product Features:** ${features.length} · **Epic:** ${epics.length}`,
    ].join('\n'),
  );

  // ── product ──
  const productSection = blocks(
    '## 3. Produk',
    [
      pairs([['Kode', product.code], ['Nama', one(product.name)], ['Status', enumv(product.status)], ['Owner', one(product.owner_name)],
        ['Progress', product.progress != null ? `${product.progress}%` : '']]),
      pairs([['Repository', one(product.repository_url)], ['Link', link(`/products?product=${product.id}`)]]),
    ].filter(Boolean).join('\n'),
    textBlock('Deskripsi', product.description),
  );

  // ── roadmap / features / epics / sprints (tables) ──
  const roadmapSection = blocks(
    '## 4. Roadmap',
    '_Fitur di roadmap produk — dipakai Impacted Features di kartu Backlog._',
    table(
      ['Feature', 'Status', 'Progress', 'Versi', 'Target rilis', 'Dari Product Feature', 'Deskripsi'],
      [...roadmap].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.feature_name).localeCompare(String(b.feature_name)))
        .map(r => {
          const src = r.source_feature_id ? featureById.get(r.source_feature_id) : null;
          return [r.feature_name, r.status, r.progress != null ? `${r.progress}%` : '', r.product_version, month(r.month_release_target), src ? ref(src.code, src.name) : '', r.description];
        }),
    ),
  );

  const featureSection = blocks(
    '## 5. Product Features',
    '_Dari Products → Features — dipakai kolom Feature di Bugs Incident dan QA Test Case._',
    table(
      ['Kode', 'Nama', 'Epic', 'Status', 'Progress', 'Prioritas', 'Owner', 'Target rilis'],
      [...features].sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
        .map(f => [f.code, f.name, f.epic_name, f.status, f.progress != null ? `${f.progress}%` : '', f.priority, f.owner_name, f.target_release]),
    ),
  );

  const epicSection = blocks(
    '## 6. Epic',
    '_Dari Products → Epic (kolom Epic di kartu Backlog)._',
    table(
      ['Kode', 'Nama', 'Status', 'Prioritas', 'Dibuat oleh', 'Deskripsi'],
      [...epics].sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
        .map(e => [e.code, e.name, e.status, e.priority, e.created_by_name, e.description]),
    ),
  );

  // Progress mirrors the Sprints page: only actionable cards (not epic/story containers) count.
  const sprintStats = (s) => {
    const items = backlog.filter(it => it.sprint_id === s.id);
    const work = items.filter(it => it.type !== 'epic' && it.type !== 'story');
    const pts = (list) => list.reduce((sum, it) => sum + (Number(it.story_points) || 0), 0);
    return {
      progress: `${pts(work.filter(it => it.status === 'done'))} / ${pts(work)}`,
      perStatus: items.length ? `${countBy(items, 'status', BACKLOG_STATUSES)} (total ${items.length})` : '0',
    };
  };

  const sprintSection = blocks(
    '## 7. Sprint',
    '_**Progress poin** dihitung dari kartu Backlog di sprint itu (task/bug/independent, sama seperti halaman Sprints). **Velocity** adalah angka committed/completed yang diisi manual di form sprint (dipakai grafik velocity Dashboard), jadi bisa berbeda dari progress._',
    table(
      ['Sprint', 'Status', 'Periode', 'Goal', 'Kapasitas', 'Progress poin (selesai / total)', 'Item per status', 'Velocity manual (committed / completed)', 'Link'],
      sprints.map(s => {
        const st = sprintStats(s);
        return [
          s.name, s.status, `${day(s.start_date) || '?'} s/d ${day(s.end_date) || '?'}`, s.goal, s.capacity,
          st.progress, st.perStatus,
          `${s.committed_points ?? 0} / ${s.completed_points ?? 0}`,
          link(`/sprints?sprint=${s.id}`),
        ];
      }),
    ),
  );

  // ── backlog tree ──
  const backlogCards = flattenBacklogTree(backlog).map(({ item: it, depth }) => {
    const acts = itemActivities.get(it.id);
    const impacted = (it.features || []).map(f => one(f.name)).filter(Boolean).join(', ') || one(it.feature_name);
    return blocks(
      `${'#'.repeat(Math.min(3 + depth, 6))} [${TYPE_LABEL[it.type] || it.type}] ${it.code} · ${one(it.title)}`,
      [
        pairs([
          ['Status', enumv(it.status)], ['Progress', it.progress != null ? `${it.progress}%` : ''], ['Prioritas', one(it.priority)],
          ['Story points', it.story_points ?? ''], ['Estimasi', it.estimated_hours ? `${it.estimated_hours} jam` : ''],
          ['Deadline', it.deadline ? `${day(it.deadline)}${it.is_delayed ? ' (TERLAMBAT)' : ''}` : ''],
        ]),
        pairs([['Assignee', names(it.assignees, one(it.assignee_name))], ['Sprint', one(it.sprint_name)], ['Epic', ref(it.epic_code, it.epic_name)]]),
        pairs([['Impacted Features', impacted], ['Parent', ref(it.parent_code, it.parent_title)]]),
        pairs([['Dibuat', `${dt(it.created_at)}${it.created_by_name ? ` oleh ${one(it.created_by_name)}` : ''}`], ['Diperbarui', dt(it.updated_at)]]),
        pairs([['Link', link(`/backlog?item=${it.id}`)]]),
      ].filter(Boolean).join('\n'),
      textBlock('Acceptance criteria', it.acceptance_criteria),
      textBlock('Catatan', it.notes),
      `**Komentar & aktivitas${acts ? ` (${acts.length})` : ''}:**\n${activityLines(acts).join('\n')}`,
    );
  });
  const backlogSection = blocks(`## 8. Backlog (${backlog.length} item)`, backlogCards.length ? backlogCards : '_Tidak ada data._');

  // ── bugs ──
  let bugSection;
  if (!bugs) {
    bugSection = blocks('## 9. Bugs Incident', '_Tidak disertakan: akun pengekspor tidak punya akses Bugs Incident._');
  } else {
    const bugCards = [...bugs]
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
      .map(b => {
        const progress = progressByBug.get(b.id) || [];
        const acts = bugActivities.get(b.id);
        const reporter = one(b.reported_by_name) || one(b.reporter_name) || (b.reporter_email ? '(pelapor publik)' : '');
        return blocks(
          `### ${b.code} · ${one(b.title)}`,
          [
            pairs([['Type', enumv(b.type_name || b.type || 'bug')], ['Stage', enumv(b.stage)], ['Severity', one(b.severity)], ['Prioritas', one(b.priority)]]),
            pairs([['Backlog item', ref(b.item_code, b.item_title)], ['Feature', featureRef(b)]]),
            pairs([['Assignee', names(b.assignees, one(b.assigned_to_name))], ['Pelapor', reporter]]),
            pairs([
              ['Incident', dt(b.created_at)], ['Closed', dt(b.closed_at)],
              ['Update terakhir', b.last_update ? `${dt(b.last_update)}${b.last_updated_by_name ? ` oleh ${one(b.last_updated_by_name)}` : ''}` : ''],
            ]),
            pairs([['Link', link(`/bugs?bug=${b.id}`)]]),
          ].filter(Boolean).join('\n'),
          textBlock('Deskripsi', b.description),
          textBlock('Langkah reproduksi', b.steps_to_reproduce),
          `**Riwayat progress (${progress.length}):**\n${progress.length
            ? progress.map(p => `- ${dt(p.created_at)} · ${one(p.updated_by_name) || '—'} · stage \`${p.stage}\`${one(p.note) ? ` — ${one(p.note)}` : ''}`).join('\n')
            : '_Belum ada update progress._'}`,
          `**Komentar & aktivitas${acts ? ` (${acts.length})` : ''}:**\n${activityLines(acts).join('\n')}`,
        );
      });
    bugSection = blocks(`## 9. Bugs Incident (${bugs.length} tiket)`, bugCards.length ? bugCards : '_Tidak ada data._');
  }

  // ── QA ──
  const tcCards = [...testCases]
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
    .map(tc => {
      const runs = runsByCase.get(tc.id) || [];
      return blocks(
        `### ${tc.code} · ${one(tc.title)}`,
        [
          pairs([['Status', enumv(tc.status)], ['Progress', tc.progress != null ? `${tc.progress}%` : ''], ['Prioritas', one(tc.priority)]]),
          pairs([['Backlog item', ref(tc.item_code, tc.item_title)], ['Feature', featureRef(tc)]]),
          pairs([['Assignee', names(tc.assignees, '')], ['Deadline', tc.deadline ? day(tc.deadline) : '']]),
          pairs([['Author', one(tc.created_by_name)], ['Dibuat', dt(tc.created_at)], ['Diperbarui', dt(tc.updated_at)]]),
          pairs([['Link', link(`/qa?case=${tc.id}`)]]),
        ].filter(Boolean).join('\n'),
        textBlock('Deskripsi', tc.description),
        textBlock('Langkah', tc.steps),
        textBlock('Expected result', tc.expected_result),
        `**Riwayat test run (${runs.length}):**\n${runs.length
          ? runs.map(r => `- ${dt(r.executed_at || r.created_at)} · ${one(r.sprint_name) || 'tanpa sprint'} · \`${r.result}\` · ${one(r.tester_name) || '—'}${one(r.notes) ? ` — ${one(r.notes)}` : ''}${r.bug_reference ? ` · bug: ${one(r.bug_reference)}` : ''}`).join('\n')
          : '_Belum pernah dijalankan._'}`,
      );
    });
  const qaSection = blocks(`## 10. QA Test Case (${testCases.length})`, tcCards.length ? tcCards : '_Tidak ada data._');

  return `${blocks(header, legend, summary, productSection, roadmapSection, featureSection, epicSection,
    sprintSection, backlogSection, bugSection, qaSection, '---\n_Akhir paket data._')}\n`;
}

export const exportFileName = (product, at = new Date()) =>
  `PO-Tracker_${product.code}_${format(at, 'yyyyMMdd_HHmm')}.md`;

export function downloadMarkdown(fileName, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
