import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Plus, Calendar, Target, Layers, ChevronDown, ChevronUp, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO, differenceInDays } from 'date-fns';

const KANBAN_COLS = [
  { id: 'todo',        label: 'To Do',       cls: 'border-t-slate-400' },
  { id: 'in_progress', label: 'In Progress', cls: 'border-t-blue-500'  },
  { id: 'in_review',   label: 'In Review',   cls: 'border-t-amber-500' },
  { id: 'done',        label: 'Done',        cls: 'border-t-emerald-500'},
  { id: 'blocked',     label: 'Blocked',     cls: 'border-t-red-500'   },
];

function SprintForm({ sprint, productId, onSave, onClose }) {
  const [form, setForm] = useState({
    product_id: sprint?.product_id || productId || '',
    name: sprint?.name || '', goal: sprint?.goal || '',
    start_date: sprint?.start_date?.split('T')[0] || '',
    end_date: sprint?.end_date?.split('T')[0] || '',
    capacity: sprint?.capacity || 22, status: sprint?.status || 'planned',
    committed_points: sprint?.committed_points || 0,
    completed_points: sprint?.completed_points || 0,
  });
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  useEffect(() => { client.get('/products').then(r => setProducts(r.data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (sprint?.id) {
        await client.put(`/sprints/${sprint.id}`, form);
        toast.success('Sprint diperbarui');
      } else {
        await client.post('/sprints', form);
        toast.success('Sprint dibuat');
      }
      onSave();
    } catch {} finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4">
      <div>
        <label className="label">Produk *</label>
        <select className="select" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} required>
          <option value="">Pilih produk</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Nama Sprint *</label>
        <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sprint 1" required />
      </div>
      <div className="col-span-2">
        <label className="label">Sprint Goal</label>
        <input className="input" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} placeholder="Tujuan sprint..." />
      </div>
      <div>
        <label className="label">Tanggal Mulai</label>
        <input type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
      </div>
      <div>
        <label className="label">Tanggal Selesai</label>
        <input type="date" className="input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
      </div>
      <div>
        <label className="label">Kapasitas (pts)</label>
        <input type="number" className="input" min="0" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))} />
      </div>
      <div>
        <label className="label">Status</label>
        <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          {['planned','active','completed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {sprint?.id && (
        <>
          <div>
            <label className="label">Committed Points</label>
            <input type="number" className="input" min="0" value={form.committed_points} onChange={e => setForm(f => ({ ...f, committed_points: +e.target.value }))} />
          </div>
          <div>
            <label className="label">Completed Points</label>
            <input type="number" className="input" min="0" value={form.completed_points} onChange={e => setForm(f => ({ ...f, completed_points: +e.target.value }))} />
          </div>
        </>
      )}
      <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : (sprint?.id ? 'Perbarui' : 'Buat Sprint')}</button>
      </div>
    </form>
  );
}

