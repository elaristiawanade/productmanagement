import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { AlertTriangle, Clock, TrendingUp, CheckCircle2, CircleDot, ShieldAlert, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';

const TYPE_CLS = {
  story: 'text-blue-600 bg-blue-50',
  bug:   'text-red-600 bg-red-50',
  task:  'text-slate-600 bg-slate-100',
  epic:  'text-purple-600 bg-purple-50',
};

const STATUS_SLUG = {
  'To Do':       'todo',
  'In Progress': 'in_progress',
  'In Review':   'in_review',
  'Done':        'done',
  'Blocked':     'blocked',
};

// ─── Drilldown Panel ──────────────────────────────────────────────────────────

function DrilldownPanel({ drill, onClose }) {
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!drill.open) return;
    setItems([]);
    setTotal(0);

    if (drill.preloaded) {
      setItems(drill.preloaded);
      setTotal(drill.preloaded.length);
      return;
    }

    setLoading(true);
    client.get('/backlog', { params: { ...drill.params, limit: 50 } })
      .then(r => { setItems(r.data.items || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [drill]);

  if (!drill.open) return null;

  const backlogQuery = drill.params ? new URLSearchParams(
    Object.fromEntries(Object.entries(drill.params).filter(([,v]) => v != null && v !== ''))
  ).toString() : '';

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[460px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-semibold text-slate-800">{drill.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{total} item</p>
          </div>
          <div className="flex items-center gap-2">
            {backlogQuery && (
              <Link to={`/backlog?${backlogQuery}`} onClick={onClose}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                <ExternalLink className="w-3 h-3" /> Buka di Backlog
              </Link>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center py-12 text-slate-400 text-sm">Tidak ada item</p>
          ) : (
            items.map(item => (
              <div key={item.id} className="px-5 py-3 hover:bg-slate-50">
                <div className="flex items-start gap-2.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${TYPE_CLS[item.type] || ''}`}>
                    {item.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="font-mono text-[11px] text-slate-400">{item.code}</span>
                      <StatusBadge status={item.status} />
                      <PriorityBadge priority={item.priority} />
                    </div>
                    <p className="text-sm text-slate-700 truncate font-medium">{item.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <span style={{ color: item.product_color }}>{item.product_name}</span>
                      {item.assignee_name && <> · {item.assignee_name}</>}
                      {item.sprint_name   && <> · {item.sprint_name}</>}
                      {item.deadline      && <> · {format(parseISO(item.deadline), 'dd MMM yyyy')}</>}
                      {item.is_delayed    && <span className="text-red-500 ml-1">· terlambat</span>}
                    </p>
                  </div>
                  <Link to={`/backlog?item=${item.id}`} onClick={onClose}
                    className="text-slate-300 hover:text-indigo-600 shrink-0 mt-1 transition-colors" title="Buka item">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {total > 50 && (
          <div className="px-5 py-3 border-t border-slate-100 shrink-0 text-center">
            <p className="text-xs text-slate-400">Menampilkan 50 dari {total} item.</p>
            {backlogQuery && (
              <Link to={`/backlog?${backlogQuery}`} onClick={onClose}
                className="text-xs text-indigo-600 hover:underline">
                Lihat semua di Backlog →
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub, onClick }) {
  return (
    <div
      className={`card p-5 flex items-start gap-4 transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md hover:ring-1 hover:ring-indigo-100' : ''}`}
      onClick={onClick}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {onClick && <ExternalLink className="w-3.5 h-3.5 text-slate-300 ml-auto mt-1 shrink-0" />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats,      setStats]      = useState(null);
  const [velocity,   setVelocity]   = useState([]);
  const [workload,   setWorkload]   = useState([]);
  const [delayed,    setDelayed]    = useState([]);
  const [occupation, setOccupation] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [drill,      setDrill]      = useState({ open: false, title: '', params: null, preloaded: null });

  useEffect(() => {
    Promise.all([
      client.get('/dashboard/stats'),
      client.get('/dashboard/velocity'),
      client.get('/dashboard/workload'),
      client.get('/dashboard/delayed'),
      client.get('/dashboard/occupation'),
    ]).then(([s, v, w, d, o]) => {
      setStats(s.data);
      setVelocity(v.data);
      setWorkload(w.data);
      setDelayed(d.data);
      setOccupation(o.data);
    }).finally(() => setLoading(false));
  }, []);

  const openDrill     = useCallback((title, params)     => setDrill({ open: true, title, params, preloaded: null }),   []);
  const openPreloaded = useCallback((title, preloaded)  => setDrill({ open: true, title, params: null, preloaded }),   []);
  const closeDrill    = useCallback(()                  => setDrill(d => ({ ...d, open: false })),                     []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const totals = stats?.totals || {};

  const statusData = stats?.products?.reduce((acc, p) => {
    const add = (key, val) => { const e = acc.find(x => x.name === key); e ? e.value += +val : acc.push({ name: key, value: +val }); return acc; };
    add('To Do',       p.todo);
    add('In Progress', p.in_progress);
    add('In Review',   p.in_review);
    add('Done',        p.done);
    add('Blocked',     p.blocked);
    return acc;
  }, []) || [];

  const PIE_COLORS = ['#94a3b8','#3b82f6','#f59e0b','#10b981','#ef4444'];

  const handleVelocityClick = (data) => {
    const entry = data?.activePayload?.[0]?.payload;
    if (!entry) return;
    openDrill(`Sprint: ${entry.sprint} — ${entry.product}`, { sprint_id: entry.sprint_id });
  };

  const handlePieClick = (entry) => {
    const slug = STATUS_SLUG[entry?.name];
    if (!slug) return;
    openDrill(`Status: ${entry.name}`, { status: slug });
  };

  return (
    <>
      <DrilldownPanel drill={drill} onClose={closeDrill} />

      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Items"  value={totals.total_items} icon={CircleDot}    color="bg-indigo-50 text-indigo-600"
            onClick={() => openDrill('Semua Item Aktif', { status: 'todo,in_progress,in_review,blocked' })} />
          <StatCard label="In Progress"  value={totals.in_progress} icon={TrendingUp}   color="bg-blue-50 text-blue-600"
            onClick={() => openDrill('In Progress', { status: 'in_progress' })} />
          <StatCard label="Blocked"      value={totals.blocked}     icon={ShieldAlert}  color="bg-red-50 text-red-600"
            onClick={() => openDrill('Blocked', { status: 'blocked' })} />
          <StatCard label="Delayed"      value={totals.delayed}     icon={AlertTriangle} color="bg-amber-50 text-amber-600"
            onClick={() => openPreloaded('Items Terlambat', delayed)} />
        </div>

        {/* Per-Product Table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Cross-Project Overview</h2>
            <p className="text-xs text-slate-400 mt-0.5">Klik baris untuk melihat backlog item produk</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-center px-4 py-3">Total</th>
                  <th className="text-center px-4 py-3">To Do</th>
                  <th className="text-center px-4 py-3">In Progress</th>
                  <th className="text-center px-4 py-3">In Review</th>
                  <th className="text-center px-4 py-3">Done</th>
                  <th className="text-center px-4 py-3">Blocked</th>
                  <th className="text-center px-4 py-3">Delayed</th>
                  <th className="text-center px-4 py-3">Progress</th>
                  <th className="text-left px-4 py-3">Active Sprint</th>
                </tr>
              </thead>
              <tbody>
                {stats?.products?.map(p => {
                  const pct = p.total_points > 0 ? Math.round((p.done_points / p.total_points) * 100) : 0;
                  return (
                    <tr key={p.id} className="table-row cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => openDrill(`Produk: ${p.name}`, { product_id: p.id })}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <div>
                            <p className="font-medium text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.code} · {p.owner_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-4 py-3 font-semibold">{p.total_items}</td>
                      <td className="text-center px-4 py-3 text-slate-500"
                        onClick={e => { e.stopPropagation(); openDrill(`${p.name} — To Do`, { product_id: p.id, status: 'todo' }); }}>
                        <span className="hover:text-blue-600 hover:underline cursor-pointer">{p.todo}</span>
                      </td>
                      <td className="text-center px-4 py-3 text-blue-600"
                        onClick={e => { e.stopPropagation(); openDrill(`${p.name} — In Progress`, { product_id: p.id, status: 'in_progress' }); }}>
                        <span className="hover:underline cursor-pointer">{p.in_progress}</span>
                      </td>
                      <td className="text-center px-4 py-3 text-amber-600"
                        onClick={e => { e.stopPropagation(); openDrill(`${p.name} — In Review`, { product_id: p.id, status: 'in_review' }); }}>
                        <span className="hover:underline cursor-pointer">{p.in_review}</span>
                      </td>
                      <td className="text-center px-4 py-3 text-emerald-600"
                        onClick={e => { e.stopPropagation(); openDrill(`${p.name} — Done`, { product_id: p.id, status: 'done' }); }}>
                        <span className="hover:underline cursor-pointer">{p.done}</span>
                      </td>
                      <td className="text-center px-4 py-3 text-red-600"
                        onClick={e => { e.stopPropagation(); openDrill(`${p.name} — Blocked`, { product_id: p.id, status: 'blocked' }); }}>
                        <span className="hover:underline cursor-pointer">{p.blocked}</span>
                      </td>
                      <td className="text-center px-4 py-3">
                        {+p.delayed > 0
                          ? <span className="text-red-600 font-medium hover:underline cursor-pointer"
                              onClick={e => { e.stopPropagation(); openDrill(`${p.name} — Delayed`, { product_id: p.id, status: 'todo,in_progress,in_review,blocked' }); }}>
                              {p.delayed}
                            </span>
                          : <span className="text-slate-400">0</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{p.active_sprint || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sprint Velocity */}
          <div className="card p-5 lg:col-span-2">
            <div className="mb-1">
              <h2 className="font-semibold text-slate-700">Sprint Velocity</h2>
              <p className="text-xs text-slate-400">Klik batang untuk melihat item sprint</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={velocity} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                onClick={handleVelocityClick} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="committed_points" name="Committed" fill="#818cf8" radius={[4,4,0,0]}
                  className="cursor-pointer" />
                <Bar dataKey="completed_points" name="Completed" fill="#4f46e5" radius={[4,4,0,0]}
                  className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution */}
          <div className="card p-5">
            <div className="mb-1">
              <h2 className="font-semibold text-slate-700">Status Distribution</h2>
              <p className="text-xs text-slate-400">Klik slice untuk melihat item</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value"
                  onClick={handlePieClick}
                  style={{ cursor: 'pointer' }}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}
                      stroke="none"
                      className="hover:opacity-80 transition-opacity" />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workload & Delayed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Workload */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-700">Team Workload</h2>
                <p className="text-xs text-slate-400">Klik untuk melihat item assignee</p>
              </div>
              <span className="text-xs text-slate-400">Kapasitas maks <strong className="text-slate-600">20 pts</strong></span>
            </div>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {workload.map(u => {
                const pts      = +u.total_points || 0;
                const CAPACITY = 20;
                const pct      = Math.min(pts / CAPACITY * 100, 100);
                const over     = pts > CAPACITY;
                const barColor  = over        ? 'bg-red-500'
                                : pts >= 16   ? 'bg-amber-400'
                                : pts >= 10   ? 'bg-indigo-500'
                                :               'bg-emerald-500';
                const textColor = over        ? 'text-red-600'
                                : pts >= 16   ? 'text-amber-600'
                                : pts >= 10   ? 'text-indigo-600'
                                :               'text-emerald-600';
                return (
                  <div key={u.id}
                    className="space-y-1 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                    onClick={() => openDrill(`Workload: ${u.name}`, { assignee_id: u.id })}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: u.avatar_color || '#6366f1' }}>
                          {u.name?.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate">{u.name}</span>
                        <span className="text-xs text-slate-400 hidden sm:block truncate">{u.role}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-xs font-semibold ${textColor}`}>{pts}</span>
                        <span className="text-xs text-slate-400">/ {CAPACITY} pts</span>
                        {over && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">overload</span>}
                        <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {u.total_assigned} item · {u.in_progress} in progress · {u.pending} pending
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delayed Items */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-700">Delayed Items</h2>
                <p className="text-xs text-slate-400">Klik untuk buka item</p>
              </div>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{delayed.length}</span>
            </div>
            <div className="divide-y divide-slate-50 max-h-[220px] overflow-y-auto">
              {delayed.length === 0
                ? <p className="text-center py-8 text-slate-400 text-sm">Tidak ada item terlambat</p>
                : delayed.map(item => (
                  <Link key={item.id} to={`/backlog?item=${item.id}`}
                    className="px-5 py-3 hover:bg-red-50/40 flex items-start justify-between gap-2 transition-colors group block">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate group-hover:text-red-700">{item.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="font-medium" style={{ color: item.color }}>{item.product_code}</span>
                        {' · '}{item.sprint || 'No Sprint'}
                        {' · '}{item.assignee || 'Unassigned'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <PriorityBadge priority={item.priority} />
                      <span className="text-xs text-red-500 font-medium">+{item.days_overdue}d</span>
                    </div>
                  </Link>
                ))
              }
            </div>
          </div>
        </div>

        {/* User Occupation */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-700">User Occupation</h2>
              <p className="text-xs text-slate-400">Berdasarkan sprint aktif · 1 SP = 6 jam</p>
            </div>
            <span className="text-xs text-slate-400">Kapasitas <strong className="text-slate-600">80 jam</strong> / sprint</span>
          </div>
          {occupation.filter(u => +u.total_sp > 0).length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">Tidak ada sprint aktif atau belum ada assignment</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {occupation.filter(u => +u.total_sp > 0).map(u => {
                const sp      = +u.total_sp   || 0;
                const hours   = +u.total_hours || 0;
                const CAPACITY = 80;
                const pct     = Math.min(hours / CAPACITY * 100, 100);
                const over    = hours > CAPACITY;
                const label   = over        ? 'Overload'
                              : hours >= 64 ? 'Padat'
                              : hours >= 40 ? 'Normal'
                              :               'Ringan';
                const barColor  = over        ? 'bg-red-500'
                                : hours >= 64 ? 'bg-amber-400'
                                : hours >= 40 ? 'bg-indigo-500'
                                :               'bg-emerald-500';
                const badgeClass = over        ? 'bg-red-100 text-red-700'
                                 : hours >= 64 ? 'bg-amber-100 text-amber-700'
                                 : hours >= 40 ? 'bg-indigo-100 text-indigo-700'
                                 :               'bg-emerald-100 text-emerald-700';
                return (
                  <div key={u.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => openDrill(`Occupation: ${u.name}`, { assignee_id: u.id })}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: u.avatar_color || '#6366f1' }}>
                          {u.name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate leading-tight">{u.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.role}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badgeClass}`}>{label}</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{sp} SP</span>
                      <span className="font-semibold text-slate-700">{hours} jam</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{u.total_items} item · {u.done_items} selesai</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
