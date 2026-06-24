import { useEffect, useState, useCallback, useRef } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  Pencil, AlertCircle, CheckCircle2, Trophy, Calendar, Users,
  Upload, FileDown, X, CheckCircle, Info, SkipForward
} from 'lucide-react';
import client from '../api/client';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ─── StandupForm ──────────────────────────────────────────────────────────────
function StandupForm({ standup, onSave, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    standup_date: standup?.standup_date
      ? (standup.standup_date instanceof Date
          ? standup.standup_date.toISOString().slice(0, 10)
          : String(standup.standup_date).slice(0, 10))
      : today,
    yesterday:    standup?.yesterday    || '',
    today:        standup?.today        || '',
    has_blocker:  standup?.has_blocker  ?? false,
    blocker:      standup?.blocker      || '',
    blocker_plan: standup?.blocker_plan || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.yesterday.trim() || !form.today.trim()) {
      toast.error('Yesterday dan Today wajib diisi'); return;
    }
    setSaving(true);
    try {
      if (standup?.id) {
        await client.put(`/standups/${standup.id}`, form);
        toast.success('Standup diperbarui');
      } else {
        await client.post('/standups', form);
        toast.success('Standup dikirim');
      }
      onSave();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Terjadi kesalahan');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Tanggal Standup</label>
        <input type="date" className="input" value={form.standup_date}
          onChange={e => setForm(f => ({ ...f, standup_date: e.target.value }))} />
      </div>
      <div>
        <label className="label">Kemarin saya mengerjakan... *</label>
        <textarea className="input h-24 resize-none" value={form.yesterday}
          onChange={e => setForm(f => ({ ...f, yesterday: e.target.value }))}
          placeholder="Ceritakan progress pekerjaan kemarin" />
      </div>
      <div>
        <label className="label">Hari ini saya akan... *</label>
        <textarea className="input h-24 resize-none" value={form.today}
          onChange={e => setForm(f => ({ ...f, today: e.target.value }))}
          placeholder="Rencana pekerjaan hari ini" />
      </div>
      <div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setForm(f => ({ ...f, has_blocker: !f.has_blocker }))}
            className={`w-10 h-6 rounded-full transition-colors relative ${form.has_blocker ? 'bg-red-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.has_blocker ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm font-medium text-slate-700">Ada Blocker?</span>
          {form.has_blocker && <AlertCircle className="w-4 h-4 text-red-500" />}
        </label>
      </div>
      {form.has_blocker && (
        <>
          <div>
            <label className="label">Deskripsi Blocker</label>
            <textarea className="input h-20 resize-none" value={form.blocker}
              onChange={e => setForm(f => ({ ...f, blocker: e.target.value }))}
              placeholder="Apa yang menghambat progress?" />
          </div>
          <div>
            <label className="label">Rencana Mengatasi Blocker</label>
            <textarea className="input h-20 resize-none" value={form.blocker_plan}
              onChange={e => setForm(f => ({ ...f, blocker_plan: e.target.value }))}
              placeholder="Langkah-langkah untuk mengatasi blocker" />
          </div>
        </>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        {onClose && <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>}
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Menyimpan...' : (standup?.id ? 'Perbarui' : 'Kirim Standup')}
        </button>
      </div>
    </div>
  );
}

// ─── StandupCard ──────────────────────────────────────────────────────────────
function StandupCard({ standup, onEdit, canEdit }) {
  const dateStr = standup.standup_date
    ? format(parseISO(String(standup.standup_date).slice(0, 10)), 'EEEE, dd MMMM yyyy', { locale: idLocale })
    : '—';

  return (
    <div className={`card p-5 space-y-4 ${standup.has_blocker ? 'border-l-4 border-l-red-400' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">{dateStr}</p>
          {standup.user_name && <p className="text-xs text-slate-400 mt-0.5">{standup.user_name}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {standup.has_blocker && (
            <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Blocker
            </span>
          )}
          {canEdit && (
            <button className="btn-ghost btn-sm p-1.5 rounded-lg" onClick={() => onEdit(standup)}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Kemarin</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{standup.yesterday}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Hari Ini</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{standup.today}</p>
        </div>
      </div>
      {standup.has_blocker && standup.blocker && (
        <div className="bg-red-50 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Blocker</p>
          <p className="text-sm text-red-800 whitespace-pre-wrap">{standup.blocker}</p>
          {standup.blocker_plan && (
            <>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mt-2">Rencana Atasi</p>
              <p className="text-sm text-red-800 whitespace-pre-wrap">{standup.blocker_plan}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── StandupImport ────────────────────────────────────────────────────────────
const CSV_COLUMNS = [
  { key: 'standup_date', label: 'standup_date', req: true,  desc: 'Format YYYY-MM-DD, mis: 2024-01-15' },
  { key: 'email',        label: 'email',         req: true,  desc: 'Email user yang terdaftar di sistem' },
  { key: 'yesterday',    label: 'yesterday',     req: true,  desc: 'Pekerjaan yang dilakukan kemarin' },
  { key: 'today',        label: 'today',         req: true,  desc: 'Rencana pekerjaan hari ini' },
  { key: 'has_blocker',  label: 'has_blocker',   req: false, desc: 'true / false (default false)' },
  { key: 'blocker',      label: 'blocker',       req: false, desc: 'Deskripsi blocker (jika has_blocker=true)' },
  { key: 'blocker_plan', label: 'blocker_plan',  req: false, desc: 'Rencana mengatasi blocker' },
];

function StandupImport({ onDone }) {
  const [file,      setFile]      = useState(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);
  const inputRef = useRef();

  const downloadTemplate = () => {
    const rows = [
      CSV_COLUMNS.map(c => c.key).join(','),
      '2024-01-15,alice@example.com,"Menyelesaikan feature login","Review PR dan bug fix",false,,',
      '2024-01-15,bob@example.com,"Meeting sprint planning","Mulai implementasi API baru",true,"Server staging error","Koordinasi dengan tim DevOps"',
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'standup_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFiles = (files) => {
    const f = files[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) { toast.error('Hanya file CSV yang diperbolehkan'); return; }
    setFile(f);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await client.post('/standups/import', fd);
      setResult(res.data);
      if (res.data.imported > 0) {
        toast.success(`${res.data.imported} standup berhasil diimpor`);
        onDone();
      }
    } catch (err) {
      setResult({ imported: 0, skipped: 0, errors: 1, error_details: [err?.response?.data?.error || 'Gagal mengimpor file'] });
    } finally { setImporting(false); }
  };

  const clearFile = () => { setFile(null); setResult(null); if (inputRef.current) inputRef.current.value = ''; };

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── Format info ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-slate-700">Format CSV</h3>
          </div>
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 border border-indigo-200 transition-colors">
            <FileDown className="w-3.5 h-3.5" /> Download Template
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-left px-3 py-2 font-semibold">Kolom</th>
                <th className="text-center px-3 py-2 font-semibold">Wajib</th>
                <th className="text-left px-3 py-2 font-semibold">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {CSV_COLUMNS.map(c => (
                <tr key={c.key}>
                  <td className="px-3 py-2 font-mono text-indigo-700 font-medium">{c.label}</td>
                  <td className="px-3 py-2 text-center">
                    {c.req
                      ? <span className="text-red-500 font-bold">✓</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-400 flex items-start gap-1.5">
          <span className="shrink-0 mt-0.5">💡</span>
          Data duplikat (user + tanggal sudah ada) akan dilewati otomatis tanpa error.
          Field yang mengandung koma harus diapit tanda kutip ganda.
        </p>
      </div>

      {/* ── Upload area ── */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Upload className="w-4 h-4 text-indigo-500" /> Upload File CSV
        </h3>

        {!file ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Drag & drop file CSV ke sini</p>
            <p className="text-xs text-slate-400 mt-1">atau klik untuk pilih file</p>
            <input ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={e => handleFiles(e.target.files)} />
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={clearFile} className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-red-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button
            disabled={!file || importing}
            onClick={handleImport}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {importing
              ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Mengimpor...</>
              : <><Upload className="w-3.5 h-3.5" /> Mulai Import</>}
          </button>
        </div>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-700">Hasil Import</h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xl font-bold text-emerald-700">{result.imported ?? 0}</p>
                <p className="text-xs text-emerald-600">Berhasil diimpor</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <SkipForward className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-xl font-bold text-amber-700">{result.skipped ?? 0}</p>
                <p className="text-xs text-amber-600">Dilewati (duplikat)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <p className="text-xl font-bold text-red-700">{result.errors ?? 0}</p>
                <p className="text-xs text-red-600">Error</p>
              </div>
            </div>
          </div>

          {result.error_details?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Detail Error</p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                {result.error_details.map((e, i) => (
                  <p key={i} className="text-xs text-red-700 font-mono">• {e}</p>
                ))}
              </div>
            </div>
          )}

          {result.imported > 0 && result.errors === 0 && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">Import selesai! Data standup sudah tersedia di tab Riwayat.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Standup() {
  const { user, hasRole } = useAuth();
  const [tab,         setTab]        = useState('standup');
  const [todayData,   setTodayData]  = useState(null);
  const [standups,    setStandups]   = useState([]);
  const [achievement, setAchievement]= useState([]);
  const [users,       setUsers]      = useState([]);
  const [filters,     setFilters]    = useState({ user_id: '', date_from: '', date_to: '' });
  const [loading,     setLoading]    = useState(true);
  const [modal,       setModal]      = useState({ open: false, data: null });
  const [perPage,     setPerPage]    = useState(10);
  const [page,        setPage]       = useState(1);

  const isManagerOrAbove = hasRole('super_admin', 'manager');
  const isPoOrAbove      = hasRole('super_admin', 'manager', 'po');

  const loadToday = useCallback(async () => {
    try {
      const res = await client.get('/standups/today');
      setTodayData(res.data);
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const params = {};
      if (filters.user_id)   params.user_id   = filters.user_id;
      if (filters.date_from) params.date_from  = filters.date_from;
      if (filters.date_to)   params.date_to    = filters.date_to;
      const res = await client.get('/standups', { params });
      setStandups(res.data);
    } catch {}
  }, [filters]);

  const loadAchievement = useCallback(async () => {
    try {
      const res = await client.get('/standups/achievement');
      setAchievement(res.data);
    } catch {}
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isManagerOrAbove) return;
    try {
      const res = await client.get('/users');
      setUsers(res.data);
    } catch {}
  }, [isManagerOrAbove]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadToday(), loadHistory(), loadAchievement(), loadUsers()])
      .finally(() => setLoading(false));
  }, [loadToday, loadHistory, loadAchievement, loadUsers]);

  const canEditStandup = (s) => {
    if (isPoOrAbove) return true;
    return String(s.user_id) === String(user?.id);
  };

  // ── pagination for history
  const totalPages  = Math.max(1, Math.ceil(standups.length / perPage));
  const pagedItems  = standups.slice((page - 1) * perPage, page * perPage);

  const handleFilterChange = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }));
    setPage(1);
  };

  const closeModal = () => setModal({ open: false, data: null });

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[
          ['standup',    'Input Standup'],
          ['history',    'Riwayat'],
          ['achievement','Achievement'],
          ...(isManagerOrAbove ? [['import', 'Import CSV']] : []),
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── INPUT STANDUP TAB ── */}
      {tab === 'standup' && (
        <div className="max-w-2xl space-y-4">
          {todayData?.submitted ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-700 font-medium">Standup hari ini sudah dikirim</p>
              </div>
              <StandupCard
                standup={todayData.standup}
                canEdit={canEditStandup(todayData.standup)}
                onEdit={(s) => setModal({ open: true, data: s })}
              />
            </div>
          ) : (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold text-slate-800">
                  Standup — {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: idLocale })}
                </h2>
              </div>
              <StandupForm
                standup={null}
                onSave={async () => { await loadToday(); await loadHistory(); }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            {isManagerOrAbove && (
              <div>
                <label className="label flex items-center gap-1"><Users className="w-3 h-3" /> User</label>
                <select className="select w-44" value={filters.user_id}
                  onChange={e => handleFilterChange('user_id', e.target.value)}>
                  <option value="">Semua User</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Dari</label>
              <input type="date" className="input w-40" value={filters.date_from}
                onChange={e => handleFilterChange('date_from', e.target.value)} />
            </div>
            <div>
              <label className="label">Sampai</label>
              <input type="date" className="input w-40" value={filters.date_to}
                onChange={e => handleFilterChange('date_to', e.target.value)} />
            </div>
            {(filters.user_id || filters.date_from || filters.date_to) && (
              <button className="btn-secondary self-end"
                onClick={() => { setFilters({ user_id: '', date_from: '', date_to: '' }); setPage(1); }}>
                Reset Filter
              </button>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 self-end pb-0.5">
              Tampilkan
              <select className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs"
                value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}>
                {[10, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              baris
            </div>
          </div>

          {standups.length === 0 ? (
            <div className="card p-10 text-center text-slate-400 text-sm">Belum ada data standup</div>
          ) : (
            <div className="space-y-3">
              {pagedItems.map(s => (
                <StandupCard key={s.id} standup={s}
                  canEdit={canEditStandup(s)} onEdit={(sd) => setModal({ open: true, data: sd })} />
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>{(page-1)*perPage+1}–{Math.min(page*perPage, standups.length)} dari {standups.length}</span>
                  <div className="flex gap-1">
                    <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                      className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">‹ Prev</button>
                    <button disabled={page === totalPages} onClick={() => setPage(p => p+1)}
                      className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">Next ›</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ACHIEVEMENT TAB ── */}
      {tab === 'achievement' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Standup Achievement Bulan Ini</h2>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="text-left px-5 py-3">User</th>
                    <th className="text-center px-4 py-3">Bulan Ini</th>
                    <th className="text-center px-4 py-3">Total</th>
                    <th className="text-left px-4 py-3 min-w-[180px]">Kehadiran</th>
                    <th className="text-center px-4 py-3">Blocker</th>
                    <th className="text-left px-4 py-3">Standup Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {achievement.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-400">Tidak ada data</td></tr>
                  )}
                  {achievement.map(row => {
                    const pct = Number(row.participation_pct) || 0;
                    const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
                    const lastDate = row.last_standup
                      ? format(parseISO(String(row.last_standup).slice(0, 10)), 'dd MMM yyyy')
                      : '—';
                    return (
                      <tr key={row.user_id} className="table-row">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: row.avatar_color || '#4F46E5' }}>
                              {row.user_name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-800">{row.user_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.this_month}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{row.total_standups}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                              <div className={`h-2 rounded-full transition-all ${barColor}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-semibold w-10 text-right
                              ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                              {pct}%
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {row.this_month} / {row.working_days_this_month} hari kerja
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {Number(row.total_blockers) > 0 ? (
                            <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                              {row.total_blockers}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{lastDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT CSV TAB ── */}
      {tab === 'import' && isManagerOrAbove && (
        <StandupImport onDone={loadHistory} />
      )}

      {/* Edit modal */}
      <Modal open={modal.open} onClose={closeModal} title="Edit Standup" size="md">
        {modal.data && (
          <StandupForm standup={modal.data} onSave={async () => {
            closeModal(); await loadToday(); await loadHistory();
          }} onClose={closeModal} />
        )}
      </Modal>
    </div>
  );
}
