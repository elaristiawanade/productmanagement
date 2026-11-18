import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ListOrdered, ArrowLeft, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { stageMeta } from '../utils/bugStages';

const COLORS = ['#E5484D', '#0B8FCB', '#D9891A', '#1F9D55', '#E8740F', '#3E63DD', '#8B5CF6', '#EC4899', '#7C8494', '#18181B'];

// Same pill the Bugs Incident table uses for the Stage column
function StagePill({ stage }) {
  return <StatusBadge status={stage.code} meta={stageMeta(stage)} />;
}

function StageForm({ item, nextOrder, onSaved, onClose }) {
  const builtin = !!item?.is_builtin;
  const [form, setForm] = useState({
    name:       item?.name || '',
    color:      item?.color || COLORS[0],
    sort_order: item ? item.sort_order : nextOrder,
    is_closed:  !!item?.is_closed,
    not_late:   !!item?.not_late,
  });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nama Stage wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), sort_order: Number(form.sort_order) || 0 };
      if (item?.id) {
        await client.put(`/bug-stages/${item.id}`, payload);
        toast.success('Stage diperbarui');
      } else {
        await client.post('/bug-stages', payload);
        toast.success('Stage ditambahkan');
      }
      onSaved();
    } catch { /* the API client already toasted the error */ } finally { setSaving(false); }
  };

  const preview = { code: item?.code || 'new', name: form.name.trim() || 'Nama Stage', color: form.color, is_closed: form.is_closed, not_late: form.not_late };

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="label">Nama Stage *</label>
        <input className="input" value={form.name} maxLength={50} autoFocus
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="contoh: Waiting Client" required />
        {item && <p className="text-xs text-slate-400 mt-1">Mengubah nama tidak memengaruhi tiket yang sudah memakai Stage ini.</p>}
      </div>
      <div>
        <label className="label">Warna</label>
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map(c => (
            <button type="button" key={c} onClick={() => setForm(f => ({ ...f, color: c }))} aria-label={`Warna ${c}`}
              className={`w-7 h-7 rounded-full border-2 transition-all ${form.color.toLowerCase() === c.toLowerCase() ? 'border-slate-800 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
          <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            className="w-7 h-7 p-0 border border-slate-200 rounded cursor-pointer bg-transparent" aria-label="Warna lain" />
        </div>
      </div>
      <div>
        <label className="label">Urutan</label>
        <input type="number" className="input w-28" value={form.sort_order}
          onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
        <p className="text-xs text-slate-400 mt-1">Angka kecil tampil lebih dulu di dropdown, filter, dan kolom dashboard.</p>
      </div>

      <div>
        <label className="label">Perilaku</label>
        {builtin ? (
          <p className="flex items-start gap-1.5 text-xs text-slate-500 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-px" />
            Stage bawaan: perilakunya terkunci ({item.is_closed ? 'dianggap selesai' : 'tidak dianggap selesai'},
            {' '}{item.not_late ? 'Deadline tidak pernah merah' : 'Deadline bisa merah'}). Nama, warna, dan urutan boleh diubah.
          </p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={form.is_closed}
                onChange={e => setForm(f => ({ ...f, is_closed: e.target.checked, not_late: e.target.checked ? true : f.not_late }))} />
              <span>
                Dianggap selesai (Closed)
                <span className="block text-xs text-slate-400">Mengisi Tanggal Closed, ikut disembunyikan oleh “Closed/Done disembunyikan”, dan dihitung di Resolution Rate.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={form.not_late} disabled={form.is_closed}
                onChange={e => setForm(f => ({ ...f, not_late: e.target.checked }))} />
              <span>
                Tidak dihitung terlambat
                <span className="block text-xs text-slate-400">Tanggal Deadline tidak pernah berwarna merah di Stage ini{form.is_closed ? ' (otomatis untuk Stage selesai)' : ''}.</span>
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-slate-500">Tampilan:</span>
        <StagePill stage={preview} />
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : (item?.id ? 'Perbarui' : 'Tambah Stage')}
        </button>
      </div>
    </form>
  );
}

export default function BugStageSettings() {
  const [stages, setStages]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState({ open: false, item: null });

  const load = useCallback(async () => {
    try {
      const { data } = await client.get('/bug-stages');
      setStages(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const closeModal = () => setModal(m => ({ ...m, open: false }));
  const afterSave = () => { closeModal(); load().catch(() => {}); };

  const remove = async (s) => {
    if (!confirm(`Hapus Stage "${s.name}"?`)) return;
    try {
      await client.delete(`/bug-stages/${s.id}`);
      toast.success('Stage dihapus');
      load().catch(() => {});
    } catch { /* toasted: 409 explains the Stage is built-in or still in use */ }
  };

  if (loading) return <div className="text-sm text-slate-400">Memuat...</div>;

  const nextOrder = stages.reduce((m, s) => Math.max(m, s.sort_order), 0) + 1;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/bugs" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Bugs Incident
        </Link>
        <h1 className="text-xl font-bold text-slate-800">Stage Bug</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Tambahkan Stage baru untuk tiket Bugs Incident di samping Stage bawaan — hanya Super Admin.
          Stage bawaan tidak bisa dihapus dan perilakunya terkunci.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <ListOrdered className="w-4 h-4 text-slate-700" />
            </div>
            <h2 className="font-semibold text-slate-700">Daftar Stage</h2>
          </div>
          <button className="btn-primary btn-sm" onClick={() => setModal({ open: true, item: null })}>
            <Plus className="w-3.5 h-3.5" /> Tambah Stage
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="text-center px-4 py-3 w-16">Urutan</th>
              <th className="text-left px-4 py-3">Stage</th>
              <th className="text-left px-4 py-3">Kode</th>
              <th className="text-left px-4 py-3">Perilaku</th>
              <th className="text-center px-4 py-3">Tiket</th>
              <th className="text-center px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {stages.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400">Belum ada Stage</td></tr>
            )}
            {stages.map(s => (
              <tr key={s.id} className="table-row">
                <td className="px-4 py-3 text-center text-slate-500">{s.sort_order}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StagePill stage={s} />
                    {s.is_builtin && <span className="text-[10px] uppercase tracking-wide text-slate-400">bawaan</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400">{s.code}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {[s.is_closed && 'Selesai', s.not_late && 'Tidak terlambat'].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-4 py-3 text-center text-slate-600 font-medium">{s.bug_count}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-center">
                    <button className="btn-ghost btn-sm p-1.5 rounded-lg" title="Edit"
                      onClick={() => setModal({ open: true, item: s })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                      disabled={s.is_builtin}
                      title={s.is_builtin ? 'Stage bawaan tidak bisa dihapus'
                        : Number(s.bug_count) > 0 ? 'Masih dipakai tiket — pindahkan tiket dulu' : 'Hapus'}
                      onClick={() => remove(s)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal.open} onClose={closeModal} size="sm" title={modal.item ? 'Edit Stage' : 'Tambah Stage'}>
        {modal.open && (
          <StageForm key={modal.item?.id || 'new'} item={modal.item} nextOrder={nextOrder}
            onSaved={afterSave} onClose={closeModal} />
        )}
      </Modal>
    </div>
  );
}
