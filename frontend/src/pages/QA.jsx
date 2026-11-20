import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useChartTheme } from '../utils/chartTheme';

const RESULT_LINES = [
  { key: 'pass_count',    name: 'Pass',    color: '#1F9D55' },
  { key: 'fail_count',    name: 'Fail',    color: '#E5484D' },
  { key: 'blocked_count', name: 'Blocked', color: '#D9891A' },
];

// One product's sprints in time order (rows come sorted from /qa/dashboard). The x label drops the
// product code ("HRS Sprint 2" -> "Sprint 2"); the tooltip still shows the full sprint name.
function SprintTrend({ rows, ct, yMax, height, compact = false }) {
  const code = rows[0]?.product_code;
  const data = rows.map(r => ({ ...r, label: code ? String(r.sprint).replace(new RegExp(`^${code}\\s*`), '') : r.sprint }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 12, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
        <XAxis dataKey="label" interval={0} tick={{ ...ct.axisTick, fontSize: compact ? 10 : 11 }} stroke={ct.line} padding={{ left: 10, right: 10 }} />
        <YAxis tick={ct.axisTick} stroke={ct.line} allowDecimals={false} domain={[0, yMax]} />
        <Tooltip {...ct.tooltip} labelFormatter={(label, payload) => payload?.[0]?.payload?.sprint || label} />
        {!compact && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {RESULT_LINES.map(l => (
          <Line key={l.key} type="linear" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2}
            dot={{ r: compact ? 3 : 3.5, fill: l.color }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
import { Plus, Pencil, Trash2, Play, CheckCircle2, XCircle, AlertCircle, Clock, Download, Upload, AlertTriangle } from 'lucide-react';
import client from '../api/client';
import { useDeepLink } from '../utils/deepLink';
import { toastCreated } from '../utils/createdToast';
import Modal from '../components/Modal';
import StatusBadge, { STATUS_MAP } from '../components/StatusBadge';
import StatusMenu from '../components/StatusMenu';
import PriorityBadge from '../components/PriorityBadge';
import SearchableSelect from '../components/SearchableSelect';
import SearchableMultiSelect from '../components/SearchableMultiSelect';
import AssigneeStack from '../components/AssigneeStack';
import BugsPerFeatureCard from '../components/BugsPerFeatureCard';
import DeadlineDate from '../components/DeadlineDate';
import ProgressBar from '../components/ProgressBar';
import { buildBacklogTreeOptions } from '../utils/backlogHierarchy';
import { buildFeatureOptions, featureText } from '../utils/featureOptions';
import AttachmentSection from '../components/AttachmentSection';
import OpenLinkButton from '../components/OpenLinkButton';
import RefLink from '../components/RefLink';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

// Test case statuses (migration_v35) in workflow order: the Backlog card names (To Do / In Progress / In Review) with
// Draft before and Finish at the end. Labels and colours come from STATUS_MAP, so they look like Backlog's.
const TC_STATUSES = ['draft', 'todo', 'in_progress', 'in_review', 'finish'];
// Handed in: the deadline is never red, same rule as In Review on a Backlog card
const TC_NOT_LATE = ['in_review', 'finish'];

const RESULT_ICONS = {
  pass:    { icon: CheckCircle2, cls: 'text-emerald-500' },
  fail:    { icon: XCircle,      cls: 'text-red-500'     },
  blocked: { icon: AlertCircle,  cls: 'text-orange-500'  },
  pending: { icon: Clock,        cls: 'text-slate-400'   },
  skip:    { icon: Clock,        cls: 'text-slate-300'   },
};

// Progress of a test case comes from its latest test run (backend). The bar is green like every progress bar; the
// result itself is in the tooltip and in the Pass/Fail columns.
const RUN_LABEL = { pass: 'Pass', fail: 'Fail', blocked: 'Blocked', pending: 'Pending', skip: 'Skip' };
const caseProgressTitle = (tc) => tc.last_result
  ? `Progress dari run terakhir: ${RUN_LABEL[tc.last_result] || tc.last_result} (Pass 100%, Fail 50%, Blocked 25%)`
  : 'Belum pernah dijalankan (0%)';

// Rendered with key={tc.id}: the form state is seeded once, so switching to another test case (?case= deep link from
// Ctrl K while this modal is open) must remount it, or saving would write this case's fields onto the other one.
function TestCaseForm({ tc, products, backlogItems, features, users, onSave, onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    product_id: tc?.product_id || '', backlog_item_id: tc?.backlog_item_id || '',
    feature_id: tc?.feature_id || '',
    title: tc?.title || '', description: tc?.description || '',
    steps: tc?.steps || '', expected_result: tc?.expected_result || '',
    status: tc?.status || 'draft', priority: tc?.priority || 'medium',
    assignee_ids: (tc?.assignees || []).map(a => a.id),
    deadline: tc?.deadline ? String(tc.deadline).slice(0, 10) : '', // optional; '' clears it on update
  });
  // The "Buka" buttons leave the QA page, so ask first when the form has unsaved edits (first-render form = saved)
  const savedForm = useRef(form);
  const leaveTo = (path) => {
    const dirty = JSON.stringify(form) !== JSON.stringify(savedForm.current);
    if (dirty && !confirm('Perubahan yang belum disimpan akan hilang. Lanjutkan?')) return;
    navigate(path);
  };
  // Saved links only: once a picker is changed (not saved yet) its button would point at the old record
  const showItemButton = !!tc?.backlog_item_id && !!tc.item_code && String(form.backlog_item_id) === String(tc.backlog_item_id);
  const showFeatureButton = !!tc?.feature_id && !!tc.feature_code && String(form.feature_id) === String(tc.feature_id);
  const [saving, setSaving] = useState(false);
  const attachRef = useRef(null);
  // Done items are hidden from new picks (QA shouldn't pile onto closed work) but the
  // item currently linked stays visible even if done, so editing never silently unlinks it.
  const filteredItems = backlogItems.filter(b =>
    (!form.product_id || b.product_id === +form.product_id) &&
    (b.status !== 'done' || String(b.id) === String(form.backlog_item_id))
  );

  const save = async (e) => {
    e.preventDefault();
    if (!form.backlog_item_id) { toast.error('Backlog Item wajib dipilih'); return; }
    setSaving(true);
    try {
      // Same shape as Bugs: the first pick is the primary assignee (assigned_to), the rest additional_assignee_ids
      const { assignee_ids, ...payload } = form;
      payload.assigned_to = assignee_ids[0] || '';
      payload.additional_assignee_ids = assignee_ids.slice(1);
      if (tc?.id) { await client.put(`/qa/test-cases/${tc.id}`, payload); toast.success('Test case diperbarui'); }
      else {
        const res = await client.post('/qa/test-cases', payload);
        await attachRef.current?.uploadPending(res.data.id);
        toastCreated('Test case', res.data?.code, 'dibuat');
      }
      onSave();
    } catch {} finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4">
      <div>
        <label className="label">Produk *</label>
        <select className="select" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value, backlog_item_id: '', feature_id: '' }))} required>
          <option value="">Pilih produk</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Backlog Item *</label>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              value={form.backlog_item_id}
              onChange={v => setForm(f => ({ ...f, backlog_item_id: v }))}
              options={buildBacklogTreeOptions(filteredItems)}
              placeholder="Pilih item"
              searchPlaceholder="Cari backlog item..."
            />
          </div>
          {showItemButton && (
            <OpenLinkButton href={`/backlog?item=${tc.backlog_item_id}`} onOpen={() => leaveTo(`/backlog?item=${tc.backlog_item_id}`)}
              code={tc.item_code} title={`Buka di Backlog: ${tc.item_code} — ${tc.item_title || ''}`} />
          )}
        </div>
      </div>
      <div className="col-span-2">
        <label className="label">Feature (opsional)</label>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              value={form.feature_id}
              onChange={v => setForm(f => ({ ...f, feature_id: v }))}
              options={buildFeatureOptions(features, products, form.product_id)}
              placeholder="— Tidak terkait —"
              emptyOptionLabel="— Tidak terkait —"
              searchPlaceholder="Cari kode produk, kode atau nama feature..."
              emptyMessage="Belum ada feature di produk ini"
            />
          </div>
          {showFeatureButton && (
            <OpenLinkButton href={`/products?feature=${tc.feature_id}`} onOpen={() => leaveTo(`/products?feature=${tc.feature_id}`)}
              code={tc.feature_code} title={`Buka feature di Products: ${tc.feature_code} — ${tc.feature_name || ''}`} />
          )}
        </div>
      </div>
      <div className="col-span-2">
        <label className="label">Judul Test Case *</label>
        <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
      </div>
      <div className="col-span-2">
        <label className="label">Deskripsi</label>
        <textarea className="input h-16 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="col-span-2">
        <label className="label">Langkah-langkah</label>
        <textarea className="input h-24 resize-none font-mono text-xs" value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} placeholder="1. Buka halaman...\n2. Klik tombol...\n3. Verifikasi..." />
      </div>
      <div className="col-span-2">
        <label className="label">Expected Result</label>
        <textarea className="input h-16 resize-none" value={form.expected_result} onChange={e => setForm(f => ({ ...f, expected_result: e.target.value }))} />
      </div>
      <div>
        <label className="label">Status</label>
        <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          {TC_STATUSES.map(s => <option key={s} value={s}>{STATUS_MAP[s]?.label || s}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Prioritas</label>
        <select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
          {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {/* Assignee + Deadline side by side, same as the Bugs and Backlog forms (more than one person allowed) */}
      <div>
        <label className="label">Assigned To</label>
        <SearchableMultiSelect label="assignee"
          options={users.map(u => ({ v: u.id, l: u.name }))}
          selected={form.assignee_ids}
          searchPlaceholder="Cari nama assignee..."
          onChange={vals => setForm(f => ({ ...f, assignee_ids: vals }))} />
      </div>
      <div>
        <label className="label">Deadline (opsional)</label>
        <input type="date" className="input" value={form.deadline}
          onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
      </div>
      {/* Attachments — queued locally until the test case is created, uploaded live once it exists */}
      <AttachmentSection ref={attachRef} basePath="/qa/test-cases" deletePath="/qa/attachments" entityId={tc?.id} noun="test case" />
      <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : (tc?.id ? 'Perbarui' : 'Buat Test Case')}</button>
      </div>
    </form>
  );
}

function TestRunForm({ tc, sprints, onSave, onClose }) {
  const [form, setForm] = useState({ test_case_id: tc.id, sprint_id: '', result: 'pending', notes: '', bug_reference: '' });
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await client.post('/qa/test-runs', form);
      toast.success('Test run disimpan');
      onSave();
    } catch {} finally { setSaving(false); }
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <p className="text-sm text-slate-500 mb-3">Test case: <strong className="text-slate-700">{tc.title}</strong></p>
      </div>
      <div>
        <label className="label">Sprint</label>
        <select className="select" value={form.sprint_id} onChange={e => setForm(f => ({ ...f, sprint_id: e.target.value }))}>
          <option value="">— Pilih Sprint —</option>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name} ({s.product_id})</option>)}
        </select>
      </div>
      <div>
        <label className="label">Hasil *</label>
        <div className="grid grid-cols-5 gap-2">
          {['pass','fail','blocked','pending','skip'].map(r => (
            <button type="button" key={r} onClick={() => setForm(f => ({ ...f, result: r }))}
              className={`py-2 rounded-lg text-xs font-medium border transition-all
                ${form.result === r ? 'ring-1 ring-slate-800 border-slate-800 text-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
              {r.charAt(0).toUpperCase()+r.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {form.result === 'fail' && (
        <div>
          <label className="label">Bug Reference</label>
          <input className="input" value={form.bug_reference} onChange={e => setForm(f => ({ ...f, bug_reference: e.target.value }))} placeholder="BUG-001, Jira-123, dll" />
        </div>
      )}
      <div>
        <label className="label">Catatan</label>
        <textarea className="input h-20 resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Run'}</button>
      </div>
    </form>
  );
}

export default function QA() {
  const { can } = useAuth();
  const [tab,          setTab]         = useState('dashboard');
  const [products,     setProducts]    = useState([]);
  const [testCases,    setTestCases]   = useState([]);
  const [testRuns,     setTestRuns]    = useState([]);
  const [backlogItems, setBacklogItems] = useState([]);
  const [features,     setFeatures]    = useState([]);
  const [sprints,      setSprints]     = useState([]);
  const [users,        setUsers]       = useState([]);
  const [dashboard,    setDashboard]   = useState(null);
  // Test Cases tab: show only the test cases assigned to any of these users (empty = everyone), like the Bugs filter
  const [assigneeFilter, setAssigneeFilter] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const productParam = searchParams.get('product') || '';
  const [filters,      setFilters]     = useState({ product_id: productParam });
  // Sidebar product links (?product=ID) drive the product filter; the select below writes back to the URL
  useEffect(() => { setFilters(f => f.product_id === productParam ? f : { ...f, product_id: productParam }); }, [productParam]);
  const changeProduct = (v) => setSearchParams(p => { const n = new URLSearchParams(p); if (v) n.set('product', v); else n.delete('product'); return n; }, { replace: true });
  const [modal,        setModal]       = useState({ open: false, type: '', data: null });
  const [loading,      setLoading]     = useState(true);
  const [perPageCases, setPerPageCases] = useState(10);
  const [pageCases,    setPageCases]   = useState(1);
  const [perPageRuns,  setPerPageRuns] = useState(10);
  const [pageRuns,     setPageRuns]    = useState(1);
  const [importing,    setImporting]   = useState(false);
  const ct = useChartTheme();
  const importInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filters.product_id ? { product_id: filters.product_id } : {};
      const [pr, tc, tr, bl, ft, sp, us, db] = await Promise.all([
        products.length ? null : client.get('/products'),
        client.get('/qa/test-cases', { params }),
        client.get('/qa/test-runs',  { params }),
        backlogItems.length ? null : client.get('/backlog', { params: { limit: 2000 } }),
        features.length ? null : client.get('/features'),
        sprints.length ? null : client.get('/sprints'),
        users.length ? null : client.get('/users'),   // assignee picker and filter
        client.get('/qa/dashboard',  { params }),
      ]);
      if (pr) setProducts(pr.data);
      setTestCases(tc.data);
      setTestRuns(tr.data);
      if (bl) setBacklogItems(bl.data.items);
      if (ft) setFeatures(ft.data);
      if (sp) setSprints(sp.data);
      if (us) setUsers(us.data);
      setDashboard(db.data);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // ?case=<id> (Ctrl K palette) opens that test case's form (when the role may edit it), ?new=1 an empty one.
  // The list is fetched unfiltered so a case outside the current product filter still opens.
  useDeepLink(['case', 'new'], ({ case: caseId, new: isNew }) => {
    setTab('cases');
    if (caseId) {
      if (!can('qa', 'update')) return;
      client.get('/qa/test-cases').then(r => {
        const found = r.data.find(t => String(t.id) === String(caseId));
        if (found) setModal({ open: true, type: 'tc', data: found });
        else toast.error('Test case tidak ditemukan');
      }).catch(() => {});
    } else if (isNew && can('qa', 'create')) {
      setModal({ open: true, type: 'tc', data: null });
    }
  });

  // Status dropdown on the table's pill (like Backlog). Only the changed row is updated locally: load() would swap the
  // whole tab for the spinner and refetch the dashboard for a one-field change.
  const changeStatus = async (tc, status) => {
    try {
      const { data } = await client.patch(`/qa/test-cases/${tc.id}/status`, { status });
      setTestCases(list => list.map(t => (t.id === tc.id ? { ...t, status: data?.status ?? status } : t)));
      toast.success(`Status ${tc.code}: ${STATUS_MAP[data?.status ?? status]?.label || status}`);
    } catch { /* the API client shows the error */ }
  };

  const deleteTC = async (id) => {
    if (!confirm('Hapus test case ini?')) return;
    await client.delete(`/qa/test-cases/${id}`);
    toast.success('Test case dihapus'); load();
  };

  const csvEscape = (val) => {
    const s = val === null || val === undefined ? '' : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // Exports what the table shows (the Assignee filter applies), like the Bugs export. "Assigned To" lists names
  // separated by commas, primary first; Import CSV reads the column back the same way.
  const exportTestCasesCSV = () => {
    const headers = ['Kode', 'Judul', 'Deskripsi', 'Langkah', 'Expected Result', 'Status', 'Prioritas', 'Deadline', 'Assigned To', 'Backlog Item', 'Features', 'Produk', 'Author'];
    const rows = filteredCases.map(tc => [
      tc.code, tc.title, tc.description, tc.steps, tc.expected_result, tc.status, tc.priority,
      tc.deadline ? String(tc.deadline).slice(0, 10) : '',
      (tc.assignees || []).map(a => a.name).join(', '),
      tc.item_code ? `[${tc.item_code}] ${tc.item_title || ''}` : '',
      featureText(tc),
      tc.product_code || tc.product_name || '',
      tc.created_by_name || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_cases_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (importInputRef.current) importInputRef.current.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { toast.error('Hanya file .csv yang diterima'); return; }

    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await client.post('/import/qa-test-cases', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Import selesai: ${res.data.created} test case dibuat`);
      setModal({ open: true, type: 'import-result', data: res.data });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengimport CSV');
    } finally {
      setImporting(false);
    }
  };

  const summary = dashboard?.summary || {};

  const filteredCases   = assigneeFilter.length
    ? testCases.filter(tc => (tc.assignees || []).some(a => assigneeFilter.includes(a.id)))
    : testCases;
  const totalPagesCases = Math.max(1, Math.ceil(filteredCases.length / perPageCases));
  const pagedCases      = filteredCases.slice((pageCases - 1) * perPageCases, pageCases * perPageCases);
  const totalPagesRuns  = Math.max(1, Math.ceil(testRuns.length / perPageRuns));
  const pagedRuns       = testRuns.slice((pageRuns - 1) * perPageRuns, pageRuns * perPageRuns);
  // Test runs carry only test_case_id; both lists load with the same product filter, so every run's case is here
  const itemIdByCase    = new Map(testCases.map(t => [t.id, t.backlog_item_id]));

  // Opens a test case's form from another row (a test run, a recent failure). Same rule as the ?case= deep link:
  // only with qa.update. A case outside the current product filter (Recent Failures is not filtered) is looked up in
  // the unfiltered list.
  const canOpenCase = can('qa', 'update');
  const openCaseById = (id) => {
    const found = testCases.find(t => t.id === id);
    if (found) { setModal({ open: true, type: 'tc', data: found }); return; }
    client.get('/qa/test-cases').then(r => {
      const f = r.data.find(t => t.id === id);
      if (f) setModal({ open: true, type: 'tc', data: f });
      else toast.error('Test case tidak ditemukan');
    }).catch(() => {});
  };

  // Data can shrink under the current page (product filter, reload): never sit on an empty page past the end
  useEffect(() => { if (pageCases > totalPagesCases) setPageCases(totalPagesCases); }, [pageCases, totalPagesCases]);
  useEffect(() => { if (pageRuns > totalPagesRuns) setPageRuns(totalPagesRuns); }, [pageRuns, totalPagesRuns]);

  const handlePerPageCases = (v) => { setPerPageCases(v); setPageCases(1); };
  const handlePerPageRuns  = (v) => { setPerPageRuns(v);  setPageRuns(1);  };

  // Colour travels with each slice: zero slices are filtered out, so colouring by index would shift hues
  const passPieData = [
    { name: 'Pass',    value: +summary.pass_count    || 0, color: '#1F9D55' },
    { name: 'Fail',    value: +summary.fail_count    || 0, color: '#E5484D' },
    { name: 'Blocked', value: +summary.blocked_count || 0, color: '#D9891A' },
    { name: 'Pending', value: +summary.pending_count || 0, color: '#9AA0A9' },
  ].filter(d => d.value > 0);

  // Test results per sprint, one group per product (rows arrive ordered by product, then sprint date).
  // Small multiples share one Y scale so products can be compared at a glance.
  const sprintRows   = dashboard?.bySprint || [];
  const sprintGroups = [];
  sprintRows.forEach(r => {
    const last = sprintGroups[sprintGroups.length - 1];
    if (last && last[0].product_id === r.product_id) last.push(r); else sprintGroups.push([r]);
  });
  const bugOverviewAllowed = !!dashboard?.bugOverviewAllowed;
  const sprintYMax =Math.max(1, ...sprintRows.flatMap(r => RESULT_LINES.map(l => +r[l.key] || 0)));

  return (
    <div className="space-y-5">
      {/* Tabs + Filter */}
      <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 pb-0">
        <div className="flex gap-2">
          {[['dashboard','QA Dashboard'],['cases','Test Cases'],['runs','Test Runs']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === id ? 'border-indigo-600 text-slate-800 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto pb-2">
          <select className="select w-auto min-w-[160px]" value={filters.product_id} onChange={e => changeProduct(e.target.value)}>
            <option value="">Semua Produk</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading
        ? <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
        : (
        <>
          {/* DASHBOARD TAB */}
          {tab === 'dashboard' && (
            <div className="space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Test Cases', value: summary.total_cases, cls: 'bg-slate-100 text-slate-700' },
                  { label: 'Total Runs',        value: summary.total_runs,  cls: 'bg-blue-50 text-blue-600' },
                  { label: 'Pass Rate',         value: `${summary.pass_rate || 0}%`, cls: 'bg-emerald-50 text-emerald-600' },
                  { label: 'Failed',            value: summary.fail_count,  cls: 'bg-red-50 text-red-600' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="card p-4">
                    <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Pass/Fail by Sprint: one trend per product (small multiples), or a single chart when filtered */}
                {sprintGroups.length > 1 ? (
                  <div className="card p-5 lg:col-span-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
                      <h3 className="font-semibold text-slate-700">Test Results per Sprint</h3>
                      <span className="text-xs text-slate-400">per produk · maks 6 sprint terakhir</span>
                      <div className="flex items-center gap-3 ml-auto text-xs text-slate-600">
                        {RESULT_LINES.map(l => (
                          <span key={l.key} className="inline-flex items-center gap-1.5">
                            <i className="w-3 h-0.5 rounded" style={{ background: l.color }} />{l.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
                      {sprintGroups.map(rows => (
                        <div key={rows[0].product_id} className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700 mb-1 pl-1">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: rows[0].product_color || '#9A9CA4' }} />
                            <span className="truncate">{rows[0].product_name}</span>
                          </p>
                          <SprintTrend rows={rows} ct={ct} yMax={sprintYMax} height={170} compact />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="card p-5">
                    <h3 className="font-semibold text-slate-700 mb-4">
                      Test Results per Sprint{sprintGroups[0] ? <span className="font-normal text-slate-400"> · {sprintGroups[0][0].product_name}</span> : null}
                    </h3>
                    {sprintGroups.length
                      ? <SprintTrend rows={sprintGroups[0]} ct={ct} yMax={sprintYMax} height={240} />
                      : <p className="text-center py-16 text-sm text-slate-400">Belum ada sprint</p>}
                  </div>
                )}

                {/* Pie + Bugs per Feature. All products (sprint charts take the full row): both stack in the
                    left column, beside Recent Failures, so the card fills the slot under the pie instead of
                    sitting below a long failures list. One product: the wrapper is `display: contents`, so
                    the pie sits beside the sprint chart and Bugs per Feature beside Recent Failures. */}
                <div className={sprintGroups.length > 1 ? 'min-w-0 space-y-5' : 'contents'}>
                  {/* Distribution Pie */}
                  <div className="card p-5">
                    <h3 className="font-semibold text-slate-700 mb-4">Overall Result Distribution</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={passPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                          {passPieData.map(d => <Cell key={d.name} fill={d.color} />)}
                        </Pie>
                        <Tooltip {...ct.tooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bugs per product feature (only for roles the API returns it to) */}
                  {bugOverviewAllowed && <BugsPerFeatureCard rows={dashboard?.bugsByFeature || []} stages={dashboard?.bugStages || []} className="min-w-0 lg:self-start" />}
                </div>

              {/* Recent Failures: right column; full width only when one product is shown and there is no bug card */}
              <div className={`card overflow-hidden ${sprintGroups.length > 1 || bugOverviewAllowed ? '' : 'lg:col-span-2'}`}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-slate-700">Recent Failures</h3>
                  <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{dashboard?.recentFails?.length || 0}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {dashboard?.recentFails?.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">Tidak ada kegagalan terkini</p>}
                  {dashboard?.recentFails?.map(run => (
                    <div key={run.id} className="px-5 py-3 flex items-start gap-3">
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {/* test_case_id / backlog_item_id come with the API from this version on; without them it stays plain text */}
                        {canOpenCase && run.test_case_id ? (
                          <button type="button" onClick={() => openCaseById(run.test_case_id)} title={`Buka test case ${run.tc_code}`}
                            className="text-left text-sm font-medium text-slate-700 hover:underline hover:text-indigo-600 underline-offset-2">
                            {run.tc_title}
                          </button>
                        ) : <p className="text-sm font-medium text-slate-700">{run.tc_title}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">
                          [{run.tc_code}]{' '}
                          {run.backlog_item_id
                            ? <Link to={`/backlog?item=${run.backlog_item_id}`} title={`Buka ${run.item_code} di Backlog`}
                                className="font-mono text-indigo-600 hover:underline underline-offset-2">{run.item_code}</Link>
                            : run.item_code}
                          {' '}· {run.product} · Tester: {run.tester}
                        </p>
                        {run.notes && <p className="text-xs text-red-600 mt-1 italic">{run.notes}</p>}
                        {run.bug_reference && <p className="text-xs text-orange-600 mt-0.5">Bug Ref: {run.bug_reference}</p>}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{run.executed_at ? format(parseISO(run.executed_at), 'dd MMM HH:mm') : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </div>
          )}

          {/* TEST CASES TAB */}
          {tab === 'cases' && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-end gap-2">
                <div className="mr-auto">
                  <SearchableMultiSelect label="Assignee" minWidth={180}
                    options={users.map(u => ({ v: u.id, l: u.name }))}
                    selected={assigneeFilter}
                    searchPlaceholder="Cari nama assignee..."
                    onChange={vals => { setAssigneeFilter(vals); setPageCases(1); }} />
                </div>
                {can('qa', 'create') && (
                  <>
                    <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                    <button className="btn-secondary" onClick={() => importInputRef.current?.click()} disabled={importing}>
                      {importing
                        ? <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        : <Upload className="w-4 h-4" />}
                      Import CSV
                    </button>
                  </>
                )}
                <button className="btn-secondary" onClick={exportTestCasesCSV} disabled={filteredCases.length === 0}>
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                {can('qa', 'create') && (
                  <button className="btn-primary" onClick={() => setModal({ open: true, type: 'tc', data: null })}>
                    <Plus className="w-4 h-4" /> Buat Test Case
                  </button>
                )}
              </div>
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-xs text-slate-500">
                    {filteredCases.length} test case{assigneeFilter.length > 0 && ` (dari ${testCases.length})`}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    Tampilkan
                    <select className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs"
                      value={perPageCases} onChange={e => handlePerPageCases(+e.target.value)}>
                      {[10, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    baris
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1800px] text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap">
                        <th className="text-left px-4 py-3">Kode</th>
                        <th className="text-left px-4 py-3">Judul</th>
                        <th className="text-left px-3 py-3">Item</th>
                        <th className="text-left px-3 py-3">Features</th>
                        <th className="text-center px-3 py-3">Prioritas</th>
                        <th className="text-center px-3 py-3">Status</th>
                        <th className="text-left px-3 py-3">Deadline</th>
                        <th className="text-left px-3 py-3">Assigned To</th>
                        <th className="text-left px-3 py-3" title="Dihitung otomatis dari hasil test run terakhir">Progress</th>
                        <th className="text-center px-3 py-3">Runs</th>
                        <th className="text-center px-3 py-3">Pass</th>
                        <th className="text-center px-3 py-3">Fail</th>
                        <th className="text-left px-3 py-3">Author</th>
                        <th className="text-left px-3 py-3">Produk</th>
                        <th className="text-center px-3 py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCases.length === 0 && (
                        <tr><td colSpan={15} className="text-center py-10 text-slate-400">
                          {assigneeFilter.length > 0 && testCases.length > 0 ? 'Tidak ada test case untuk assignee yang dipilih' : 'Belum ada test case'}
                        </td></tr>
                      )}
                      {pagedCases.map(tc => (
                        <tr key={tc.id}
                          // Whole row opens the test case (same as the pencil, so only with qa.update); inner controls stop propagation
                          onClick={() => { if (can('qa', 'update') && !window.getSelection?.().toString()) setModal({ open: true, type: 'tc', data: tc }); }}
                          className={`table-row ${can('qa', 'update') ? 'cursor-pointer' : ''}`}>
                          <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono text-xs text-slate-500">{tc.code}</span></td>
                          <td className="px-4 py-3 min-w-[200px] max-w-[260px]">
                            <p className="font-medium text-slate-700 truncate">{tc.title}</p>
                            {tc.description && <p className="text-xs text-slate-400 truncate">{tc.description}</p>}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {tc.item_code
                              ? <RefLink to={tc.backlog_item_id ? `/backlog?item=${tc.backlog_item_id}` : null} tip="Buka di Backlog"
                                  code={tc.item_code} title={tc.item_title} />
                              : '—'}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {tc.feature_code
                              ? <RefLink to={tc.feature_id ? `/products?feature=${tc.feature_id}` : null} tip="Buka feature di Products"
                                  code={tc.feature_code} title={tc.feature_name} className="min-w-[150px] max-w-[220px]" />
                              : '—'}
                          </td>
                          <td className="px-3 py-3 text-center"><PriorityBadge priority={tc.priority} /></td>
                          {/* Click the pill to change the status (qa.update), like Backlog; the menu does not open the row */}
                          <td className="px-3 py-3 text-center">
                            <StatusMenu status={tc.status} statuses={TC_STATUSES} canChange={can('qa', 'update')}
                              onChange={s => changeStatus(tc, s)} />
                          </td>
                          {/* Red once the deadline day is over, unless the test case is In Review or Finish */}
                          <td className="px-3 py-3 text-xs whitespace-nowrap"><DeadlineDate date={tc.deadline} done={TC_NOT_LATE.includes(tc.status)} /></td>
                          <td className="px-3 py-3">
                            {tc.assignees?.length > 0
                              ? <AssigneeStack assignees={tc.assignees} />
                              : <span className="text-xs text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-3"><ProgressBar value={tc.progress} title={caseProgressTitle(tc)} /></td>
                          <td className="px-3 py-3 text-center text-slate-600 font-medium">{tc.run_count}</td>
                          <td className="px-3 py-3 text-center text-emerald-600 font-medium">{tc.pass_count}</td>
                          <td className="px-3 py-3 text-center text-red-600 font-medium">{tc.fail_count}</td>
                          <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{tc.created_by_name || '—'}</td>
                          <td className="px-3 py-3 text-xs text-slate-500">{tc.product_code}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 justify-center" onClick={e => e.stopPropagation()}>
                              {can('qa', 'run') && (
                                <button className="btn-ghost btn-sm p-1.5 rounded-lg text-slate-600 hover:bg-slate-100" title="Run Test"
                                  onClick={() => setModal({ open: true, type: 'run', data: tc })}>
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {can('qa', 'update') && (
                                <button className="btn-ghost btn-sm p-1.5 rounded-lg" onClick={() => setModal({ open: true, type: 'tc', data: tc })}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {can('qa', 'delete') && (
                                <button className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50" onClick={() => deleteTC(tc.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPagesCases > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
                    <span>{(pageCases-1)*perPageCases+1}–{Math.min(pageCases*perPageCases, filteredCases.length)} dari {filteredCases.length}</span>
                    <div className="flex gap-1">
                      <button disabled={pageCases === 1} onClick={() => setPageCases(p => p-1)}
                        className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">‹ Prev</button>
                      <button disabled={pageCases === totalPagesCases} onClick={() => setPageCases(p => p+1)}
                        className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">Next ›</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TEST RUNS TAB */}
          {tab === 'runs' && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">{testRuns.length} test run</span>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  Tampilkan
                  <select className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs"
                    value={perPageRuns} onChange={e => handlePerPageRuns(+e.target.value)}>
                    {[10, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  baris
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap">
                      <th className="text-left px-4 py-3">Test Case</th>
                      <th className="text-left px-3 py-3">Item</th>
                      <th className="text-center px-3 py-3">Hasil</th>
                      <th className="text-left px-3 py-3">Sprint</th>
                      <th className="text-left px-3 py-3">Tester</th>
                      <th className="text-left px-3 py-3">Catatan</th>
                      <th className="text-left px-3 py-3">Bug Ref</th>
                      <th className="text-left px-3 py-3">Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRuns.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-slate-400">Belum ada test run</td></tr>}
                    {pagedRuns.map(run => {
                      const ri = RESULT_ICONS[run.result] || RESULT_ICONS.pending;
                      const Icon = ri.icon;
                      return (
                        <tr key={run.id} className="table-row">
                          <td className="px-4 py-3">
                            {canOpenCase ? (
                              <button type="button" onClick={() => openCaseById(run.test_case_id)} title={`Buka test case ${run.tc_code}`}
                                className="group/tc text-left">
                                <span className="block font-medium text-slate-700 text-xs group-hover/tc:underline group-hover/tc:text-indigo-600 underline-offset-2">{run.tc_title}</span>
                                <span className="block text-xs text-indigo-600 font-mono">{run.tc_code}</span>
                              </button>
                            ) : (
                              <div>
                                <p className="font-medium text-slate-700 text-xs">{run.tc_title}</p>
                                <p className="text-xs text-slate-400 font-mono">{run.tc_code}</p>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {run.item_code
                              ? <RefLink to={itemIdByCase.get(run.test_case_id) ? `/backlog?item=${itemIdByCase.get(run.test_case_id)}` : null}
                                  tip="Buka di Backlog" code={run.item_code} title={run.item_title} codeClass="" />
                              : '—'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1.5 justify-center">
                              <Icon className={`w-4 h-4 ${ri.cls}`} />
                              <StatusBadge status={run.result} />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">{run.sprint_name || '—'}</td>
                          <td className="px-3 py-3 text-xs text-slate-600">{run.tester_name || '—'}</td>
                          <td className="px-3 py-3 text-xs text-slate-500 max-w-[160px] truncate">{run.notes || '—'}</td>
                          <td className="px-3 py-3">
                            {run.bug_reference ? <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-mono">{run.bug_reference}</span> : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-400">
                            {run.executed_at ? format(parseISO(run.executed_at), 'dd MMM HH:mm') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPagesRuns > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>{(pageRuns-1)*perPageRuns+1}–{Math.min(pageRuns*perPageRuns, testRuns.length)} dari {testRuns.length}</span>
                  <div className="flex gap-1">
                    <button disabled={pageRuns === 1} onClick={() => setPageRuns(p => p-1)}
                      className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">‹ Prev</button>
                    <button disabled={pageRuns === totalPagesRuns} onClick={() => setPageRuns(p => p+1)}
                      className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">Next ›</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <Modal open={modal.open && modal.type === 'tc'} onClose={() => setModal({ ...modal, open: false })}
        title={modal.data ? 'Edit Test Case' : 'Buat Test Case'} size="lg"
        shareLink={modal.data ? `/qa?case=${modal.data.id}` : undefined}>
        <TestCaseForm key={modal.data?.id ?? 'new'} tc={modal.data} products={products} backlogItems={backlogItems} features={features} users={users}
          onSave={() => { setModal({ ...modal, open: false }); load(); }}
          onClose={() => setModal({ ...modal, open: false })} />
      </Modal>

      <Modal open={modal.open && modal.type === 'run'} onClose={() => setModal({ ...modal, open: false })}
        title="Jalankan Test" size="sm">
        {modal.data && <TestRunForm tc={modal.data} sprints={sprints}
          onSave={() => { setModal({ ...modal, open: false }); load(); }}
          onClose={() => setModal({ ...modal, open: false })} />}
      </Modal>

      <Modal open={modal.open && modal.type === 'import-result'} onClose={() => setModal({ ...modal, open: false })}
        title="Hasil Import Test Case" size="sm">
        {modal.data && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-emerald-50 p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-700">{modal.data.created}</p>
                <p className="text-xs text-emerald-600">Test case dibuat</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">{modal.data.skipped}</p>
                <p className="text-xs text-amber-600">Di-skip</p>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-700">{modal.data.errors?.length || 0}</p>
                <p className="text-xs text-red-600">Error</p>
              </div>
            </div>
            {modal.data.errors?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700">Detail Error:</p>
                {modal.data.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">• {e}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button className="btn-secondary" onClick={() => setModal({ ...modal, open: false })}>Tutup</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
