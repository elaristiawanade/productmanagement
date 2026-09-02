import { useEffect, useState, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Plus, Pencil, Trash2, Wrench, Bug as BugIcon, CheckCircle2, ShieldCheck, XCircle, AlertCircle, Paperclip, Upload, Image as ImageIcon, X, MessageSquare, Send } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import LinkInsertButton from '../components/LinkInsertButton';
import { renderWithLinks } from '../utils/linkify';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const STAGE_ICONS = {
  open:        { icon: AlertCircle,  cls: 'text-red-500'    },
  in_progress: { icon: Wrench,       cls: 'text-blue-500'   },
  fixed:       { icon: CheckCircle2, cls: 'text-teal-500'   },
  verified:    { icon: ShieldCheck,  cls: 'text-cyan-500'   },
  closed:      { icon: XCircle,      cls: 'text-slate-400'  },
};

// ─── Activity / Comments Section ──────────────────────────────────────────────

function renderComment(text) {
  return text.split(/(@\[[^\]]+\])/g).map((part, i) => {
    if (part.startsWith('@[') && part.endsWith(']')) {
      return (
        <span key={i} className="inline-flex items-center gap-0.5 text-indigo-600 font-medium bg-indigo-50 rounded px-1">
          @{part.slice(2, -1)}
        </span>
      );
    }
    return <span key={i}>{renderWithLinks(part, `c${i}`)}</span>;
  });
}

