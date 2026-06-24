import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, AlertCircle, Link2, Paperclip, Upload, X, ImageIcon, MessageSquare, Send, FileDown } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const STATUSES   = ['backlog','todo','in_progress','in_review','done','blocked'];
const PRIORITIES = ['critical','high','medium','low'];
const TYPES      = ['story','bug','task','epic'];

function F({ label, children, required }) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

// ─── Activity / Comments Section ──────────────────────────────────────────────

function ActivitySection({ itemId }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [comment,    setComment]    = useState('');
  const [sending,    setSending]    = useState(false);
  const endRef = useRef(null);

  const load = useCallback(async () => {
    if (!itemId) return;
    try {
      const res = await client.get(`/backlog/${itemId}/activities`);
      setActivities(res.data || []);
    } catch { /**/ }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activities.length]);

  const submit = async () => {
    if (!comment.trim() || sending) return;
    setSending(true);
    try {
      await client.post(`/backlog/${itemId}/activities`, { content: comment.trim() });
      setComment('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengirim komentar');
    } finally { setSending(false); }
  };

  const handleKeyDown = (e) => {
    // Ctrl+Enter or Shift+Enter submits; plain Enter submits and stops propagation
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();  // prevent outer form submit
      submit();
    }
  };

  const deleteActivity = async (id) => {
    if (!confirm('Hapus komentar ini?')) return;
    try {
      await client.delete(`/activities/${id}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menghapus');
    }
  };

  return (
    <div className="border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" />
        Aktivitas & Komentar
      </p>
      <div className="max-h-56 overflow-y-auto space-y-2 mb-3 pr-1">
        {activities.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">Belum ada aktivitas.</p>
        )}
        {activities.map(act => (
          <div key={act.id}
            className={`flex gap-2.5 group ${act.type === 'change_log' ? 'opacity-70' : ''}`}>
            {act.type === 'change_log' ? (
              <span className="w-5 h-5 mt-0.5 rounded-full bg-slate-200 flex items-center justify-center text-xs shrink-0">⚙</span>
            ) : (
              <div className="w-5 h-5 mt-0.5 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                style={{ backgroundColor: act.user_avatar_color || '#6366f1' }}>
                {(act.user_name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {act.type === 'comment' && (
                  <span className="text-xs font-medium text-slate-700">{act.user_name || 'Unknown'}</span>
                )}
                <span className="text-xs text-slate-400">
                  {act.created_at ? formatDistanceToNow(parseISO(act.created_at), { addSuffix: true, locale: localeId }) : ''}
                </span>
                {act.type === 'comment' && (user?.id === act.user_id || user?.role === 'super_admin') && (
                  <button onClick={() => deleteActivity(act.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 ml-auto">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className={`text-xs leading-relaxed ${act.type === 'change_log' ? 'text-slate-500 italic' : 'text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5'}`}>
                {act.content}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2">
        <input
          className="input text-xs flex-1 py-1.5"
          placeholder="Tulis komentar... (Enter untuk kirim)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="btn-primary py-1.5 px-3"
          disabled={sending || !comment.trim()}
          onClick={submit}
        >
          {sending
            ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Item Form ────────────────────────────────────────────────────────────────

function ChildrenSection({ item, onOpenItem }) {
  const [children, setChildren] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const TYPE_COLORS_LOCAL = {
    story: 'text-blue-600 bg-blue-50',
    bug:   'text-red-600 bg-red-50',
    task:  'text-slate-600 bg-slate-100',
    epic:  'text-purple-600 bg-purple-50',
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/backlog', { params: { parent_id: item.id, limit: 200 } });
      setChildren(res.data.items || []);
    } catch { setChildren([]); }
    finally { setLoading(false); }
  }, [item.id]);

  useEffect(() => { load(); }, [load]);

  const sectionLabel = item.type === 'epic' ? 'Linked Stories' : 'Tasks & Bugs';

  return (
    <div className="border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {sectionLabel} <span className="font-normal normal-case text-slate-400">({children.length})</span>
      </p>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : children.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">Belum ada {sectionLabel.toLowerCase()}</p>
      ) : (
        <div className="space-y-1.5">
          {children.map(c => (
            <button key={c.id} type="button" onClick={() => onOpenItem(c)}
              className="w-full text-left px-3 py-2 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS_LOCAL[c.type] || ''}`}>{c.type}</span>
                <span className="font-mono text-xs text-slate-400 shrink-0">{c.code}</span>
                <span className="text-sm text-slate-700 truncate flex-1 group-hover:text-indigo-700">{c.title}</span>
                <StatusBadge status={c.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemForm({ item, products, users, sprints, features, epics, onSave, onClose, onOpenItem }) {
  const [form, setForm] = useState({
    product_id: item?.product_id || '',
    code: item?.code || '',
    title: item?.title || '',
    type: item?.type || 'story',
    feature_id: item?.feature_id || '',
    epic_id: item?.epic_id || '',
    parent_id: item?.parent_id || '',
    priority: item?.priority || 'medium',
    story_points: item?.story_points || 0,
    status: item?.status || 'backlog',
    sprint_id: item?.sprint_id || '',
    assignee_id: item?.assignee_id || '',
    acceptance_criteria: item?.acceptance_criteria || '',
    notes: item?.notes || '',
    deadline: item?.deadline ? item.deadline.split('T')[0] : '',
  });
  const [stories,      setStories]      = useState([]);
  const [epicsBacklog, setEpicsBacklog] = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const fileInputRef = useRef(null);

  const filteredSprints  = sprints.filter(s => s.product_id === +form.product_id);
  const filteredFeatures = features.filter(f => f.product_id === +form.product_id);
  const filteredEpics    = epics.filter(e => e.product_id === +form.product_id);

  useEffect(() => {
    if ((form.type === 'task' || form.type === 'bug') && form.product_id) {
      client.get('/backlog', { params: { product_id: form.product_id, type: 'story', limit: 200 } })
        .then(r => setStories(r.data.items || []))
        .catch(() => setStories([]));
    } else {
      setStories([]);
    }
    if (form.type === 'story' && form.product_id) {
      client.get('/backlog', { params: { product_id: form.product_id, type: 'epic', limit: 200 } })
        .then(r => setEpicsBacklog(r.data.items || []))
        .catch(() => setEpicsBacklog([]));
    } else {
      setEpicsBacklog([]);
    }
  }, [form.type, form.product_id]);

  const loadAttachments = useCallback(async () => {
    if (!item?.id) return;
    try {
      const res = await client.get(`/backlog/${item.id}/attachments`);
      setAttachments(res.data || []);
    } catch { setAttachments([]); }
  }, [item?.id]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Hanya file gambar yang diizinkan'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Ukuran file maks 10MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await client.post(`/backlog/${item.id}/attachments`, fd);
      toast.success('Gambar berhasil diunggah');
      loadAttachments();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengunggah gambar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteAttachment = async (id) => {
    if (!confirm('Hapus lampiran ini?')) return;
    try {
      await client.delete(`/attachments/${id}`);
      toast.success('Lampiran dihapus');
      loadAttachments();
    } catch { toast.error('Gagal menghapus'); }
  };

  const handleTypeChange = (e) => {
    setForm(f => ({ ...f, type: e.target.value, parent_id: '' }));
  };

  const save = async (e) => {
    e.preventDefault();
    if ((form.type === 'task' || form.type === 'bug') && !form.parent_id) {
      toast.error(`${form.type === 'task' ? 'Task' : 'Bug'} harus memiliki 1 user story sebagai parent`);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.type === 'epic') payload.parent_id = null;
      if (item?.id) {
        await client.put(`/backlog/${item.id}`, payload);
        toast.success('Item diperbarui');
      } else {
        await client.post('/backlog', payload);
        toast.success('Item ditambahkan');
      }
      onSave();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Gagal menyimpan item';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4">
      <F label="Produk" required>
        <select className="select" value={form.product_id}
          onChange={e => setForm(f => ({ ...f, product_id: e.target.value, sprint_id: '', feature_id: '', epic_id: '', parent_id: '' }))}
          required>
          <option value="">Pilih produk</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </F>
      <F label="Sprint">
        <select className="select" value={form.sprint_id} onChange={e => setForm(f => ({ ...f, sprint_id: e.target.value }))}>
          <option value="">Backlog (no sprint)</option>
          {filteredSprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </F>
      <div className="col-span-2">
        <F label="Judul" required>
          <input className="input" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required placeholder={form.type === 'story' ? 'Sebagai user saya bisa...' : form.type === 'task' ? 'Implementasi...' : ''} />
        </F>
      </div>

      <F label="Tipe">
        <select className="select" value={form.type} onChange={handleTypeChange}>
          {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </select>
      </F>
      <F label="Prioritas">
        <select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
        </select>
      </F>

      {(form.type === 'task' || form.type === 'bug') && (
        <div className="col-span-2">
          <F label="Parent User Story" required>
            <select className="select border-indigo-300 focus:border-indigo-500" value={form.parent_id}
              onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))} required>
              <option value="">— Pilih user story —</option>
              {stories.length === 0 && <option disabled value="">Tidak ada story di produk ini</option>}
              {stories.map(s => <option key={s.id} value={s.id}>{s.code} — {s.title}</option>)}
            </select>
          </F>
          <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
            <Link2 className="w-3 h-3" />{form.type === 'task' ? 'Task' : 'Bug'} harus terhubung ke tepat 1 user story
          </p>
        </div>
      )}
      {form.type === 'story' && (
        <div className="col-span-2">
          <F label="Parent Epic">
            <select className="select border-purple-300 focus:border-purple-500" value={form.parent_id}
              onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
              <option value="">— Tanpa epic (standalone story) —</option>
              {epicsBacklog.length === 0
                ? <option disabled value="">Tidak ada epic di produk ini</option>
                : epicsBacklog.map(e => <option key={e.id} value={e.id}>{e.code} — {e.title}</option>)}
            </select>
          </F>
          <p className="text-xs text-purple-500 mt-1 flex items-center gap-1">
            <Link2 className="w-3 h-3" />Story dapat dihubungkan ke satu epic
          </p>
        </div>
      )}

      <F label="Status">
        <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
      </F>
      {form.type === 'epic' ? (
        <div>
          <label className="label">
            Story Points&nbsp;<span className="text-xs font-normal text-indigo-400">(otomatis)</span>
          </label>
          <div className="input bg-slate-50 text-slate-600 flex items-center gap-2 cursor-default select-none">
            <span className="font-semibold">{form.story_points || 0}</span>
            <span className="text-xs text-slate-400">∑ dari child stories</span>
          </div>
        </div>
      ) : (
        <F label="Story Points">
          <input type="number" className="input" min="0" value={form.story_points}
            onChange={e => setForm(f => ({ ...f, story_points: +e.target.value }))} />
          {form.type === 'story' && (
            <p className="text-xs text-slate-400 mt-1">Otomatis dijumlah dari task child yang memiliki SP</p>
          )}
        </F>
      )}
      <F label="Feature">
        <select className="select" value={form.feature_id} onChange={e => setForm(f => ({ ...f, feature_id: e.target.value }))}>
          <option value="">—</option>
          {filteredFeatures.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </F>
      <F label="Epic">
        <select className="select" value={form.epic_id} onChange={e => setForm(f => ({ ...f, epic_id: e.target.value }))}>
          <option value="">—</option>
          {filteredEpics.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </F>
      <F label="Assignee">
        <select className="select" value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
          <option value="">Unassigned</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </F>
      <F label="Deadline">
        <input type="date" className="input" value={form.deadline}
          onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
      </F>
      <div className="col-span-2">
        <F label="Acceptance Criteria">
          <textarea className="input h-20 resize-none" value={form.acceptance_criteria}
            onChange={e => setForm(f => ({ ...f, acceptance_criteria: e.target.value }))}
            placeholder="• Kriteria 1&#10;• Kriteria 2" />
        </F>
      </div>
      <div className="col-span-2">
        <F label="Catatan">
          <textarea className="input h-16 resize-none" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </F>
      </div>

      {/* Attachments — only when editing existing item */}
      {item?.id && (
        <div className="col-span-2">
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                Lampiran Gambar
                {attachments.length > 0 && (
                  <span className="text-xs font-normal text-slate-400 ml-1">({attachments.length})</span>
                )}
              </label>
              <button type="button"
                className="btn-secondary text-xs py-1 px-2 flex items-center gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}>
                {uploading
                  ? <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Mengunggah...' : 'Unggah Gambar'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
            {attachments.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}>
                <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Klik untuk unggah gambar</p>
                <p className="text-xs text-slate-300 mt-0.5">JPG, PNG, GIF, WEBP • Maks 10MB</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-video">
                    <img src={`/api/attachments/file/${att.filename}`} alt={att.original_name}
                      className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button type="button" onClick={() => deleteAttachment(att.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {att.original_name}
                    </p>
                  </div>
                ))}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="aspect-video rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors flex flex-col items-center justify-center gap-1">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">Tambah</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Children (Stories for Epic, Tasks+Bugs for Story) — only when editing */}
      {item?.id && (item.type === 'epic' || item.type === 'story') && (
        <div className="col-span-2">
          <ChildrenSection item={item} onOpenItem={onOpenItem} />
        </div>
      )}

      {/* Activity + Comments — only when editing */}
      {item?.id && (
        <div className="col-span-2">
          <ActivitySection itemId={item.id} />
        </div>
      )}

      <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : (item?.id ? 'Perbarui' : 'Tambah Item')}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Backlog() {
  const { hasRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [items, setItems]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [products, setProducts] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [sprints,  setSprints]  = useState([]);
  const [features, setFeatures] = useState([]);
  const [epics,    setEpics]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState({ open: false, item: null });
  const [filters,  setFilters]  = useState({ product_id: '', sprint_id: '', status: '', priority: '', type: '', assignee_id: '', deadline_from: '', deadline_to: '', search: '' });
  const [page,     setPage]     = useState(1);
  const [perPage,  setPerPage]  = useState(30);
  const PER_PAGE = perPage;

  const load = useCallback(async () => {
    setLoading(true);
    const params = { ...filters, page, limit: PER_PAGE };
    Object.keys(params).forEach(k => !params[k] && delete params[k]);
    try {
      const [bl, pr, us, sp, ft, ep] = await Promise.all([
        client.get('/backlog', { params }),
        products.length ? null : client.get('/products'),
        users.length ? null : client.get('/users'),
        sprints.length ? null : client.get('/sprints'),
        features.length ? null : client.get('/features'),
        epics.length ? null : client.get('/epics'),
      ]);
      setItems(bl.data.items);
      setTotal(bl.data.total);
      if (pr) setProducts(pr.data);
      if (us) setUsers(us.data);
      if (sp) setSprints(sp.data);
      if (ft) setFeatures(ft.data);
      if (ep) setEpics(ep.data);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  // Auto-open item from URL ?item=123 (from notification click)
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (!itemId) return;
    client.get(`/backlog/${itemId}`).then(res => {
      setModal({ open: true, item: res.data });
    }).catch(() => {});
  }, [searchParams]);

  const deleteItem = async (id) => {
    if (!confirm('Hapus item ini?')) return;
    await client.delete(`/backlog/${id}`);
    toast.success('Item dihapus');
    load();
  };

  const quickStatus = async (id, status) => {
    await client.patch(`/backlog/${id}/status`, { status });
    load();
  };

  const TYPE_COLORS = {
    story: 'text-blue-600 bg-blue-50',
    bug:   'text-red-600 bg-red-50',
    task:  'text-slate-600 bg-slate-100',
    epic:  'text-purple-600 bg-purple-50',
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="card px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9" placeholder="Cari judul atau kode..."
            value={filters.search}
            onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
          />
        </div>
        {[
          { key: 'product_id', label: 'Produk',    opts: products.map(p => ({ v: p.id, l: p.name })) },
          { key: 'status',     label: 'Status',    opts: STATUSES.map(s => ({ v: s, l: s.replace('_',' ') })) },
          { key: 'priority',   label: 'Prioritas', opts: PRIORITIES.map(p => ({ v: p, l: p })) },
          { key: 'type',       label: 'Tipe',      opts: TYPES.map(t => ({ v: t, l: t })) },
        ].map(({ key, label, opts }) => (
          <select key={key} className="select w-auto min-w-[130px]"
            value={filters[key]}
            onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1); }}>
            <option value="">Semua {label}</option>
            {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
        {/* Assignee filter */}
        <select className="select w-auto min-w-[140px]"
          value={filters.assignee_id}
          onChange={e => { setFilters(f => ({ ...f, assignee_id: e.target.value })); setPage(1); }}>
          <option value="">Semua Assignee</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {/* Deadline range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 whitespace-nowrap">Deadline</span>
          <input type="date" className="input w-[140px] text-sm"
            value={filters.deadline_from}
            onChange={e => { setFilters(f => ({ ...f, deadline_from: e.target.value })); setPage(1); }} />
          <span className="text-xs text-slate-400">—</span>
          <input type="date" className="input w-[140px] text-sm"
            value={filters.deadline_to}
            onChange={e => { setFilters(f => ({ ...f, deadline_to: e.target.value })); setPage(1); }} />
          {(filters.deadline_from || filters.deadline_to) && (
            <button className="text-slate-400 hover:text-slate-600"
              onClick={() => { setFilters(f => ({ ...f, deadline_from: '', deadline_to: '' })); setPage(1); }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hasRole('super_admin', 'manager', 'po') && (
            <Link to="/import/jira"
              className="btn-secondary flex items-center gap-1.5 text-sm">
              <FileDown className="w-4 h-4" />
              Import Jira
            </Link>
          )}
          {hasRole('super_admin', 'manager', 'po', 'developer') && (
            <button className="btn-primary" onClick={() => setModal({ open: true, item: null })}>
              <Plus className="w-4 h-4" /> Tambah Item
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Menampilkan <strong>{items.length}</strong> dari <strong>{total}</strong> item
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              Tampilkan
              <select className="select py-0.5 text-xs w-auto"
                value={perPage}
                onChange={e => { setPerPage(+e.target.value); setPage(1); }}>
                {[10, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              baris
            </div>
            {total > PER_PAGE && (
              <div className="flex items-center gap-2">
                <button className="btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                <span className="text-sm text-slate-500">{page} / {Math.ceil(total/PER_PAGE)}</span>
                <button className="btn-secondary btn-sm" disabled={page >= Math.ceil(total/PER_PAGE)} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>
        {loading
          ? <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="text-left px-4 py-2.5 w-24">Kode</th>
                  <th className="text-left px-4 py-2.5">Judul</th>
                  <th className="text-center px-3 py-2.5 w-20">Tipe</th>
                  <th className="text-center px-3 py-2.5 w-24">Prioritas</th>
                  <th className="text-center px-3 py-2.5 w-28">Status</th>
                  <th className="text-center px-3 py-2.5 w-20">Pts</th>
                  <th className="text-left px-3 py-2.5 w-32">Produk</th>
                  <th className="text-left px-3 py-2.5 w-28">Sprint</th>
                  <th className="text-left px-3 py-2.5 w-28">Assignee</th>
                  <th className="text-left px-3 py-2.5 w-24">Deadline</th>
                  <th className="text-center px-3 py-2.5 w-16">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-12 text-slate-400">Tidak ada item ditemukan</td></tr>
                )}
                {items.map(item => (
                  <tr key={item.id} className={`table-row ${
                    item.type === 'epic'  ? 'bg-purple-50/30' :
                    item.type === 'bug'   ? 'bg-red-50/20' :
                    item.type === 'task'  ? 'bg-slate-50/50' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500 font-medium">{item.code}</span>
                      {item.is_delayed && <AlertCircle className="w-3 h-3 text-red-500 inline ml-1" />}
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className={
                        item.type === 'epic'  ? 'border-l-2 border-purple-300 pl-2' :
                        item.type === 'story' ? '' :
                        item.type === 'bug'   ? 'pl-3 border-l-2 border-red-200' :
                                                'pl-3 border-l-2 border-slate-200'
                      }>
                        {(item.type === 'task' || item.type === 'bug') && item.parent_code && (
                          <p className="text-xs text-indigo-500 flex items-center gap-1 mb-0.5">
                            <Link2 className="w-2.5 h-2.5" />{item.parent_code}
                          </p>
                        )}
                        {item.type === 'story' && item.parent_code && (
                          <p className="text-xs text-purple-500 flex items-center gap-1 mb-0.5">
                            <Link2 className="w-2.5 h-2.5" />{item.parent_code}
                          </p>
                        )}
                        <p className={`font-medium truncate ${item.type === 'epic' ? 'text-purple-700' : 'text-slate-700'}`}
                          title={item.title}>{item.title}</p>
                        {(item.feature_name || item.epic_name) && (
                          <p className="text-xs text-slate-400 truncate">{item.feature_name || item.epic_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_COLORS[item.type] || ''}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center"><PriorityBadge priority={item.priority} /></td>
                    <td className="px-3 py-3 text-center">
                      <select
                        className="text-xs border-0 bg-transparent focus:ring-0 cursor-pointer"
                        value={item.status}
                        onChange={e => quickStatus(item.id, e.target.value)}
                        disabled={!hasRole('super_admin','manager','po','developer','qa')}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-600">{item.story_points}</td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-medium" style={{ color: item.product_color }}>{item.product_code}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{item.sprint_name || '—'}</td>
                    <td className="px-3 py-3">
                      {item.assignee_name ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-medium"
                            style={{ backgroundColor: item.assignee_color || '#6366f1' }}>
                            {item.assignee_name.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-600 truncate max-w-[80px]">{item.assignee_name}</span>
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {item.deadline
                        ? <span className={item.is_delayed ? 'text-red-500 font-medium' : 'text-slate-500'}>
                            {format(parseISO(item.deadline), 'dd MMM')}
                          </span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {hasRole('super_admin','manager','po','developer') && (
                          <button className="btn-ghost btn-sm p-1 rounded" onClick={() => setModal({ open: true, item })}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasRole('super_admin','manager','po') && (
                          <button className="btn-ghost btn-sm p-1 rounded text-red-500 hover:bg-red-50" onClick={() => deleteItem(item.id)}>
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
        )}
      </div>

      <Modal open={modal.open} onClose={() => setModal({ open: false, item: null })}
        title={modal.item ? `Edit Item — ${modal.item.code}` : 'Tambah Backlog Item'} size="lg">
        <ItemForm
          item={modal.item} products={products} users={users}
          sprints={sprints} features={features} epics={epics}
          onSave={() => { setModal({ open: false, item: null }); load(); }}
          onClose={() => setModal({ open: false, item: null })}
          onOpenItem={childItem => setModal({ open: true, item: childItem })}
        />
      </Modal>
    </div>
  );
}
