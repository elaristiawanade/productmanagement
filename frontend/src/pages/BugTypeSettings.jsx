import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Tag, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';
import Modal from '../components/Modal';

const COLORS = ['#E5484D', '#0B8FCB', '#D9891A', '#1F9D55', '#E8740F', '#3E63DD', '#8B5CF6', '#EC4899', '#7C8494', '#18181B'];

// Same pill the Bugs Incident table uses for the Type column
function TypePill({ name, color }) {
  return (
    <span className="status-pill h-6 px-2 gap-1.5 text-[11px]" style={{ '--c': color }}>
      <Tag className="w-3 h-3 shrink-0" />
      {name}
    </span>
  );
}

function TypeForm({ item, nextOrder, onSaved, onClose }) {
  const [form, setForm] = useState({
    name:       item?.name || '',
    color:      item?.color || COLORS[0],
    sort_order: item ? item.sort_order : nextOrder,
  });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nama Type wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), sort_order: Number(form.sort_order) || 0 };
      if (item?.id) {
        await client.put(`/bug-types/${item.id}`, payload);
        toast.success('Type diperbarui');
      } else {
        await client.post('/bug-types', payload);
        toast.success('Type ditambahkan');
      }
      onSaved();
    } catch { /* the API client already toasted the error */ } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="label">Nama Type *</label>
        <input className="input" value={form.name} maxLength={50} autoFocus
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="contoh: Change Request" required />
        {item && <p className="text-xs text-slate-400 mt-1">Mengubah nama tidak memengaruhi tiket yang sudah memakai Type ini.</p>}
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
        <p className="text-xs text-slate-400 mt-1">Angka kecil tampil lebih dulu di dropdown dan filter Type.</p>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-slate-500">Tampilan:</span>
        <TypePill name={form.name.trim() || 'Nama Type'} color={form.color} />
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : (item?.id ? 'Perbarui' : 'Tambah Type')}
        </button>
      </div>
    </form>
  );
}

export default function BugTypeSettings() {
  const [types, setTypes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState({ open: false, item: null });

  const load = useCallback(async () => {
    try {
      const { data } = await client.get('/bug-types');
      setTypes(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const closeModal = () => setModal(m => ({ ...m, open: false }));
  const afterSave = () => { closeModal(); load().catch(() => {}); };

  const remove = async (t) => {
    if (!confirm(`Hapus Type "${t.name}"?`)) return;
    try {
      await client.delete(`/bug-types/${t.id}`);
      toast.success('Type dihapus');
      load().catch(() => {});
    } catch { /* toasted: 409 explains the Type is the default or still in use */ }
  };

  if (loading) return <div className="text-sm text-slate-400">Memuat...</div>;

  const nextOrder = types.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/bugs" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Bugs Incident
        </Link>
        <h1 className="text-xl font-bold text-slate-800">Type Bug</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Atur daftar Type tiket di Bugs Incident (mis. Bug, Inquiry / Clarification, Change Request) — hanya Super Admin.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <Tag className="w-4 h-4 text-slate-700" />
            </div>
            <h2 className="font-semibold text-slate-700">Daftar Type</h2>
          </div>
          <button className="btn-primary btn-sm" onClick={() => setModal({ open: true, item: null })}>
            <Plus className="w-3.5 h-3.5" /> Tambah Type
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="text-center px-4 py-3 w-16">Urutan</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Kode</th>
              <th className="text-center px-4 py-3">Tiket</th>
              <th className="text-center px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {types.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-slate-400">Belum ada Type</td></tr>
            )}
            {types.map(t => {
              const isDefault = t.code === 'bug';
              return (
                <tr key={t.id} className="table-row">
                  <td className="px-4 py-3 text-center text-slate-500">{t.sort_order}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TypePill name={t.name} color={t.color} />
                      {isDefault && <span className="text-[10px] uppercase tracking-wide text-slate-400">default</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">{t.code}</td>
                  <td className="px-4 py-3 text-center text-slate-600 font-medium">{t.bug_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-center">
                      <button className="btn-ghost btn-sm p-1.5 rounded-lg" title="Edit"
                        onClick={() => setModal({ open: true, item: t })}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        title={isDefault ? 'Type default tidak bisa dihapus'
                          : Number(t.bug_count) > 0 ? 'Masih dipakai tiket — pindahkan tiket dulu' : 'Hapus'}
                        onClick={() => remove(t)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal.open} onClose={closeModal} size="sm" title={modal.item ? 'Edit Type' : 'Tambah Type'}>
        {modal.open && (
          <TypeForm key={modal.item?.id || 'new'} item={modal.item} nextOrder={nextOrder}
            onSaved={afterSave} onClose={closeModal} />
        )}
      </Modal>
    </div>
  );
}