function ActivitySection({ bugId, users = [] }) {
  const { user } = useAuth();
  const [activities,   setActivities]  = useState([]);
  const [comment,      setComment]     = useState('');
  const [sending,      setSending]     = useState(false);
  const [mentionOpen,  setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery]= useState('');
  const [mentionStart, setMentionStart]= useState(-1);
  const [mentionIdx,   setMentionIdx]  = useState(0);
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    if (!bugId) return;
    try {
      const res = await client.get(`/bugs/${bugId}/activities`);
      setActivities(res.data || []);
    } catch { /**/ }
  }, [bugId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activities.length]);

  const submit = async () => {
    if (!comment.trim() || sending) return;
    setSending(true);
    try {
      await client.post(`/bugs/${bugId}/activities`, { content: comment.trim() });
      setComment('');
      setMentionOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengirim komentar');
    } finally { setSending(false); }
  };

  const mentionSuggestions = users
    .filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 6);

  const selectMention = (name) => {
    const before = comment.slice(0, mentionStart);
    const after  = comment.slice(mentionStart + 1 + mentionQuery.length);
    const next   = before + `@[${name}]` + after;
    setComment(next);
    setMentionOpen(false);
    setMentionQuery('');
    setTimeout(() => {
      const pos = (before + `@[${name}]`).length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleCommentChange = (e) => {
    const val    = e.target.value;
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atIdx  = before.lastIndexOf('@');
    const query  = atIdx !== -1 ? before.slice(atIdx + 1) : '';

    if (atIdx !== -1 && !query.includes(' ') && !query.includes('\n')) {
      setMentionStart(atIdx);
      setMentionQuery(query);
      setMentionOpen(true);
      setMentionIdx(0);
    } else {
      setMentionOpen(false);
    }
    setComment(val);
  };

  const handleKeyDown = (e) => {
    if (mentionOpen && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionSuggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && mentionOpen)) {
        e.preventDefault();
        selectMention(mentionSuggestions[mentionIdx].name);
        return;
      }
      if (e.key === 'Escape') { setMentionOpen(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  };

  const deleteActivity = async (id) => {
    if (!confirm('Hapus komentar ini?')) return;
    try {
      await client.delete(`/bugs/activities/${id}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menghapus');
    }
  };

  const insertLink = (snippet) => {
    const el  = inputRef.current;
    const pos = el ? (el.selectionStart ?? comment.length) : comment.length;
    const before = comment.slice(0, pos);
    const after  = comment.slice(pos);
    const next = `${before}${snippet}${after}`;
    setComment(next);
    setTimeout(() => {
      const newPos = (before + snippet).length;
      el?.focus();
      el?.setSelectionRange(newPos, newPos);
    }, 0);
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
                {act.type === 'change_log' ? act.content : renderComment(act.content)}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input area */}
      <div className="relative flex gap-2">
        {/* Mention dropdown */}
        {mentionOpen && mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1.5 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
            <p className="text-[10px] text-slate-400 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">Mention pengguna</p>
            {mentionSuggestions.map((u, i) => (
              <button key={u.id} type="button"
                className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${i === mentionIdx ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                onMouseDown={e => { e.preventDefault(); selectMention(u.name); }}>
                <span className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                  style={{ backgroundColor: u.avatar_color || '#6366f1' }}>
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{u.name}</span>
              </button>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          className="input text-xs flex-1 py-1.5"
          placeholder="Tulis komentar... ketik @ untuk mention (Enter kirim)"
          value={comment}
          onChange={handleCommentChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
        />
        <LinkInsertButton onInsert={insertLink} />
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

function BugForm({ bug, products, backlogItems, users, onSave, onClose }) {
  const [form, setForm] = useState({
    product_id: bug?.product_id || '', backlog_item_id: bug?.backlog_item_id || '',
    title: bug?.title || '', description: bug?.description || '',
    steps_to_reproduce: bug?.steps_to_reproduce || '',
    severity: bug?.severity || 'medium', priority: bug?.priority || 'medium',
    assigned_to: bug?.assigned_to || '',
  });
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const filteredItems = backlogItems.filter(b => !form.product_id || b.product_id === +form.product_id);

  useEffect(() => {
    if (!previewImage) return;
    const handler = (e) => { if (e.key === 'Escape') setPreviewImage(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [previewImage]);

  const loadAttachments = useCallback(async () => {
    if (!bug?.id) return;
    try {
      const res = await client.get(`/bugs/${bug.id}/attachments`);
      setAttachments(res.data || []);
    } catch { setAttachments([]); }
  }, [bug?.id]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  // Revoke local object URLs for queued (not-yet-uploaded) images on unmount only.
  const pendingFilesRef = useRef(pendingFiles);
  pendingFilesRef.current = pendingFiles;
  useEffect(() => () => { pendingFilesRef.current.forEach(p => URL.revokeObjectURL(p.url)); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Hanya file gambar yang diizinkan'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Ukuran file maks 10MB'); return; }
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Bug belum dibuat: simpan gambar sementara, unggah setelah bug tersimpan.
    if (!bug?.id) {
      setPendingFiles(pf => [...pf, { file, url: URL.createObjectURL(file), name: file.name }]);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await client.post(`/bugs/${bug.id}/attachments`, fd);
      toast.success('Gambar berhasil diunggah');
      loadAttachments();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengunggah gambar');
    } finally {
      setUploading(false);
    }
  };

  const removePendingFile = (idx) => {
    setPendingFiles(pf => {
      URL.revokeObjectURL(pf[idx].url);
      return pf.filter((_, i) => i !== idx);
    });
  };

  const deleteAttachment = async (id) => {
    if (!confirm('Hapus lampiran ini?')) return;
    try {
      await client.delete(`/attachments/${id}`);
      toast.success('Lampiran dihapus');
      loadAttachments();
    } catch { toast.error('Gagal menghapus'); }
  };

  const uploadPendingFiles = async (newBugId) => {
    for (const p of pendingFiles) {
      try {
        const fd = new FormData();
        fd.append('file', p.file);
        await client.post(`/bugs/${newBugId}/attachments`, fd);
      } catch {
        toast.error(`Gagal mengunggah ${p.name}`);
      } finally {
        URL.revokeObjectURL(p.url);
      }
    }
  };

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (bug?.id) {
        await client.put(`/bugs/${bug.id}`, form);
        toast.success('Bug diperbarui');
      } else {
        const res = await client.post('/bugs', form);
        if (pendingFiles.length) await uploadPendingFiles(res.data.id);
        toast.success('Bug dibuat');
      }
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
        <label className="label">Backlog Item (opsional)</label>
        <select className="select" value={form.backlog_item_id} onChange={e => setForm(f => ({ ...f, backlog_item_id: e.target.value }))}>
          <option value="">— Tidak terkait —</option>
          {filteredItems.map(b => <option key={b.id} value={b.id}>[{b.code}] {b.title}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Judul Bug *</label>
        <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
      </div>
      <div className="col-span-2">
        <label className="label">Deskripsi</label>
        <textarea className="input h-16 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="col-span-2">
        <label className="label">Langkah Reproduksi</label>
        <textarea className="input h-24 resize-none font-mono text-xs" value={form.steps_to_reproduce} onChange={e => setForm(f => ({ ...f, steps_to_reproduce: e.target.value }))} placeholder="1. Buka halaman...\n2. Klik tombol...\n3. Bug muncul..." />
      </div>
      <div>
        <label className="label">Severity</label>
        <select className="select" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
          {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Prioritas</label>
        <select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
          {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Assigned To</label>
        <select className="select" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
          <option value="">— Belum ditugaskan —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      {/* Attachments — queued locally until the bug is created, uploaded live once it exists */}
      <div className="col-span-2">
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="label mb-0 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
              Lampiran Gambar
              {(bug?.id ? attachments.length : pendingFiles.length) > 0 && (
                <span className="text-xs font-normal text-slate-400 ml-1">({bug?.id ? attachments.length : pendingFiles.length})</span>
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
          {!bug?.id && (
            <p className="text-xs text-slate-400 -mt-2 mb-3">Gambar akan diunggah setelah bug disimpan.</p>
          )}
          {(bug?.id ? attachments.length : pendingFiles.length) === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Klik untuk unggah gambar</p>
              <p className="text-xs text-slate-300 mt-0.5">JPG, PNG, GIF, WEBP • Maks 10MB</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {bug?.id
                ? attachments.map(att => (
                    <div key={att.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-video cursor-pointer"
                      onClick={() => setPreviewImage({ url: `/api/attachments/file/${att.filename}`, name: att.original_name })}>
                      <img src={`/api/attachments/file/${att.filename}`} alt={att.original_name}
                        className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <button type="button" onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {att.original_name}
                      </p>
                    </div>
                  ))
                : pendingFiles.map((p, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-video cursor-pointer"
                      onClick={() => setPreviewImage({ url: p.url, name: p.name })}>
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <button type="button" onClick={(e) => { e.stopPropagation(); removePendingFile(idx); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.name}
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

      {bug?.id && (
        <div className="col-span-2">
          <ActivitySection bugId={bug.id} users={users} />
        </div>
      )}

      <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : (bug?.id ? 'Perbarui' : 'Buat Bug')}</button>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewImage(null)}>
          <button type="button" onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2">
            <X className="w-5 h-5" />
          </button>
          <img src={previewImage.url} alt={previewImage.name}
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </form>
  );
}

function BugProgressForm({ bug, onSave, onClose }) {
  const [form, setForm] = useState({ bug_id: bug.id, stage: bug.stage || 'open', note: '' });
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await client.post('/bugs/progress', form);
      toast.success('Progress disimpan');
      onSave();
    } catch {} finally { setSaving(false); }
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <p className="text-sm text-slate-500 mb-3">Bug: <strong className="text-slate-700">{bug.title}</strong></p>
      </div>
      <div>
        <label className="label">Stage *</label>
        <div className="grid grid-cols-5 gap-2">
          {['open','in_progress','fixed','verified','closed'].map(s => (
            <button type="button" key={s} onClick={() => setForm(f => ({ ...f, stage: s }))}
              className={`py-2 rounded-lg text-xs font-medium border transition-all
                ${form.stage === s ? 'ring-2 ring-indigo-400 border-indigo-400' : 'border-slate-200 hover:bg-slate-50'}`}>
              {s.replace('_',' ')}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Catatan</label>
        <textarea className="input h-20 resize-none" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Update progress perbaikan..." />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Progress'}</button>
      </div>
    </form>
  );
}

export default function BugsIncident() {
  const { hasRole, hasPermission } = useAuth();
  const canAccess = hasRole('super_admin') || hasPermission('access_bugs');

  const [tab,          setTab]         = useState('dashboard');
  const [products,     setProducts]    = useState([]);
  const [bugs,         setBugs]        = useState([]);
  const [progress,     setProgress]    = useState([]);
  const [backlogItems, setBacklogItems] = useState([]);
  const [users,        setUsers]       = useState([]);
  const [dashboard,    setDashboard]   = useState(null);
  const [filters,      setFilters]     = useState({ product_id: '' });
  const [modal,        setModal]       = useState({ open: false, type: '', data: null });
  const [loading,      setLoading]     = useState(true);
  const [perPageBugs,     setPerPageBugs]     = useState(10);
  const [pageBugs,        setPageBugs]        = useState(1);
  const [perPageProgress, setPerPageProgress] = useState(10);
  const [pageProgress,    setPageProgress]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filters.product_id ? { product_id: filters.product_id } : {};
      const [pr, bg, pg, bl, us, db] = await Promise.all([
        products.length ? null : client.get('/products'),
        client.get('/bugs',          { params }),
        client.get('/bugs/progress', { params }),
        backlogItems.length ? null : client.get('/backlog', { params: { limit: 500 } }),
        users.length ? null : client.get('/users'),
        client.get('/bugs/dashboard', { params }),
      ]);
      if (pr) setProducts(pr.data);
      setBugs(bg.data);
      setProgress(pg.data);
      if (bl) setBacklogItems(bl.data.items);
      if (us) setUsers(us.data);
      setDashboard(db.data);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => { if (canAccess) load(); }, [load, canAccess]);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400 text-sm">Anda tidak memiliki akses ke modul Bugs Incident.</p>
      </div>
    );
  }

  const deleteBug = async (id) => {
    if (!confirm('Hapus bug ini?')) return;
    await client.delete(`/bugs/${id}`);
    toast.success('Bug dihapus'); load();
  };

  const csvEscape = (val) => {
    const s = val === null || val === undefined ? '' : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportBugsCSV = () => {
    const headers = ['Kode', 'Judul', 'Deskripsi', 'Langkah Reproduksi', 'Severity', 'Prioritas', 'Stage', 'Backlog Item', 'Produk', 'Assigned To', 'Reported By', 'Dibuat'];
    const rows = bugs.map(b => [
      b.code, b.title, b.description, b.steps_to_reproduce, b.severity, b.priority, b.stage,
      b.item_code ? `[${b.item_code}] ${b.item_title || ''}` : '',
      b.product_code || b.product_name || '',
      b.assigned_to_name || '',
      b.reported_by_name || '',
      b.created_at ? format(parseISO(b.created_at), 'yyyy-MM-dd HH:mm') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bugs_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const STAGE_COLORS = { open: '#ef4444', in_progress: '#3b82f6', fixed: '#14b8a6', verified: '#06b6d4', closed: '#94a3b8' };
  const summary = dashboard?.summary || {};

  const totalPagesBugs     = Math.max(1, Math.ceil(bugs.length / perPageBugs));
  const pagedBugs          = bugs.slice((pageBugs - 1) * perPageBugs, pageBugs * perPageBugs);
  const totalPagesProgress = Math.max(1, Math.ceil(progress.length / perPageProgress));
  const pagedProgress      = progress.slice((pageProgress - 1) * perPageProgress, pageProgress * perPageProgress);

  const handlePerPageBugs     = (v) => { setPerPageBugs(v);     setPageBugs(1); };
  const handlePerPageProgress = (v) => { setPerPageProgress(v); setPageProgress(1); };

  const stagePieData = (dashboard?.byStage || [])
    .map(s => ({ name: s.stage, value: +s.count || 0, color: STAGE_COLORS[s.stage] || '#94a3b8' }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {/* Tabs + Filter */}
      <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 pb-0">
        <div className="flex gap-2">
          {[['dashboard','Bugs Dashboard'],['bugs','Bugs'],['progress','Progress']].map(([id, label]) => (
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
                  { label: 'Total Bugs',     value: summary.total_bugs },
                  { label: 'Open',           value: summary.open_count },
                  { label: 'Fixed',          value: summary.fixed_count },
                  { label: 'Resolution Rate', value: `${summary.resolution_rate || 0}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="card p-4">
                    <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* By Product */}
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-700 mb-4">Bugs per Produk</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dashboard?.byProduct || []} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="product" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="open_count"   name="Open"   fill="#ef4444" radius={[4,4,0,0]} />
                      <Bar dataKey="closed_count" name="Closed" fill="#94a3b8" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Stage Distribution */}
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-700 mb-4">Distribusi Stage</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={stagePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                        {stagePieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <BugIcon className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-slate-700">Recent Activity</h3>
                  <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{dashboard?.recentActivity?.length || 0}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {dashboard?.recentActivity?.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">Belum ada aktivitas terkini</p>}
                  {dashboard?.recentActivity?.map(a => (
                    <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                      <BugIcon className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{a.bug_title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">[{a.bug_code}] · {a.product} · oleh {a.updated_by_name || '—'} → <StatusBadge status={a.stage} size="xs" /></p>
                        {a.note && <p className="text-xs text-slate-600 mt-1 italic">{a.note}</p>}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{a.created_at ? format(parseISO(a.created_at), 'dd MMM HH:mm') : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BUGS TAB */}
          {tab === 'bugs' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                {canAccess && (
                  <button className="btn-primary" onClick={() => setModal({ open: true, type: 'bug', data: null })}>
                    <Plus className="w-4 h-4" /> Buat Bug
                  </button>
                )}
              </div>
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-xs text-slate-500">{bugs.length} bug</span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    Tampilkan
                    <select className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs"
                      value={perPageBugs} onChange={e => handlePerPageBugs(+e.target.value)}>
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
                        <th className="text-center px-3 py-3">Severity</th>
                        <th className="text-center px-3 py-3">Prioritas</th>
                        <th className="text-center px-3 py-3">Stage</th>
                        <th className="text-left px-3 py-3">Assigned To</th>
                        <th className="text-left px-3 py-3">Produk</th>
                        <th className="text-center px-3 py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedBugs.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-slate-400">Belum ada bug</td></tr>}
                      {pagedBugs.map(b => (
                        <tr key={b.id} className="table-row">
                          <td className="px-4 py-3"><span className="font-mono text-xs text-slate-500">{b.code}</span></td>
                          <td className="px-4 py-3 max-w-[220px]">
                            <p className="font-medium text-slate-700 truncate">{b.title}</p>
                            {b.description && <p className="text-xs text-slate-400 truncate">{b.description}</p>}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {b.item_code ? <><span className="font-mono text-slate-400">[{b.item_code}]</span> {b.item_title?.slice(0,30)}</> : '—'}
                          </td>
                          <td className="px-3 py-3 text-center"><PriorityBadge priority={b.severity} /></td>
                          <td className="px-3 py-3 text-center"><PriorityBadge priority={b.priority} /></td>
                          <td className="px-3 py-3 text-center"><StatusBadge status={b.stage} /></td>
                          <td className="px-3 py-3 text-xs text-slate-500">{b.assigned_to_name || '—'}</td>
                          <td className="px-3 py-3 text-xs text-slate-500">{b.product_code}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 justify-center">
                              {canAccess && (
                                <button className="btn-ghost btn-sm p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Update Progress"
                                  onClick={() => setModal({ open: true, type: 'progress', data: b })}>
                                  <Wrench className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canAccess && (
                                <button className="btn-ghost btn-sm p-1.5 rounded-lg" onClick={() => setModal({ open: true, type: 'bug', data: b })}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canAccess && (
                                <button className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50" onClick={() => deleteBug(b.id)}>
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
                {totalPagesBugs > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
                    <span>{(pageBugs-1)*perPageBugs+1}–{Math.min(pageBugs*perPageBugs, bugs.length)} dari {bugs.length}</span>
                    <div className="flex gap-1">
                      <button disabled={pageBugs === 1} onClick={() => setPageBugs(p => p-1)}
                        className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">‹ Prev</button>
                      <button disabled={pageBugs === totalPagesBugs} onClick={() => setPageBugs(p => p+1)}
                        className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">Next ›</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROGRESS TAB */}
          {tab === 'progress' && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">{progress.length} update progress</span>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  Tampilkan
                  <select className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs"
                    value={perPageProgress} onChange={e => handlePerPageProgress(+e.target.value)}>
                    {[10, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  baris
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="text-left px-4 py-3">Bug</th>
                      <th className="text-left px-3 py-3">Item</th>
                      <th className="text-center px-3 py-3">Stage</th>
                      <th className="text-left px-3 py-3">Updated By</th>
                      <th className="text-left px-3 py-3">Catatan</th>
                      <th className="text-left px-3 py-3">Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProgress.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-slate-400">Belum ada update progress</td></tr>}
                    {pagedProgress.map(p => {
                      const si = STAGE_ICONS[p.stage] || STAGE_ICONS.open;
                      const Icon = si.icon;
                      return (
                        <tr key={p.id} className="table-row">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-700 text-xs">{p.bug_title}</p>
                              <p className="text-xs text-slate-400 font-mono">{p.bug_code}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {p.item_code ? (<><span className="font-mono">[{p.item_code}]</span><span className="ml-1 text-slate-600 truncate max-w-[120px] inline-block align-bottom">{p.item_title?.slice(0,25)}</span></>) : '—'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1.5 justify-center">
                              <Icon className={`w-4 h-4 ${si.cls}`} />
                              <StatusBadge status={p.stage} />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">{p.updated_by_name || '—'}</td>
                          <td className="px-3 py-3 text-xs text-slate-500 max-w-[160px] truncate">{p.note || '—'}</td>
                          <td className="px-3 py-3 text-xs text-slate-400">
                            {p.created_at ? format(parseISO(p.created_at), 'dd MMM HH:mm') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPagesProgress > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>{(pageProgress-1)*perPageProgress+1}–{Math.min(pageProgress*perPageProgress, progress.length)} dari {progress.length}</span>
                  <div className="flex gap-1">
                    <button disabled={pageProgress === 1} onClick={() => setPageProgress(p => p-1)}
                      className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">‹ Prev</button>
                    <button disabled={pageProgress === totalPagesProgress} onClick={() => setPageProgress(p => p+1)}
                      className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">Next ›</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <Modal open={modal.open && modal.type === 'bug'} onClose={() => setModal({ ...modal, open: false })}
        title={modal.data ? 'Edit Bug' : 'Buat Bug'} size="lg">
        <BugForm bug={modal.data} products={products} backlogItems={backlogItems} users={users}
          onSave={() => { setModal({ ...modal, open: false }); load(); }}
          onClose={() => setModal({ ...modal, open: false })} />
      </Modal>

      <Modal open={modal.open && modal.type === 'progress'} onClose={() => setModal({ ...modal, open: false })}
        title="Update Progress" size="sm">
        {modal.data && <BugProgressForm bug={modal.data}
          onSave={() => { setModal({ ...modal, open: false }); load(); }}
          onClose={() => setModal({ ...modal, open: false })} />}
      </Modal>
    </div>
  );
}
