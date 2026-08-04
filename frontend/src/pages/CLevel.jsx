import { useEffect, useState, useCallback, useMemo, useRef, useContext, createContext } from 'react';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  Plus, X, Pencil, Trash2, Search, CheckCheck, Clock, CheckCircle2,
  AlertCircle, Calendar, ExternalLink, ClipboardList, FileText, ChevronDown, Check
} from 'lucide-react';
import client from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const STATUSES    = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'];
const PRIORITIES  = ['critical', 'high', 'medium', 'low'];

const STATUS_BAR_CLS = {
  backlog: 'bg-purple-500', todo: 'bg-slate-400', in_progress: 'bg-blue-500',
  in_review: 'bg-amber-500', done: 'bg-emerald-500', blocked: 'bg-red-500',
};

// Department list (code/name/color) lives in the `departments` table, not hardcoded here —
// fetched once by the top-level CLevel component and made available to every nested tab/card
// via context, since DeptTag is used many levels deep (notes, tasks, dashboard rows).
const DepartmentsContext = createContext([]);

function DeptTag({ dept }) {
  const departments = useContext(DepartmentsContext);
  if (!dept) return <span className="text-slate-300 text-xs">—</span>;
  const d = departments.find(x => x.code === dept);
  const color = d?.color || '#64748B';
  return (
    <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded border"
      style={{ color, borderColor: color + '80' }}>
      {dept}
    </span>
  );
}

function defaultDepartment(user, departments) {
  const codes = departments.map(d => d.code);
  const assigned = (user?.departments || []).find(c => codes.includes(c));
  return assigned || codes[0] || '';
}

// ─── Leader Notes: form ───────────────────────────────────────────────────────

