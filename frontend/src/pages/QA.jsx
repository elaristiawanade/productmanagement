import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Plus, Pencil, Trash2, Play, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import SearchableSelect from '../components/SearchableSelect';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

const RESULT_ICONS = {
  pass:    { icon: CheckCircle2, cls: 'text-emerald-500' },
  fail:    { icon: XCircle,      cls: 'text-red-500'     },
  blocked: { icon: AlertCircle,  cls: 'text-orange-500'  },
  pending: { icon: Clock,        cls: 'text-slate-400'   },
  skip:    { icon: Clock,        cls: 'text-slate-300'   },
};

function TestCaseForm({ tc, products, backlogItems, onSave, onClose }) {
  const [form, setForm] = useState({
    product_id: tc?.product_id || '', backlog_item_id: tc?.backlog_item_id || '',
    title: tc?.title || '', description: tc?.description || '',
    steps: tc?.steps || '', expected_result: tc?.expected_result || '',
    status: tc?.status || 'draft', priority: tc?.priority || 'medium',
  });
  const [saving, setSaving] = useState(false);
  const filteredItems = backlogItems.filter(b => !form.product_id || b.product_id === +form.product_id);

  const save = async (e) => {
    e.preventDefault();
    if (!form.backlog_item_id) { toast.error('Backlog Item wajib dipilih'); return; }
    setSaving(true);
    try {
      if (tc?.id) { await client.put(`/qa/test-cases/${tc.id}`, form); toast.success('Test case diperbarui'); }
      else        { await client.post('/qa/test-cases', form);          toast.success('Test case dibuat'); }
      onSave();
    } catch {} finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4">
      <div>
        <label className="label">Produk *</label>
        <select className="select" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value, backlog_item_id: '' }))} required>
          <option value="">Pilih produk</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Backlog Item *</label>
        <SearchableSelect
          value={form.backlog_item_id}
          onChange={v => setForm(f => ({ ...f, backlog_item_id: v }))}
          options={filteredItems.map(b => ({ value: String(b.id), label: `[${b.code}] ${b.title}` }))}
          placeholder="Pilih item"
          searchPlaceholder="Cari backlog item..."
        />
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
          {['draft','active','deprecated'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Prioritas</label>
        <select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
          {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
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
                ${form.result === r ? 'ring-2 ring-indigo-400 border-indigo-400' : 'border-slate-200 hover:bg-slate-50'}`}>
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
  const { hasRole } = useAuth();
  const [tab,          setTab]         = useState('dashboard');
  const [products,     setProducts]    = useState([]);
  const [testCases,    setTestCases]   = useState([]);
  const [testRuns,     setTestRuns]    = useState([]);
  const [backlogItems, setBacklogItems] = useState([]);
  const [sprints,      setSprints]     = useState([]);
  const [dashboard,    setDashboard]   = useState(null);
  const [filters,      setFilters]     = useState({ product_id: '' });
  const [modal,        setModal]       = useState({ open: false, type: '', data: null });
  const [loading,      setLoading]     = useState(true);
  const [perPageCases, setPerPageCases] = useState(10);
  const [pageCases,    setPageCases]   = useState(1);
  const [perPageRuns,  setPerPageRuns] = useState(10);
  const [pageRuns,     setPageRuns]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filters.product_id ? { product_id: filters.product_id } : {};
      const [pr, tc, tr, bl, sp, db] = await Promise.all([
        products.length ? null : client.get('/products'),
        client.get('/qa/test-cases', { params }),
        client.get('/qa/test-runs',  { params }),
        backlogItems.length ? null : client.get('/backlog', { params: { limit: 500 } }),
        sprints.length ? null : client.get('/sprints'),
        client.get('/qa/dashboard',  { params }),
      ]);
      if (pr) setProducts(pr.data);
      setTestCases(tc.data);
      setTestRuns(tr.data);
      if (bl) setBacklogItems(bl.data.items);
      if (sp) setSprints(sp.data);
      setDashboard(db.data);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const deleteTC = async (id) => {
    if (!confirm('Hapus test case ini?')) return;
    await client.delete(`/qa/test-cases/${id}`);
    toast.success('Test case dihapus'); load();
  };

  const PIE_COLORS = ['#10b981','#ef4444','#f59e0b','#94a3b8','#e2e8f0'];
  const summary = dashboard?.summary || {};

  const totalPagesCases = Math.max(1, Math.ceil(testCases.length / perPageCases));
  const pagedCases      = testCases.slice((pageCases - 1) * perPageCases, pageCases * perPageCases);
  const totalPagesRuns  = Math.max(1, Math.ceil(testRuns.length / perPageRuns));
  const pagedRuns       = testRuns.slice((pageRuns - 1) * perPageRuns, pageRuns * perPageRuns);

  const handlePerPageCases = (v) => { setPerPageCases(v); setPageCases(1); };
  const handlePerPageRuns  = (v) => { setPerPageRuns(v);  setPageRuns(1);  };

  const passPieData = [
    { name: 'Pass',    value: +summary.pass_count    || 0 },
    { name: 'Fail',    value: +summary.fail_count    || 0 },
    { name: 'Blocked', value: +summary.blocked_count || 0 },
    { name: 'Pending', value: +summary.pending_count || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {/* Tabs + Filter */}
      <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 pb-0">
        <div className="flex gap-2">
          {[['dashboard','QA Dashboard'],['cases','Test Cases'],['runs','Test Runs']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto pb-2">
          <select className="select w-auto min-w-[160px]" value={filters.product_id} onChange={e => setFilters(f => ({ ...f, product_id: e.target.value }))}>
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
                  { label: 'Total Test Cases', value: summary.total_cases, cls: 'bg-indigo-50 text-indigo-600' },
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
                {/* Pass/Fail by Sprint */}
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-700 mb-4">Test Results per Sprint</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dashboard?.bySprint || []} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="pass_count"    name="Pass"    fill="#10b981" radius={[4,4,0,0]} />
                      <Bar dataKey="fail_count"    name="Fail"    fill="#ef4444" radius={[4,4,0,0]} />
                      <Bar dataKey="blocked_count" name="Blocked" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Distribution Pie */}
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-700 mb-4">Overall Result Distribution</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={passPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                        {passPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Failures */}
              <div className="card overflow-hidden">
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
                        <p className="text-sm font-medium text-slate-700">{run.tc_title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">[{run.tc_code}] {run.item_code} · {run.product} · Tester: {run.tester}</p>
                        {run.notes && <p className="text-xs text-red-600 mt-1 italic">{run.notes}</p>}
                        {run.bug_reference && <p className="text-xs text-orange-600 mt-0.5">Bug Ref: {run.bug_reference}</p>}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{run.executed_at ? format(parseISO(run.executed_at), 'dd MMM HH:mm') : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TEST CASES TAB */}
          {tab === 'cases' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                {hasRole('super_admin','manager','qa','po') && (
                  <button className="btn-primary" onClick={() => setModal({ open: true, type: 'tc', data: null })}>
                    <Plus className="w-4 h-4" /> Buat Test Case
                  </button>
                )}
              </div>
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-xs text-slate-500">{testCases.length} test case</span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    Tampilkan
                    <select className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs"
                      value={perPageCases} onChange={e => handlePerPageCases(+e.target.value)}>
                      {[10, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    baris
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <th className="text-left px-4 py-3">Kode</th>
                        <th className="text-left px-4 py-3">Judul</th>
                        <th className="text-left px-3 py-3">Item</th>
                        <th className="text-center px-3 py-3">Prioritas</th>
                        <th className="text-center px-3 py-3">Status</th>
                        <th className="text-center px-3 py-3">Runs</th>
                        <th className="text-center px-3 py-3">Pass</th>
                        <th className="text-center px-3 py-3">Fail</th>
                        <th className="text-left px-3 py-3">Produk</th>
                        <th className="text-center px-3 py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCases.length === 0 && <tr><td colSpan={10} className="text-center py-10 text-slate-400">Belum ada test case</td></tr>}
                      {pagedCases.map(tc => (
                        <tr key={tc.id} className="table-row">
                          <td className="px-4 py-3"><span className="font-mono text-xs text-slate-500">{tc.code}</span></td>
                          <td className="px-4 py-3 max-w-[220px]">
                            <p className="font-medium text-slate-700 truncate">{tc.title}</p>
                            {tc.description && <p className="text-xs text-slate-400 truncate">{tc.description}</p>}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            <span className="font-mono text-slate-400">[{tc.item_code}]</span> {tc.item_title?.slice(0,30)}
                          </td>
                          <td className="px-3 py-3 text-center"><PriorityBadge priority={tc.priority} /></td>
                          <td className="px-3 py-3 text-center"><StatusBadge status={tc.status} /></td>
                          <td className="px-3 py-3 text-center text-slate-600 font-medium">{tc.run_count}</td>
                          <td className="px-3 py-3 text-center text-emerald-600 font-medium">{tc.pass_count}</td>
                          <td className="px-3 py-3 text-center text-red-600 font-medium">{tc.fail_count}</td>
                          <td className="px-3 py-3 text-xs text-slate-500">{tc.product_code}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 justify-center">
                              {hasRole('super_admin','manager','qa') && (
                                <button className="btn-ghost btn-sm p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Run Test"
                                  onClick={() => setModal({ open: true, type: 'run', data: tc })}>
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {hasRole('super_admin','manager','qa','po') && (
                                <button className="btn-ghost btn-sm p-1.5 rounded-lg" onClick={() => setModal({ open: true, type: 'tc', data: tc })}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {hasRole('super_admin','qa') && (
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
                    <span>{(pageCases-1)*perPageCases+1}–{Math.min(pageCases*perPageCases, testCases.length)} dari {testCases.length}</span>
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
                    {[10, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  baris
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
                            <div>
                              <p className="font-medium text-slate-700 text-xs">{run.tc_title}</p>
                              <p className="text-xs text-slate-400 font-mono">{run.tc_code}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            <span className="font-mono">[{run.item_code}]</span>
                            <span className="ml-1 text-slate-600 truncate max-w-[120px] inline-block align-bottom">{run.item_title?.slice(0,25)}</span>
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
        title={modal.data ? 'Edit Test Case' : 'Buat Test Case'} size="lg">
        <TestCaseForm tc={modal.data} products={products} backlogItems={backlogItems}
          onSave={() => { setModal({ ...modal, open: false }); load(); }}
          onClose={() => setModal({ ...modal, open: false })} />
      </Modal>

      <Modal open={modal.open && modal.type === 'run'} onClose={() => setModal({ ...modal, open: false })}
        title="Jalankan Test" size="sm">
        {modal.data && <TestRunForm tc={modal.data} sprints={sprints}
          onSave={() => { setModal({ ...modal, open: false }); load(); }}
          onClose={() => setModal({ ...modal, open: false })} />}
      </Modal>
    </div>
  );
}
