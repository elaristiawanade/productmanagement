import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, CheckCircle2, Clock, AlertCircle, ExternalLink,
  X, CheckCheck, Layers, Link2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { useAuth } from '../context/AuthContext';
import { renderWithLinks } from '../utils/linkify';
import toast from 'react-hot-toast';

const STATUSES   = ['backlog','todo','in_progress','in_review','done','blocked'];
const PRIORITIES = ['critical','high','medium','low'];
const TYPES      = ['story','bug','task','epic'];

const TYPE_CLS = {
  story: 'text-blue-600 bg-blue-50',
  bug:   'text-red-600 bg-red-50',
  task:  'text-slate-600 bg-slate-100',
  epic:  'text-purple-600 bg-purple-50',
};

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const STATUS_TABS = [
  { key: 'active',      label: 'Aktif'       },
  { key: 'todo',        label: 'Todo'        },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review',   label: 'In Review'   },
  { key: 'blocked',     label: 'Blocked'     },
  { key: 'done',        label: 'Selesai'     },
  { key: 'all',         label: 'Semua'       },
];

// ─── Task Detail Panel ────────────────────────────────────────────────────────

function TaskPanel({ item, onClose, onStatusChange, onMarkDone }) {
  if (!item) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[440px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${TYPE_CLS[item.type] || ''}`}>{item.type}</span>
              <span className="font-mono text-xs text-slate-400">{item.code}</span>
              <PriorityBadge priority={item.priority} />
            </div>
            <h3 className="font-semibold text-slate-800 text-base leading-snug">{item.title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link to={`/backlog?item=${item.id}`} onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
              title="Edit lengkap di Backlog">
              <ExternalLink className="w-4 h-4" />
            </Link>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Status + quick done */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-1">Status</p>
              <select className="select text-sm"
                value={item.status}
                onChange={e => onStatusChange(item.id, e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
            {item.status !== 'done' && (
              <button
                className="mt-4 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors font-medium"
                onClick={() => onMarkDone(item.id)}>
                <CheckCheck className="w-3.5 h-3.5" /> Tandai Selesai
              </button>
            )}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-1">Produk</p>
              <span className="font-medium" style={{ color: item.product_color }}>{item.product_name}</span>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Sprint</p>
              <span className="text-slate-600">{item.sprint_name || '—'}</span>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Story Points</p>
              <span className="font-semibold text-slate-700">{item.story_points || '—'}</span>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Deadline</p>
              {item.deadline
                ? <span className={`font-medium ${item.is_delayed ? 'text-red-600' : 'text-slate-700'}`}>
                    {format(parseISO(item.deadline), 'dd MMM yyyy')}
                    {item.is_delayed && <span className="text-xs ml-1 text-red-400">(terlambat)</span>}
                  </span>
                : <span className="text-slate-400">—</span>}
            </div>
          </div>

          {/* Parent */}
          {item.parent_code && (
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Parent
              </p>
              <p className="text-sm font-mono text-indigo-600">{item.parent_code}
                {item.parent_title && <span className="font-sans font-normal text-indigo-500 ml-2">{item.parent_title}</span>}
              </p>
            </div>
          )}

          {/* Epic / Feature */}
          {(item.epic_name || item.feature_name) && (
            <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-100">
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3" /> {item.epic_name ? 'Epic' : 'Feature'}
              </p>
              <p className="text-sm text-purple-700">{item.epic_name || item.feature_name}</p>
            </div>
          )}

          {/* Acceptance Criteria */}
          {item.acceptance_criteria && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Acceptance Criteria</p>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                {item.acceptance_criteria}
              </p>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan</p>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                {renderWithLinks(item.notes)}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 shrink-0">
          <Link to={`/backlog?item=${item.id}`} onClick={onClose}
            className="flex items-center justify-center gap-1.5 text-sm text-indigo-600 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /> Edit lengkap di Backlog
          </Link>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyTask() {
  const { user } = useAuth();
  const [items,    setItems]    = useState([]);
  const [sprints,  setSprints]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [panel,    setPanel]    = useState(null);
  const [tab,      setTab]      = useState('active');
  const [search,   setSearch]   = useState('');
  const [fType,    setFType]    = useState('');
  const [fPriority,setFPriority]= useState('');
  const [fSprint,  setFSprint]  = useState('');
  const [perPage,  setPerPage]  = useState(20);
  const [page,     setPage]     = useState(1);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [bl, sp] = await Promise.all([
        client.get('/backlog', { params: { assignee_id: user.id, limit: 500 } }),
        client.get('/sprints'),
      ]);
      // sort: priority asc, deadline asc (nulls last)
      const sorted = (bl.data.items || []).sort((a, b) => {
        const pd = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        if (pd !== 0) return pd;
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
      setItems(sorted);
      setSprints(sp.data || []);
    } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const s = { total: 0, in_progress: 0, overdue: 0, done: 0, blocked: 0, todo: 0, in_review: 0 };
    items.forEach(i => {
      s.total++;
      if (i.status === 'in_progress') s.in_progress++;
      if (i.status === 'done')        s.done++;
      if (i.status === 'blocked')     s.blocked++;
      if (i.status === 'todo')        s.todo++;
      if (i.status === 'in_review')   s.in_review++;
      if (i.is_delayed)               s.overdue++;
    });
    return s;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (tab === 'active' && ['done','backlog'].includes(i.status)) return false;
      if (tab !== 'active' && tab !== 'all' && i.status !== tab)    return false;
      if (fType     && i.type     !== fType)     return false;
      if (fPriority && i.priority !== fPriority) return false;
      if (fSprint   && String(i.sprint_id) !== String(fSprint)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!i.title.toLowerCase().includes(q) && !i.code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, tab, fType, fPriority, fSprint, search]);

  const paged = useMemo(() =>
    filtered.slice((page - 1) * perPage, page * perPage),
  [filtered, page, perPage]);

  const tabCount = useCallback((key) => {
    if (key === 'all')    return items.length;
    if (key === 'active') return items.filter(i => !['done','backlog'].includes(i.status)).length;
    return items.filter(i => i.status === key).length;
  }, [items]);

  const quickStatus = async (id, status) => {
    try {
      await client.patch(`/backlog/${id}/status`, { status });
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      if (panel?.id === id) setPanel(prev => ({ ...prev, status }));
    } catch { toast.error('Gagal mengubah status'); }
  };

  const markDone = async (id) => {
    await quickStatus(id, 'done');
    toast.success('Item ditandai selesai');
    setPanel(null);
  };

  const resetFilters = () => { setFType(''); setFPriority(''); setFSprint(''); setSearch(''); setPage(1); };
  const hasFilter    = fType || fPriority || fSprint || search;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <TaskPanel
        item={panel}
        onClose={() => setPanel(null)}
        onStatusChange={quickStatus}
        onMarkDone={markDone}
      />

      <div className="space-y-5">
        {/* Hero */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shrink-0"
            style={{ backgroundColor: user?.avatarColor || '#6366f1' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">My Tasks</h1>
            <p className="text-sm text-slate-500">Semua tugas yang di-assign ke <strong>{user?.name}</strong></p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Aktif',
              value: stats.total - stats.done - items.filter(i => i.status === 'backlog').length,
              color: 'bg-indigo-50 text-indigo-600',
              icon: Clock,
              action: () => { setTab('active'); setPage(1); }
            },
            {
              label: 'In Progress',
              value: stats.in_progress,
              color: 'bg-blue-50 text-blue-600',
              icon: CheckCircle2,
              action: () => { setTab('in_progress'); setPage(1); }
            },
            {
              label: 'Terlambat',
              value: stats.overdue,
              color: 'bg-red-50 text-red-600',
              icon: AlertCircle,
              action: () => { setTab('active'); setFPriority(''); setPage(1); }
            },
            {
              label: 'Selesai',
              value: stats.done,
              color: 'bg-emerald-50 text-emerald-600',
              icon: CheckCheck,
              action: () => { setTab('done'); setPage(1); }
            },
          ].map(({ label, value, color, icon: Icon, action }) => (
            <button key={label}
              className={`card p-4 flex items-center gap-3 text-left hover:shadow-md hover:ring-1 hover:ring-indigo-100 transition-all cursor-pointer`}
              onClick={action}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button key={t.key}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px
                ${tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setTab(t.key); setPage(1); }}>
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                ${tab === t.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                {tabCount(t.key)}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Cari judul atau kode..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="select w-auto min-w-[110px]" value={fType}
            onChange={e => { setFType(e.target.value); setPage(1); }}>
            <option value="">Semua Tipe</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="select w-auto min-w-[120px]" value={fPriority}
            onChange={e => { setFPriority(e.target.value); setPage(1); }}>
            <option value="">Semua Prioritas</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select w-auto min-w-[140px]" value={fSprint}
            onChange={e => { setFSprint(e.target.value); setPage(1); }}>
            <option value="">Semua Sprint</option>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {hasFilter && (
            <button onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <span>{filtered.length} item</span>
            <select className="select py-1 text-xs w-auto"
              value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}>
              {[10, 20, 50].map(n => <option key={n} value={n}>{n}/hal</option>)}
            </select>
          </div>
        </div>

        {/* Items List */}
        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Tidak ada task ditemukan</p>
              {hasFilter && (
                <button onClick={resetFilters} className="text-xs text-indigo-600 hover:underline mt-1">
                  Hapus filter
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 w-24">Kode</th>
                    <th className="text-left px-4 py-2.5">Judul</th>
                    <th className="text-center px-3 py-2.5 w-20">Tipe</th>
                    <th className="text-center px-3 py-2.5 w-24">Prioritas</th>
                    <th className="text-center px-3 py-2.5 w-32">Status</th>
                    <th className="text-left px-3 py-2.5 w-28">Sprint</th>
                    <th className="text-left px-3 py-2.5 w-24">Deadline</th>
                    <th className="text-center px-3 py-2.5 w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map(item => (
                    <tr key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.is_delayed    ? 'bg-red-50/30' :
                        item.status === 'done' ? 'opacity-60' : ''
                      }`}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-500 font-medium">{item.code}</span>
                        {item.is_delayed && <AlertCircle className="w-3 h-3 text-red-500 inline ml-1" />}
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <button className="text-left group w-full"
                          onClick={() => setPanel(item)}>
                          {(item.parent_code) && (
                            <p className="text-[11px] text-indigo-400 flex items-center gap-1 mb-0.5">
                              <Link2 className="w-2.5 h-2.5" />{item.parent_code}
                            </p>
                          )}
                          <p className={`font-medium truncate group-hover:text-indigo-600 transition-colors
                            ${item.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}
                            title={item.title}>
                            {item.title}
                          </p>
                          {(item.epic_name || item.feature_name || item.product_name) && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {item.product_name}
                              {(item.epic_name || item.feature_name) && ` · ${item.epic_name || item.feature_name}`}
                            </p>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${TYPE_CLS[item.type] || ''}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <select
                          className="text-xs border-0 bg-transparent focus:ring-0 cursor-pointer"
                          value={item.status}
                          onChange={e => quickStatus(item.id, e.target.value)}>
                          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{item.sprint_name || '—'}</td>
                      <td className="px-3 py-3 text-xs">
                        {item.deadline
                          ? <span className={item.is_delayed ? 'text-red-500 font-medium' : 'text-slate-500'}>
                              {format(parseISO(item.deadline), 'dd MMM')}
                            </span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          {item.status !== 'done' && (
                            <button title="Tandai selesai"
                              className="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                              onClick={() => markDone(item.id)}>
                              <CheckCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <Link to={`/backlog?item=${item.id}`}
                            className="p-1 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Buka di Backlog">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {filtered.length > perPage && (
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {(page-1)*perPage+1}–{Math.min(page*perPage, filtered.length)} dari {filtered.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="btn-secondary btn-sm" disabled={page === 1}
                      onClick={() => setPage(p => p-1)}>Prev</button>
                    <span className="text-slate-500">{page} / {Math.ceil(filtered.length/perPage)}</span>
                    <button className="btn-secondary btn-sm" disabled={page >= Math.ceil(filtered.length/perPage)}
                      onClick={() => setPage(p => p+1)}>Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