function LeaderNoteForm({ user, departments, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [department, setDepartment] = useState(defaultDepartment(user, departments));
  const [noteDate, setNoteDate]     = useState(today);
  const [goals, setGoals]           = useState('');
  const [tasks, setTasks]           = useState([]);
  const [taskInput, setTaskInput]   = useState('');
  const [saving, setSaving]         = useState(false);

  const addTask = () => {
    const t = taskInput.trim();
    if (!t) return;
    setTasks(prev => [...prev, t]);
    setTaskInput('');
  };
  const removeTask = (idx) => setTasks(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    if (!goals.trim()) { toast.error('Goals of This Week wajib diisi'); return; }
    setSaving(true);
    try {
      await client.post('/leader-notes', {
        department, note_date: noteDate, goals_this_week: goals, tasks,
      });
      toast.success('Leader Notes tersimpan');
      setGoals(''); setTasks([]); setTaskInput('');
      onSaved();
    } catch {
      // error toast already shown by axios interceptor
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="label">Tanggal</label>
        <input type="date" className="input" value={noteDate} onChange={e => setNoteDate(e.target.value)} />
      </div>
      <div>
        <label className="label">Departemen</label>
        <select className="select" value={department} onChange={e => setDepartment(e.target.value)}>
          {departments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Goals of This Week *</label>
        <textarea className="input h-24 resize-none" value={goals} onChange={e => setGoals(e.target.value)}
          placeholder="Target dan pencapaian utama departemen minggu ini..." />
      </div>
      <div className="col-span-2">
        <label className="label">Add Task</label>
        <div className="flex gap-2">
          <input className="input flex-1" value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
            placeholder="Judul task turunan dari catatan ini..." />
          <button type="button" className="btn-secondary shrink-0" onClick={addTask}>
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>
        {tasks.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2">
            {tasks.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1.5 text-sm font-medium">
                <span className="truncate">{t}</span>
                <button type="button" onClick={() => removeTask(idx)} className="text-indigo-400 hover:text-indigo-700 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="col-span-2 flex justify-end pt-2 border-t border-slate-100">
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Menyimpan...' : 'Simpan Leader Notes'}
        </button>
      </div>
    </div>
  );
}

// ─── Leader Notes: card ───────────────────────────────────────────────────────

function NoteCard({ note }) {
  const dateStr = note.note_date
    ? format(parseISO(String(note.note_date).slice(0, 10)), 'EEEE, dd MMMM yyyy', { locale: idLocale })
    : '—';
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: note.avatar_color || '#4F46E5' }}>
            {note.user_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{note.user_name}</p>
            <p className="text-xs text-slate-400">{dateStr}</p>
          </div>
        </div>
        <DeptTag dept={note.department} />
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.goals_this_week}</p>
      {note.tasks?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Task Turunan</p>
          <div className="flex flex-wrap gap-1.5">
            {note.tasks.map(t => (
              <span key={t.id} className="inline-flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <code className="text-[10px] text-slate-400 font-bold">{t.code}</code>
                <span className="text-slate-600">{t.title}</span>
                <StatusBadge status={t.status} size="xs" />
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Leader Notes ─────────────────────────────────────────────────────────

function NotesTab({ user, canWrite, departments, filterRequest, onFilterRequestHandled }) {
  const [notes, setNotes]     = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ department: '', user_id: '', date_from: '', date_to: '' });
  const [sortOrder, setSortOrder] = useState('desc');

  // Lets the Dashboard tab deep-link here with a department/user pre-applied.
  useEffect(() => {
    if (!filterRequest) return;
    setFilters(f => ({
      department: filterRequest.department ?? '',
      user_id:    filterRequest.user_id ?? '',
      date_from:  '',
      date_to:    '',
    }));
    onFilterRequestHandled?.();
  }, [filterRequest, onFilterRequestHandled]);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filters.department) params.department = filters.department;
      if (filters.user_id)    params.user_id    = filters.user_id;
      if (filters.date_from)  params.date_from   = filters.date_from;
      if (filters.date_to)    params.date_to     = filters.date_to;
      const res = await client.get('/leader-notes', { params });
      setNotes(res.data);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canWrite) return;
    client.get('/users').then(r => setUsers(r.data)).catch(() => {});
  }, [canWrite]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const hasFilter = filters.department || filters.user_id || filters.date_from || filters.date_to;

  const sortedNotes = useMemo(() => {
    const arr = [...notes];
    arr.sort((a, b) => {
      const ad = new Date(`${String(a.note_date).slice(0, 10)}T00:00:00`).getTime() || new Date(a.created_at).getTime();
      const bd = new Date(`${String(b.note_date).slice(0, 10)}T00:00:00`).getTime() || new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? bd - ad : ad - bd;
    });
    return arr;
  }, [notes, sortOrder]);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {canWrite ? (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-800">Catatan Minggu Ini</h2>
          </div>
          <LeaderNoteForm user={user} departments={departments} onSaved={load} />
        </div>
      ) : (
        <div className="card p-4 bg-slate-50 text-sm text-slate-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Kamu hanya bisa melihat Leader Notes departemen {(user?.departments || []).join(', ') || '—'}. Hanya Manager/PO/SME/Commissioner yang bisa menulis catatan.
        </div>
      )}

      <div className="space-y-3">
        <div className="card px-4 py-3 space-y-2.5">
          <div className="flex flex-wrap gap-3 items-end">
            {canWrite && (
              <>
                <div>
                  <label className="label">Departemen</label>
                  <select className="select w-40" value={filters.department} onChange={e => setFilter('department', e.target.value)}>
                    <option value="">Semua Departemen</option>
                    {departments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">User</label>
                  <select className="select w-44" value={filters.user_id} onChange={e => setFilter('user_id', e.target.value)}>
                    <option value="">Semua User</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="label">Dari</label>
              <input type="date" className="input w-40" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} />
            </div>
            <div>
              <label className="label">Sampai</label>
              <input type="date" className="input w-40" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} />
            </div>
            {hasFilter && (
              <button className="btn-secondary self-end"
                onClick={() => setFilters({ department: '', user_id: '', date_from: '', date_to: '' })}>
                Reset Filter
              </button>
            )}
          </div>

          {/* Shortcut sort chips — same pattern as the Backlog page's shortcut filter row */}
          <div className="w-full flex items-center gap-2 pt-2.5 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-400 shrink-0">Urutkan:</span>
            {[
              { key: 'desc', label: 'Terbaru dulu', icon: '🆕' },
              { key: 'asc',  label: 'Terlama dulu',  icon: '🕰️' },
            ].map(({ key, label, icon }) => {
              const active = sortOrder === key;
              return (
                <button key={key} type="button" onClick={() => setSortOrder(key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}>
                  <span>{icon}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {notes.length === 0 ? (
          <div className="card p-10 text-center text-slate-400 text-sm">Belum ada Leader Notes</div>
        ) : (
          <div className="space-y-3">
            {sortedNotes.map(n => <NoteCard key={n.id} note={n} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leader Task: create/edit modal ───────────────────────────────────────────

function TaskForm({ task, user, users, departments, onSaved, onClose }) {
  const [form, setForm] = useState({
    department: task?.department || defaultDepartment(user, departments),
    title:      task?.title || '',
    priority:   task?.priority || 'medium',
    status:     task?.status || 'backlog',
    assignee_id: task?.assignee_id || '',
    deadline:   task?.deadline ? String(task.deadline).slice(0, 10) : '',
    notes:      task?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) { toast.error('Judul wajib diisi'); return; }
    setSaving(true);
    try {
      const body = { ...form, assignee_id: form.assignee_id || null };
      if (task?.id) {
        await client.put(`/leader-tasks/${task.id}`, body);
        toast.success('Leader Task diperbarui');
      } else {
        await client.post('/leader-tasks', body);
        toast.success('Leader Task dibuat');
      }
      onSaved();
    } catch {
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="label">Departemen</label>
        <select className="select" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
          {departments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Prioritas</label>
        <select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Judul *</label>
        <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      </div>
      <div>
        <label className="label">Status</label>
        <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Assignee</label>
        <select className="select" value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
          <option value="">— Belum ditugaskan —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Deadline</label>
        <input type="date" className="input" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
      </div>
      <div className="col-span-2">
        <label className="label">Catatan</label>
        <textarea className="input h-20 resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Menyimpan...' : (task?.id ? 'Perbarui' : 'Buat Task')}
        </button>
      </div>
    </div>
  );
}

// ─── Shared: Task detail slide-over panel ─────────────────────────────────────

function TaskDetailPanel({ taskId, onClose, canWrite, currentUserId, onChanged }) {
  const [task, setTask] = useState(null);
  const [activities, setActivities] = useState([]);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) return;
    try {
      const [t, a] = await Promise.all([
        client.get(`/leader-tasks/${taskId}`),
        client.get(`/leader-tasks/${taskId}/activities`),
      ]);
      setTask(t.data);
      setActivities(a.data);
    } catch { onClose(); }
  }, [taskId, onClose]);

  useEffect(() => { load(); }, [load]);

  if (!taskId) return null;
  const isAssignee = task && String(task.assignee_id) === String(currentUserId);
  const canChangeStatus = canWrite || isAssignee;

  const changeStatus = async (status) => {
    try {
      await client.patch(`/leader-tasks/${taskId}/status`, { status });
      setTask(t => ({ ...t, status }));
      onChanged?.();
    } catch {}
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await client.post(`/leader-tasks/${taskId}/activities`, { content: comment.trim() });
      setComment('');
      const a = await client.get(`/leader-tasks/${taskId}/activities`);
      setActivities(a.data);
    } catch {} finally { setPosting(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[440px] max-w-[92vw] bg-white shadow-2xl z-50 flex flex-col">
        {!task ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-400 mb-1">{task.code}</p>
                  <h3 className="font-semibold text-slate-800 text-base leading-snug">{task.title}</h3>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <DeptTag dept={task.department} />
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {task.source_note_goals && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Goals of This Week</p>
                  <p className="text-[11px] text-slate-400 mb-1">
                    Dari catatan {task.department} · {task.source_note_date ? format(parseISO(String(task.source_note_date).slice(0, 10)), 'dd MMM yyyy') : ''} · {task.source_note_author}
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                    {task.source_note_goals}
                  </p>
                </div>
              )}

              <div className="pt-1 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-3 text-sm pt-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Assignee</p>
                    <span className="text-slate-700 font-medium">{task.assignee_name || '— Belum ditugaskan —'}</span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Deadline</p>
                    {task.deadline
                      ? <span className={`font-medium ${task.is_delayed ? 'text-red-600' : 'text-slate-700'}`}>
                          {format(parseISO(String(task.deadline).slice(0, 10)), 'dd MMM yyyy')}
                        </span>
                      : <span className="text-slate-400">—</span>}
                  </div>
                </div>
              </div>

              {canChangeStatus && (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 mb-1">Ubah Status</p>
                    <select className="select text-sm" value={task.status} onChange={e => changeStatus(e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  {task.status !== 'done' && (
                    <button
                      className="mt-4 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors font-medium"
                      onClick={() => changeStatus('done')}>
                      <CheckCheck className="w-3.5 h-3.5" /> Tandai Selesai
                    </button>
                  )}
                </div>
              )}

              {task.notes && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                    {task.notes}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Lampiran</p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl p-3">
                  Belum tersedia di iterasi ini
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Aktivitas &amp; Komentar</p>
                <div className="space-y-3 mb-3">
                  {activities.map(a => (
                    <div key={a.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: a.user_avatar_color || '#94a3b8' }}>
                        {a.user_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-slate-700">{a.user_name || 'System'}</span>
                          <span className="text-[10px] text-slate-400">{format(parseISO(a.created_at), 'dd MMM, HH:mm')}</span>
                        </div>
                        <p className={`text-xs mt-0.5 ${a.type === 'change_log' ? 'text-slate-400 italic' : 'text-slate-600'}`}>
                          {a.content}
                        </p>
                      </div>
                    </div>
                  ))}
                  {activities.length === 0 && <p className="text-xs text-slate-400">Belum ada aktivitas</p>}
                </div>
                <div className="flex gap-2">
                  <input className="input text-sm" placeholder="Tulis komentar..." value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendComment(); }} />
                  <button className="btn-primary btn-sm shrink-0" disabled={posting} onClick={sendComment}>Kirim</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Multi-select filter dropdown (same pattern as the Backlog page) ─────────

function MultiSelect({ label, options, selected, onChange, minWidth = 130 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = (v) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);

  const count = selected.length;
  const buttonLabel = count === 0
    ? `Semua ${label}`
    : count === 1
      ? (options.find(o => o.v === selected[0])?.l ?? `${label} (1)`)
      : `${label} (${count})`;

  return (
    <div className="relative" ref={ref} style={{ minWidth }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`select w-full flex items-center justify-between gap-2 ${count ? 'border-indigo-300 text-slate-700' : 'text-slate-500'}`}>
        <span className="truncate capitalize">{buttonLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[170px] bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
          {count > 0 && (
            <button type="button" onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 border-b border-slate-100 mb-1">
              Bersihkan pilihan
            </button>
          )}
          {options.map(o => {
            const on = selected.includes(o.v);
            return (
              <button key={o.v} type="button" onClick={() => toggle(o.v)}
                className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${on ? 'text-indigo-700 bg-indigo-50/50' : 'text-slate-600 hover:bg-slate-50'}`}>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                  {on && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="truncate capitalize">{o.l}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Leader Task ──────────────────────────────────────────────────────────

function TasksTab({ user, canWrite, departments, detailId, setDetailId, filterRequest, onFilterRequestHandled }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ department: '', status: [], priority: [], search: '' });
  const [modal, setModal] = useState({ open: false, task: null });

  // Lets the Dashboard tab deep-link here with a department/status pre-applied.
  useEffect(() => {
    if (!filterRequest) return;
    setFilters(f => ({
      department: filterRequest.department ?? '',
      status:     filterRequest.status ? [filterRequest.status] : [],
      priority:   [],
      search:     '',
    }));
    onFilterRequestHandled?.();
  }, [filterRequest, onFilterRequestHandled]);

  const load = useCallback(async () => {
    try {
      const params = { limit: 200 };
      if (filters.department)      params.department = filters.department;
      if (filters.status.length)   params.status     = filters.status.join(',');
      if (filters.priority.length) params.priority   = filters.priority.join(',');
      if (filters.search)          params.search     = filters.search;
      const res = await client.get('/leader-tasks', { params });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { client.get('/users').then(r => setUsers(r.data)).catch(() => {}); }, []);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const quickStatus = async (id, status) => {
    try {
      await client.patch(`/leader-tasks/${id}/status`, { status });
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    } catch {}
  };

  const del = async (task) => {
    if (!confirm(`Hapus Leader Task "${task.title}"?`)) return;
    try {
      await client.delete(`/leader-tasks/${task.id}`);
      toast.success('Task dihapus');
      load();
    } catch {}
  };

  const closeModal = () => setModal({ open: false, task: null });

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const toggleShortcut = (key, val) => setFilters(f => ({
    ...f,
    [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
  }));

  const SHORTCUTS = [
    { label: 'Backlog',     icon: '📋', key: 'status',   val: 'backlog'     },
    { label: 'To Do',       icon: '📝', key: 'status',   val: 'todo'        },
    { label: 'In Progress', icon: '🚧', key: 'status',   val: 'in_progress' },
    { label: 'Critical',    icon: '🔥', key: 'priority', val: 'critical'    },
    { label: 'Selesai',     icon: '✅', key: 'status',   val: 'done'        },
  ];

  return (
    <div className="space-y-4">
      <div className="card px-4 py-3 space-y-2.5">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Cari judul atau kode..."
              value={filters.search} onChange={e => setFilter('search', e.target.value)} />
          </div>
          {canWrite && (
            <select className="select w-auto min-w-[150px]" value={filters.department} onChange={e => setFilter('department', e.target.value)}>
              <option value="">Semua Departemen</option>
              {departments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          )}
          <MultiSelect label="Status" minWidth={150}
            options={STATUSES.map(s => ({ v: s, l: s.replace('_', ' ') }))}
            selected={filters.status}
            onChange={vals => setFilters(f => ({ ...f, status: vals }))} />
          <MultiSelect label="Prioritas" minWidth={140}
            options={PRIORITIES.map(p => ({ v: p, l: p }))}
            selected={filters.priority}
            onChange={vals => setFilters(f => ({ ...f, priority: vals }))} />
          {canWrite && (
            <button className="btn-primary ml-auto" onClick={() => setModal({ open: true, task: null })}>
              <Plus className="w-4 h-4" /> Tambah Task
            </button>
          )}
        </div>

        {/* Shortcut filter chips — same pattern as the Backlog page */}
        <div className="w-full flex items-center gap-2 pt-2.5 border-t border-slate-100 flex-wrap">
          <span className="text-[11px] font-medium text-slate-400 shrink-0">Shortcut:</span>
          {SHORTCUTS.map(({ label, icon, key, val }) => {
            const active = filters[key].includes(val);
            return (
              <button key={`${key}-${val}`} type="button" onClick={() => toggleShortcut(key, val)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}>
                <span>{icon}</span>
                {label}
                {active && <X className="w-3 h-3 ml-0.5 opacity-60" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Tidak ada Leader Task ditemukan</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="text-left px-4 py-2.5">Kode</th>
                  <th className="text-left px-4 py-2.5">Judul</th>
                  <th className="text-center px-3 py-2.5">Departemen</th>
                  <th className="text-center px-3 py-2.5">Prioritas</th>
                  <th className="text-center px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Assignee</th>
                  <th className="text-left px-3 py-2.5">Deadline</th>
                  {canWrite && <th className="text-center px-3 py-2.5">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map(item => {
                  const canChangeStatus = canWrite || String(item.assignee_id) === String(user?.id);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 font-medium">{item.code}</td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <button className="text-left group w-full" onClick={() => setDetailId(item.id)}>
                          <p className="font-medium text-slate-700 truncate group-hover:text-indigo-600 transition-colors" title={item.title}>
                            {item.title}
                          </p>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center"><DeptTag dept={item.department} /></td>
                      <td className="px-3 py-3 text-center"><PriorityBadge priority={item.priority} /></td>
                      <td className="px-3 py-3 text-center">
                        <select className="text-xs border-0 bg-transparent focus:ring-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          value={item.status} disabled={!canChangeStatus}
                          onChange={e => quickStatus(item.id, e.target.value)}>
                          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{item.assignee_name || '—'}</td>
                      <td className="px-3 py-3 text-xs">
                        {item.deadline
                          ? <span className={item.is_delayed ? 'text-red-500 font-medium' : 'text-slate-500'}>
                              {format(parseISO(String(item.deadline).slice(0, 10)), 'dd MMM')}
                            </span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      {canWrite && (
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 justify-center">
                            <button className="p-1 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600" title="Edit"
                              onClick={() => setModal({ open: true, task: item })}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Hapus"
                              onClick={() => del(item)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">{total} task</div>
      </div>

      <Modal open={modal.open} onClose={closeModal} title={modal.task ? 'Edit Leader Task' : 'Tambah Leader Task'} size="md">
        <TaskForm task={modal.task} user={user} users={users} departments={departments}
          onSaved={() => { closeModal(); load(); }} onClose={closeModal} />
      </Modal>

      {detailId && (
        <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)}
          canWrite={canWrite} currentUserId={user?.id} onChanged={load} />
      )}
    </div>
  );
}

// ─── Tab: My Task ──────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'active',      label: 'Aktif'       },
  { key: 'todo',        label: 'To Do'       },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review',   label: 'In Review'   },
  { key: 'done',        label: 'Selesai'     },
  { key: 'all',         label: 'Semua'       },
];

function MineTab({ user, detailId, setDetailId }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState('active');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await client.get('/leader-tasks', { params: { assignee_id: user.id, limit: 500 } });
      setItems(res.data.items || []);
    } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const s = { active: 0, in_progress: 0, in_review: 0, done: 0 };
    items.forEach(i => {
      if (!['done', 'backlog'].includes(i.status)) s.active++;
      if (i.status === 'in_progress') s.in_progress++;
      if (i.status === 'in_review')   s.in_review++;
      if (i.status === 'done')        s.done++;
    });
    return s;
  }, [items]);

  const filtered = useMemo(() => items.filter(i => {
    if (tab === 'active') return !['done', 'backlog'].includes(i.status);
    if (tab === 'all') return true;
    return i.status === tab;
  }), [items, tab]);

  const quickStatus = async (id, status) => {
    try {
      await client.patch(`/leader-tasks/${id}/status`, { status });
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    } catch {}
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'active',      label: 'Aktif',       value: stats.active,      color: 'bg-indigo-50 text-indigo-600',  icon: Clock },
          { key: 'in_progress', label: 'In Progress', value: stats.in_progress, color: 'bg-blue-50 text-blue-600',      icon: CheckCircle2 },
          { key: 'in_review',   label: 'In Review',   value: stats.in_review,   color: 'bg-amber-50 text-amber-600',    icon: AlertCircle },
          { key: 'done',        label: 'Selesai',     value: stats.done,        color: 'bg-emerald-50 text-emerald-600', icon: CheckCheck },
        ].map(({ key, label, value, color, icon: Icon }) => (
          <button key={key} className="card p-4 flex items-center gap-3 text-left hover:shadow-md transition-all"
            onClick={() => setTab(key)}>
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

      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {STATUS_TABS.map(t => (
          <button key={t.key}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors
              ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Tidak ada Leader Task yang di-assign ke kamu</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="text-left px-4 py-2.5">Kode</th>
                <th className="text-left px-4 py-2.5">Judul</th>
                <th className="text-center px-3 py-2.5">Departemen</th>
                <th className="text-center px-3 py-2.5">Prioritas</th>
                <th className="text-center px-3 py-2.5">Status</th>
                <th className="text-left px-3 py-2.5">Deadline</th>
                <th className="text-center px-3 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 font-medium">{item.code}</td>
                  <td className="px-4 py-3 max-w-[240px]">
                    <button className="text-left group w-full" onClick={() => setDetailId(item.id)}>
                      <p className={`font-medium truncate group-hover:text-indigo-600 transition-colors ${item.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`} title={item.title}>
                        {item.title}
                      </p>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-center"><DeptTag dept={item.department} /></td>
                  <td className="px-3 py-3 text-center"><PriorityBadge priority={item.priority} /></td>
                  <td className="px-3 py-3 text-center"><StatusBadge status={item.status} /></td>
                  <td className="px-3 py-3 text-xs">
                    {item.deadline
                      ? <span className={item.is_delayed ? 'text-red-500 font-medium' : 'text-slate-500'}>
                          {format(parseISO(String(item.deadline).slice(0, 10)), 'dd MMM')}
                        </span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      {item.status !== 'done' && (
                        <button title="Tandai selesai" className="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"
                          onClick={() => quickStatus(item.id, 'done')}>
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button title="Detail" className="p-1 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                        onClick={() => setDetailId(item.id)}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailId && (
        <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)}
          canWrite={false} currentUserId={user?.id} onChanged={load} />
      )}
    </div>
  );
}

// ─── Bar row: shared by the status/department breakdowns ─────────────────────

function BarRow({ label, count, max, barClass, barColor, onClick }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0;
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className="flex items-center gap-3 w-full text-left group disabled:cursor-default">
      <span className="text-xs text-slate-500 w-24 shrink-0 truncate group-hover:text-indigo-600 transition-colors" title={label}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barClass || ''} ${onClick ? 'group-hover:opacity-80 transition-opacity' : ''}`}
          style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-6 text-right shrink-0">{count}</span>
    </button>
  );
}

// ─── Tab: Dashboard ────────────────────────────────────────────────────────────

function DashboardTab({ user, canWrite, departments, onGoToTasks, onGoToNotes, onOpenTask }) {
  const [tasks, setTasks]     = useState([]);
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [t, n] = await Promise.all([
          client.get('/leader-tasks', { params: { limit: 1000 } }),
          client.get('/leader-notes'),
        ]);
        if (cancelled) return;
        setTasks(t.data.items || []);
        setNotes(n.data || []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const s = { total: tasks.length, active: 0, done: 0, overdue: 0 };
    tasks.forEach(t => {
      if (!['done', 'backlog'].includes(t.status)) s.active++;
      if (t.status === 'done') s.done++;
      if (t.is_delayed) s.overdue++;
    });
    return s;
  }, [tasks]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
    tasks.forEach(t => { if (counts[t.status] != null) counts[t.status]++; });
    return counts;
  }, [tasks]);
  const maxStatus = Math.max(1, ...Object.values(statusCounts));

  const deptCodes = departments.map(d => d.code);
  const deptDepartments = canWrite ? deptCodes : (user?.departments || []).filter(c => deptCodes.includes(c));
  const deptColor = code => departments.find(d => d.code === code)?.color || '#64748B';
  const deptCounts = useMemo(() => {
    const counts = Object.fromEntries(deptDepartments.map(d => [d, 0]));
    tasks.forEach(t => { if (counts[t.department] != null) counts[t.department]++; });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, deptDepartments.join(',')]);
  const maxDept = Math.max(1, ...Object.values(deptCounts));

  const weekRange = useMemo(() => ({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end:   endOfWeek(new Date(), { weekStartsOn: 1 }),
  }), []);
  const notesThisWeek = useMemo(() => notes.filter(n => {
    if (!n.note_date) return false;
    const d = parseISO(String(n.note_date).slice(0, 10));
    return isWithinInterval(d, weekRange);
  }), [notes, weekRange]);
  const submittedDepts = useMemo(() => new Set(notesThisWeek.map(n => n.department)), [notesThisWeek]);

  const recentNotes = useMemo(() => notes.slice(0, 5), [notes]);
  const upcomingDeadlines = useMemo(() => tasks
    .filter(t => t.deadline && t.status !== 'done')
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 6), [tasks]);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Task',  value: stats.total,   color: 'bg-indigo-50 text-indigo-600',   icon: ClipboardList, filter: {} },
          { label: 'Aktif',       value: stats.active,  color: 'bg-blue-50 text-blue-600',        icon: Clock,         filter: {} },
          { label: 'Selesai',     value: stats.done,    color: 'bg-emerald-50 text-emerald-600',  icon: CheckCheck,    filter: { status: 'done' } },
          { label: 'Terlambat',   value: stats.overdue, color: 'bg-red-50 text-red-600',          icon: AlertCircle,   filter: {} },
        ].map(({ label, value, color, icon: Icon, filter }) => (
          <button key={label} className="card p-4 flex items-center gap-3 text-left hover:shadow-md transition-all"
            onClick={() => onGoToTasks?.(filter)}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-4">Task per Status</h3>
          <div className="space-y-2.5">
            {STATUSES.map(s => (
              <BarRow key={s} label={s.replace('_', ' ')} count={statusCounts[s]} max={maxStatus} barClass={STATUS_BAR_CLS[s]}
                onClick={() => onGoToTasks?.({ status: s })} />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-4">Task per Departemen</h3>
          {deptDepartments.length === 0 ? (
            <p className="text-xs text-slate-400">Tidak ada departemen untuk ditampilkan</p>
          ) : (
            <div className="space-y-2.5">
              {deptDepartments.map(d => (
                <BarRow key={d} label={d} count={deptCounts[d]} max={maxDept} barColor={deptColor(d)}
                  onClick={() => onGoToTasks?.({ department: d })} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 text-sm">Kepatuhan Leader Notes Minggu Ini</h3>
          <span className="text-xs text-slate-400">
            {format(weekRange.start, 'dd MMM')} – {format(weekRange.end, 'dd MMM yyyy')}
          </span>
        </div>
        {deptDepartments.length === 0 ? (
          <p className="text-xs text-slate-400">Tidak ada departemen untuk ditampilkan</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {deptDepartments.map(d => {
              const submitted = submittedDepts.has(d);
              return (
                <button key={d} type="button" onClick={() => onGoToNotes?.({ department: d })}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors
                    ${submitted
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                  {submitted ? <CheckCheck className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {d}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Catatan Terbaru</h3>
          </div>
          {recentNotes.length === 0 ? (
            <p className="text-xs text-slate-400">Belum ada Leader Notes</p>
          ) : (
            <div className="space-y-3">
              {recentNotes.map(n => (
                <button key={n.id} type="button"
                  onClick={() => onGoToNotes?.({ department: n.department, user_id: n.user_id })}
                  className="flex items-start gap-2.5 pb-3 border-b border-slate-50 last:border-0 last:pb-0 w-full text-left group">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: n.avatar_color || '#4F46E5' }}>
                    {n.user_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{n.user_name}</span>
                      <DeptTag dept={n.department} />
                      <span className="text-[10px] text-slate-400">
                        {n.note_date ? format(parseISO(String(n.note_date).slice(0, 10)), 'dd MMM yyyy') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5" title={n.goals_this_week}>{n.goals_this_week}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Deadline Mendatang</h3>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-slate-400">Tidak ada task dengan deadline aktif</p>
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.map(t => (
                <button key={t.id} type="button" onClick={() => onOpenTask?.(t.id)}
                  className="flex items-center justify-between gap-2 pb-3 border-b border-slate-50 last:border-0 last:pb-0 w-full text-left group">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate group-hover:text-indigo-600 transition-colors" title={t.title}>{t.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-mono text-[10px] text-slate-400">{t.code}</span>
                      <DeptTag dept={t.department} />
                    </div>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${t.is_delayed ? 'text-red-600' : 'text-slate-500'}`}>
                    {format(parseISO(String(t.deadline).slice(0, 10)), 'dd MMM')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function CLevel() {
  const { user, hasRole, hasPermission } = useAuth();
  const canWrite = hasRole('super_admin', 'manager', 'po', 'sme', 'commissioner')
    || hasPermission('manage_leader_notes') || hasPermission('manage_leader_tasks');
  const [tab, setTab] = useState('dashboard');
  const [detailId, setDetailId] = useState(null);
  const [taskFilterRequest, setTaskFilterRequest] = useState(null);
  const [noteFilterRequest, setNoteFilterRequest] = useState(null);
  const [departments, setDepartments] = useState([]);

  useEffect(() => { client.get('/departments').then(r => setDepartments(r.data)).catch(() => {}); }, []);

  // Dashboard cards/rows deep-link into the other tabs — pre-applying a
  // filter (or opening a task's detail panel directly) instead of just
  // switching tabs blind.
  const goToTasks = (filter) => { setTaskFilterRequest(filter || {}); setDetailId(null); setTab('tasks'); };
  const goToNotes = (filter) => { setNoteFilterRequest(filter || {}); setTab('notes'); };
  const openTask  = (id) => { setDetailId(id); setTab('tasks'); };

  return (
    <DepartmentsContext.Provider value={departments}>
      <div className="space-y-5">
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          {[
            ['dashboard', 'Dashboard'],
            ['notes', 'Leader Notes'],
            ['tasks', 'Leader Task'],
            ['mine',  'My Task'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setDetailId(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && <DashboardTab user={user} canWrite={canWrite} departments={departments} onGoToTasks={goToTasks} onGoToNotes={goToNotes} onOpenTask={openTask} />}
        {tab === 'notes' && <NotesTab user={user} canWrite={canWrite} departments={departments} filterRequest={noteFilterRequest} onFilterRequestHandled={() => setNoteFilterRequest(null)} />}
        {tab === 'tasks' && <TasksTab user={user} canWrite={canWrite} departments={departments} detailId={detailId} setDetailId={setDetailId} filterRequest={taskFilterRequest} onFilterRequestHandled={() => setTaskFilterRequest(null)} />}
        {tab === 'mine'  && <MineTab  user={user} detailId={detailId} setDetailId={setDetailId} />}
      </div>
    </DepartmentsContext.Provider>
  );
}
