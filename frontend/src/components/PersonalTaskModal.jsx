import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';
import Modal from './Modal';
import SearchableSelect from './SearchableSelect';
import OpenLinkButton from './OpenLinkButton';
import { STATUS_MAP } from './StatusBadge';

// Statuses a personal task can have: the Backlog ones minus `backlog` (a personal task is never "not planned yet").
export const PERSONAL_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'blocked'];

const EMPTY = { title: '', product_id: '', backlog_item_id: '', status: 'todo', deadline: '', notes: '' };

// "Add Task" on My Task: a task for yourself. It belongs to one of your products and may RELATE to a Backlog item
// (a reference only; the item is not changed or converted). Picking a related item locks the product to its product.
// `task` = an existing personal task to edit, or null to create. onSaved(task) / onDeleted(id) let the page update
// its list without a reload.
export default function PersonalTaskModal({ open, task, onClose, onSaved, onDeleted }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const savedForm = useRef(JSON.stringify(EMPTY));   // the form as opened, to spot unsaved edits

  useEffect(() => {
    if (!open) return;
    const initial = task ? {
      title: task.title || '',
      product_id: task.product_id ? String(task.product_id) : '',
      backlog_item_id: task.backlog_item_id ? String(task.backlog_item_id) : '',
      status: task.status || 'todo',
      deadline: task.deadline ? String(task.deadline).slice(0, 10) : '',
      notes: task.notes || '',
    } : EMPTY;
    setForm(initial);
    savedForm.current = JSON.stringify(initial);
    // Same list as the sidebar's Planning products: only the products this user has access to.
    client.get('/products').then(r => {
      const list = r.data || [];
      setProducts(list);
      if (!task && list.length === 1) setForm(f => ({ ...f, product_id: String(list[0].id) }));
    }).catch(() => {});
  }, [open, task]);

  // Backlog items of the chosen product, for the optional relation.
  useEffect(() => {
    if (!open || !form.product_id) { setItems([]); return; }
    let alive = true;
    client.get('/backlog', { params: { product_id: form.product_id, limit: 500 } })
      .then(r => { if (alive) setItems(r.data.items || []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [open, form.product_id]);

  const productOptions = useMemo(() => products.map(p => ({ value: String(p.id), label: p.name })), [products]);
  const itemOptions = useMemo(() => items.map(i => ({
    value: String(i.id),
    label: `${i.code} · ${i.title}`,
    badge: { text: i.type, className: 'bg-slate-100 text-slate-600' },
  })), [items]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const changeProduct = (v) => setForm(f => ({ ...f, product_id: v, backlog_item_id: '' }));

  // "Buka" beside the related item: the saved relation only (a changed, unsaved pick would point at the old item).
  // Leaving the page drops unsaved edits, so ask first.
  const showItemButton = !!task?.backlog_item_id && !!task.related_code && form.backlog_item_id === String(task.backlog_item_id);
  const openRelated = () => {
    if (JSON.stringify(form) !== savedForm.current && !window.confirm('Perubahan yang belum disimpan akan hilang. Lanjutkan?')) return;
    onClose();
    navigate(`/backlog?item=${task.backlog_item_id}`);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Judul task wajib diisi'); return; }
    if (!form.product_id) { toast.error('Produk wajib dipilih'); return; }
    setSaving(true);
    const body = {
      title: form.title.trim(),
      product_id: Number(form.product_id),
      backlog_item_id: form.backlog_item_id ? Number(form.backlog_item_id) : null,
      status: form.status,
      deadline: form.deadline || null,
      notes: form.notes.trim() || null,
    };
    try {
      const res = task?.id
        ? await client.put(`/personal-tasks/${task.id}`, body)
        : await client.post('/personal-tasks', body);
      toast.success(task?.id ? 'Task diperbarui' : 'Task ditambahkan');
      onSaved?.(res.data);
      onClose();
    } catch { /* the API client already shows the error */ } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!task?.id || !window.confirm(`Hapus task "${task.title}"?`)) return;
    setSaving(true);
    try {
      await client.delete(`/personal-tasks/${task.id}`);
      toast.success('Task dihapus');
      onDeleted?.(task.id);
      onClose();
    } catch { /* toast shown by the API client */ } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={task?.id ? 'Edit Task' : 'Add Task'} size="sm">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">Judul *</label>
          <input className="input" value={form.title} onChange={e => set('title', e.target.value)} maxLength={300}
            placeholder="Apa yang mau dikerjakan?" autoFocus required />
        </div>
        <div>
          <label className="label">Produk *</label>
          <SearchableSelect value={form.product_id} onChange={changeProduct} options={productOptions}
            placeholder="Pilih produk..." searchPlaceholder="Cari produk..." emptyMessage="Tidak ada produk" />
        </div>
        <div>
          <label className="label">Item Backlog terkait <span className="font-normal text-slate-400">(opsional)</span></label>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <SearchableSelect value={form.backlog_item_id} onChange={v => set('backlog_item_id', v)} options={itemOptions}
                disabled={!form.product_id} placeholder={form.product_id ? 'Tidak ada' : 'Pilih produk dulu'}
                searchPlaceholder="Cari kode atau judul..." emptyOptionLabel="— Tidak ada —"
                emptyMessage="Produk ini belum punya item Backlog" />
            </div>
            {showItemButton && (
              <OpenLinkButton href={`/backlog?item=${task.backlog_item_id}`} onOpen={openRelated}
                code={task.related_code} title={`Buka di Backlog: ${task.related_code} — ${task.related_title || ''}`} />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
              {PERSONAL_STATUSES.map(s => <option key={s} value={s}>{STATUS_MAP[s]?.label ?? s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Deadline</label>
            <input type="date" className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Catatan</label>
          <textarea className="input h-20 resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <p className="flex gap-1.5 text-[11.5px] text-slate-500 leading-snug">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          Task pribadi tampil di My Task Anda dan di Management Dashboard; judulnya juga tampil di detail item Backlog
          terkait. Tidak masuk Backlog, sprint, atau progress produk; item terkait hanya dijadikan rujukan.
        </p>
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          {task?.id && (
            <button type="button" className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={remove} disabled={saving}>
              <Trash2 className="w-3.5 h-3.5" /> Hapus
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : (task?.id ? 'Perbarui' : 'Tambah')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