export default function Sprints() {
  const { hasRole } = useAuth();
  const [products,  setProducts]  = useState([]);
  const [selProduct, setSelProduct] = useState('');
  const [sprints,   setSprints]   = useState([]);
  const [selSprint, setSelSprint] = useState(null);
  const [sprintDetail, setSprintDetail] = useState(null);
  const [burndown,  setBurndown]  = useState([]);
  const [epics,     setEpics]     = useState([]);
  const [expanded,  setExpanded]  = useState({});
  const [modal,        setModal]        = useState({ open: false, sprint: null });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // sprint object
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    client.get('/products').then(r => {
      setProducts(r.data);
      const active = r.data.find(p => p.active_sprints > 0) || r.data[0];
      if (active) setSelProduct(String(active.id));
    });
  }, []);

  useEffect(() => {
    if (!selProduct) return;
    client.get('/sprints', { params: { product_id: selProduct } }).then(r => {
      setSprints(r.data);
      const active = r.data.find(s => s.status === 'active') || r.data[0];
      if (active) setSelSprint(active);
    });
    client.get('/epics', { params: { product_id: selProduct } }).then(r => setEpics(r.data));
  }, [selProduct]);

  useEffect(() => {
    if (!selSprint) return;
    setLoading(true);
    Promise.all([
      client.get(`/sprints/${selSprint.id}`),
      client.get(`/sprints/${selSprint.id}/burndown`),
    ]).then(([d, b]) => {
      setSprintDetail(d.data);
      setBurndown(b.data);
    }).finally(() => setLoading(false));
  }, [selSprint]);

  const reloadSprints = async () => {
    const r = await client.get('/sprints', { params: { product_id: selProduct } });
    setSprints(r.data);
  };

  const deleteSprint = async (sprint) => {
    try {
      await client.delete(`/sprints/${sprint.id}`);
      toast.success(`Sprint "${sprint.name}" berhasil dihapus`);
      setDeleteConfirm(null);
      if (selSprint?.id === sprint.id) setSelSprint(null);
      reloadSprints();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menghapus sprint');
    }
  };

  const pct = selSprint ? Math.round((selSprint.completed_points / (selSprint.committed_points || 1)) * 100) : 0;

  const TYPE_COLORS = { story: 'bg-blue-50 text-blue-700', bug: 'bg-red-50 text-red-700', task: 'bg-slate-50 text-slate-600', epic: 'bg-purple-50 text-purple-700' };

  return (
    <div className="space-y-5">
      {/* Top controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className="select w-auto min-w-[180px]" value={selProduct} onChange={e => setSelProduct(e.target.value)}>
          <option value="">Pilih Produk</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex gap-2 flex-wrap">
          {sprints.map(s => (
            <button key={s.id} onClick={() => setSelSprint(s)}
              className={`btn btn-sm border rounded-lg px-3 py-1.5 text-xs font-medium transition-all
                ${selSprint?.id === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {s.name}
              {s.status === 'active' && <span className="ml-1 w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />}
            </button>
          ))}
        </div>
        {hasRole('super_admin','manager','po') && (
          <button className="btn-primary btn-sm ml-auto" onClick={() => setModal({ open: true, sprint: null })}>
            <Plus className="w-3.5 h-3.5" /> Sprint Baru
          </button>
        )}
      </div>

      {selSprint && (
        <>
          {/* Sprint Header */}
          <div className="card p-5">
            <div className="flex flex-wrap gap-6 items-start">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-800">{selSprint.name}</h2>
                  <StatusBadge status={selSprint.status} />
                  {hasRole('super_admin','manager','po') && (
                    <>
                      <button className="btn-ghost btn-sm p-1 rounded" title="Edit Sprint"
                        onClick={() => setModal({ open: true, sprint: selSprint })}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="btn-ghost btn-sm p-1 rounded text-red-500 hover:bg-red-50" title="Hapus Sprint"
                        onClick={() => setDeleteConfirm(selSprint)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
                {selSprint.goal && <p className="text-sm text-slate-500 mt-1">{selSprint.goal}</p>}
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                {selSprint.start_date && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{format(parseISO(selSprint.start_date), 'dd MMM')} — {format(parseISO(selSprint.end_date), 'dd MMM yyyy')}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600">
                  <Target className="w-4 h-4 text-slate-400" />
                  <span>{selSprint.committed_points} pts committed · {selSprint.completed_points} done</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>Capacity {selSprint.capacity} pts</span>
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span><span>{pct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {loading
            ? <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
            : (
            <>
              {/* Kanban Board */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {KANBAN_COLS.map(col => {
                  const colItems = (sprintDetail?.items || []).filter(i => i.status === col.id);
                  return (
                    <div key={col.id} className={`card p-0 border-t-4 ${col.cls}`}>
                      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{col.label}</span>
                        <span className="text-xs text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded-full">{colItems.length}</span>
                      </div>
                      <div className="p-2 space-y-2 min-h-[120px]">
                        {colItems.map(item => (
                          <div key={item.id} className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <span className="text-xs text-slate-400 font-mono">{item.code}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[item.type] || ''}`}>{item.type}</span>
                            </div>
                            <p className="text-xs font-medium text-slate-700 leading-snug mb-2 line-clamp-2">{item.title}</p>
                            <div className="flex items-center justify-between">
                              {item.assignee_name
                                ? <div className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                                    style={{ backgroundColor: item.assignee_color || '#6366f1' }}>
                                    {item.assignee_name.charAt(0)}
                                  </div>
                                : <span />}
                              <span className="text-xs font-semibold text-slate-400">{item.story_points}pt</span>
                            </div>
                          </div>
                        ))}
                        {colItems.length === 0 && <p className="text-xs text-slate-300 text-center py-4">—</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Burndown Chart */}
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-700 mb-4">Burndown Chart — {selSprint.name}</h3>
                  {burndown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={burndown} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" label={{ value: 'Hari', position: 'insideBottom', offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="ideal_remaining"  name="Ideal"  stroke="#94a3b8" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="actual_remaining" name="Actual" stroke="#4f46e5" dot={{ r: 4, fill: '#4f46e5' }} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center py-10 text-slate-400 text-sm">Belum ada data burndown</p>}
                </div>

                {/* Epics */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-700">Epic Overview</h3>
                  </div>
                  <div className="divide-y divide-slate-50 overflow-y-auto max-h-[270px]">
                    {epics.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">Belum ada epic</p>}
                    {epics.map(epic => {
                      const pct = epic.total_points > 0 ? Math.round((epic.done_points / epic.total_points) * 100) : 0;
                      return (
                        <div key={epic.id} className="px-5 py-3">
                          <button className="w-full flex items-center justify-between" onClick={() => setExpanded(e => ({ ...e, [epic.id]: !e[epic.id] }))}>
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs text-slate-400 font-mono shrink-0">{epic.code}</span>
                              <span className="font-medium text-slate-700 text-sm truncate">{epic.name}</span>
                              <StatusBadge status={epic.status} size="xs" />
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-slate-400">{epic.done_points}/{epic.total_points}pts</span>
                              {expanded[epic.id] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                          </button>
                          <div className="mt-2">
                            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          {expanded[epic.id] && (
                            <div className="mt-2 pl-6 space-y-1">
                              {(sprintDetail?.items || []).filter(i => i.epic_name === epic.name).map(item => (
                                <div key={item.id} className="flex items-center gap-2 text-xs text-slate-500">
                                  <span className="font-mono text-slate-400">{item.code}</span>
                                  <span className="truncate">{item.title}</span>
                                  <StatusBadge status={item.status} size="xs" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {!selProduct && (
        <div className="card flex items-center justify-center h-48 text-slate-400">Pilih produk untuk melihat sprint</div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false, sprint: null })}
        title={modal.sprint ? 'Edit Sprint' : 'Buat Sprint Baru'} size="md">
        <SprintForm sprint={modal.sprint} productId={selProduct}
          onSave={() => { setModal({ open: false, sprint: null }); reloadSprints(); }}
          onClose={() => setModal({ open: false, sprint: null })} />
      </Modal>

      {/* ── Konfirmasi Hapus Sprint ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Hapus Sprint</p>
                <p className="text-sm text-slate-500">Tindakan ini tidak bisa dibatalkan</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 text-sm text-red-700 space-y-1">
              <p>Sprint <strong>{deleteConfirm.name}</strong> akan dihapus beserta:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                <li>Semua data burndown sprint ini</li>
                <li>Backlog item dalam sprint akan menjadi <em>unassigned dari sprint</em></li>
              </ul>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Batal</button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                onClick={() => deleteSprint(deleteConfirm)}>
                Ya, Hapus Sprint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
