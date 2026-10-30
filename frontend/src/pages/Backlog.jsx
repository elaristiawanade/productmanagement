import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, AlertCircle, Link2, Paperclip, Upload, X, ImageIcon, MessageSquare, Send, FileDown, ChevronDown, Check, FileText, FileSpreadsheet, Presentation, Archive, File as FileIcon, ExternalLink, List, Columns3, Layers, Zap } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/Modal';
import StatusBadge, { StatusIcon, STATUS_MAP } from '../components/StatusBadge';
import PriorityBadge, { PriorityFlag } from '../components/PriorityBadge';
import StatusMenu from '../components/StatusMenu';

const StatusMenuButton = (props) => <StatusMenu statuses={STATUSES} {...props} />;
import LinkInsertButton from '../components/LinkInsertButton';
import SearchableSelect from '../components/SearchableSelect';
import SearchableMultiSelect from '../components/SearchableMultiSelect';
import AssigneeStack from '../components/AssigneeStack';
import { renderWithLinks } from '../utils/linkify';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const STATUSES   = ['backlog','todo','in_progress','in_review','done','blocked'];
const PRIORITIES = ['critical','high','medium','low'];
const TYPES      = ['story','bug','task','epic','independent'];

// Filled type tags (story blue, task grey, bug red, epic purple, independent orange)
const TYPE_TAG = {
  story:       'text-blue-700 bg-blue-100',
  bug:         'text-red-700 bg-red-100',
  task:        'text-slate-600 bg-slate-200/70',
  epic:        'text-purple-700 bg-purple-100',
  independent: 'text-orange-700 bg-orange-100',
};

function TypeTag({ type }) {
  return <span className={`shrink-0 text-[11px] font-medium leading-5 px-1.5 rounded ${TYPE_TAG[type] || TYPE_TAG.task}`}>{type}</span>;
}


// ─── Backlog attachments ───────────────────────────────────────────────────
const ATTACHMENT_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.csv,.txt';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ...IMAGE_EXTENSIONS, '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.csv', '.txt',
];

function fileExt(name = '') {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function isImageAttachment(att) {
  if (att.mime_type?.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.includes(fileExt(att.original_name || att.filename));
}

// Formats we can render inline without a document-viewer library: PDF has a native
// browser renderer, TXT/CSV are just fetched as text. Everything else (docx/xlsx/zip/…)
// falls back to opening/downloading in a new tab.
function previewKindOf(att) {
  const ext = fileExt(att.original_name || att.filename);
  if (ext === '.pdf') return 'pdf';
  if (ext === '.txt') return 'txt';
  if (ext === '.csv') return 'csv';
  return null;
}

function parseCsvSimple(text) {
  return text.replace(/\r\n/g, '\n').replace(/﻿/, '').split('\n')
    .filter(line => line.length > 0)
    .map(line => line.split(','));
}

function AttachmentIcon({ att, className }) {
  const ext = fileExt(att.original_name || att.filename);
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return <FileSpreadsheet className={className} />;
  if (['.ppt', '.pptx'].includes(ext)) return <Presentation className={className} />;
  if (ext === '.zip') return <Archive className={className} />;
  if (['.pdf', '.doc', '.docx', '.txt'].includes(ext)) return <FileText className={className} />;
  return <FileIcon className={className} />;
}

function F({ label, children, required }) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

// ─── Multi-select filter dropdown ─────────────────────────────────────────────

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
        className={`chip w-full justify-between ${count ? 'chip-on' : ''}`}>
        <span className="truncate capitalize">{buttonLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-pop p-1 max-h-64 overflow-y-auto">
          {count > 0 && (
            <button type="button" onClick={() => onChange([])}
              className="w-full text-left px-2 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 mb-1">
              Bersihkan pilihan
            </button>
          )}
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">Tidak ada opsi</p>
          )}
          {options.map(o => {
            const on = selected.includes(o.v);
            return (
              <button key={o.v} type="button" onClick={() => toggle(o.v)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-slate-700 transition-colors hover:bg-slate-100">
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

function ActivitySection({ itemId, users = [] }) {
  const { user, can } = useAuth();
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
      await client.delete(`/activities/${id}`);
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
                {act.type === 'comment' && (user?.id === act.user_id || can('backlog', 'delete')) && (
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

// ─── Item Form ────────────────────────────────────────────────────────────────

function ChildrenSection({ item, onOpenItem }) {
  const [children, setChildren] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const TYPE_COLORS_LOCAL = TYPE_TAG;

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
              className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS_LOCAL[c.type] || ''}`}>{c.type}</span>
                <span className="font-mono text-xs text-slate-400 shrink-0">{c.code}</span>
                <span className="text-sm text-slate-800 truncate flex-1 group-hover:underline underline-offset-2">{c.title}</span>
                <StatusBadge status={c.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemForm({ item, defaults, products, users, sprints, features, epics, onSave, onClose, onOpenItem }) {
  const [form, setForm] = useState({
    product_id: item?.product_id || '',
    code: item?.code || '',
    title: item?.title || '',
    type: item?.type || 'story',
    feature_id: item?.feature_id || '',
    parent_id: item?.parent_id || '',
    priority: item?.priority || 'medium',
    story_points: item?.story_points || 0,
    estimated_hours: item?.estimated_hours || '',
    // defaults.status: "+" on a status group/column pre-selects that status for a new item
    status: item?.status || defaults?.status || 'backlog',
    sprint_id: item?.sprint_id || '',
    assignee_ids: (item?.assignees || []).map(a => a.id),
    acceptance_criteria: item?.acceptance_criteria || '',
    notes: item?.notes || '',
    deadline: item?.deadline ? item.deadline.split('T')[0] : '',
  });
  const [stories,      setStories]      = useState([]);
  const [epicsBacklog, setEpicsBacklog] = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewDoc,   setPreviewDoc]   = useState(null); // { att, kind: 'pdf'|'txt'|'csv' }
  const [docContent,   setDocContent]   = useState('');
  const [docLoading,   setDocLoading]   = useState(false);
  const fileInputRef = useRef(null);
  const notesRef     = useRef(null);

  useEffect(() => {
    if (!previewDoc || previewDoc.kind === 'pdf') { setDocContent(''); return; }
    setDocLoading(true);
    fetch(`/api/attachments/file/${previewDoc.att.filename}`)
      .then(r => r.text())
      .then(setDocContent)
      .catch(() => setDocContent('Gagal memuat isi file.'))
      .finally(() => setDocLoading(false));
  }, [previewDoc]);

  useEffect(() => {
    if (!previewImage && !previewDoc) return;
    const handler = (e) => { if (e.key === 'Escape') { setPreviewImage(null); setPreviewDoc(null); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [previewImage, previewDoc]);

  const insertNotesLink = (snippet) => {
    const el  = notesRef.current;
    const pos = el ? (el.selectionStart ?? form.notes.length) : form.notes.length;
    const before = form.notes.slice(0, pos);
    const after  = form.notes.slice(pos);
    const next = `${before}${snippet}${after}`;
    setForm(f => ({ ...f, notes: next }));
    setTimeout(() => {
      const newPos = (before + snippet).length;
      el?.focus();
      el?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const filteredSprints  = sprints.filter(s => s.product_id === +form.product_id);
  const filteredFeatures = features.filter(f => +f.product_id === +form.product_id);
  const filteredEpics    = epics.filter(e => e.product_id === +form.product_id);

  useEffect(() => {
    if ((form.type === 'task' || form.type === 'bug') && form.product_id) {
      client.get('/backlog', { params: { product_id: form.product_id, type: 'story', limit: 200 } })
        .then(r => setStories((r.data.items || []).filter(s => !item || s.id !== item.id)))
        .catch(() => setStories([]));
    } else {
      setStories([]);
    }
    if (form.type === 'story' && form.product_id) {
      client.get('/backlog', { params: { product_id: form.product_id, type: 'epic', limit: 200 } })
        .then(r => setEpicsBacklog((r.data.items || []).filter(e => !item || e.id !== item.id)))
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
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(fileExt(file.name))) {
      toast.error('Tipe file tidak didukung. Gunakan gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, atau TXT');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { toast.error('Ukuran file maks 10MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await client.post(`/backlog/${item.id}/attachments`, fd);
      toast.success('File berhasil diunggah');
      loadAttachments();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengunggah file');
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
    const t = e.target.value;
    setForm(f => ({
      ...f,
      type: t,
      parent_id: '',
      sprint_id: t === 'independent' ? '' : f.sprint_id,
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if ((form.type === 'task' || form.type === 'bug') && !form.parent_id) {
      toast.error(`${form.type === 'task' ? 'Task' : 'Bug'} harus memiliki 1 user story sebagai parent`);
      return;
    }
    if (form.type === 'independent' && (!form.estimated_hours || +form.estimated_hours <= 0)) {
      toast.error('Independent task harus memiliki estimasi jam pengerjaan');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      // Backend stores the first pick as the legacy `assignee_id` column, rest via additional_assignee_ids
      payload.assignee_id = payload.assignee_ids[0] || '';
      payload.additional_assignee_ids = payload.assignee_ids.slice(1);
      delete payload.assignee_ids;
      if (payload.type === 'epic') payload.parent_id = null;
      if (payload.type === 'independent') { payload.sprint_id = null; payload.parent_id = null; }
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
          onChange={e => setForm(f => ({ ...f, product_id: e.target.value, sprint_id: '', feature_id: '', parent_id: '' }))}
          required>
          <option value="">Pilih produk</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </F>
      {form.type !== 'independent' ? (
        <F label="Sprint">
          <select className="select" value={form.sprint_id} onChange={e => setForm(f => ({ ...f, sprint_id: e.target.value }))}>
            <option value="">Backlog (no sprint)</option>
            {filteredSprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </F>
      ) : (
        <div className="flex items-end">
          <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700 flex items-center gap-1.5 w-full">
            <span>⚡</span>
            <span><strong>Independent</strong> — tidak terikat sprint, epic, atau story</span>
          </div>
        </div>
      )}
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
            <SearchableSelect
              value={form.parent_id}
              onChange={v => setForm(f => ({ ...f, parent_id: v }))}
              options={stories.map(s => ({ value: String(s.id), label: `${s.code} — ${s.title}` }))}
              placeholder="— Pilih user story —"
              searchPlaceholder="Cari user story..."
              emptyMessage="Tidak ada story di produk ini"
            />
          </F>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Link2 className="w-3 h-3" />{form.type === 'task' ? 'Task' : 'Bug'} harus terhubung ke tepat 1 user story
          </p>
        </div>
      )}
      {form.type === 'story' && (
        <div className="col-span-2">
          <F label="Parent Epic">
            <SearchableSelect
              className="border-purple-300"
              value={form.parent_id}
              onChange={v => setForm(f => ({ ...f, parent_id: v }))}
              options={epicsBacklog.map(e => ({ value: String(e.id), label: `${e.code} — ${e.title}` }))}
              placeholder="— Tanpa epic (standalone story) —"
              emptyOptionLabel="— Tanpa epic (standalone story) —"
              searchPlaceholder="Cari epic..."
              emptyMessage="Tidak ada epic di produk ini"
            />
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
      {form.type === 'independent' ? (
        <F label="Estimasi Jam" required>
          <div className="relative">
            <input type="number" className="input pr-12" min="0.5" step="0.5" value={form.estimated_hours}
              onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))}
              placeholder="mis. 4, 8, 16" required />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">jam</span>
          </div>
          <div className="mt-2 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 space-y-0.5">
            {[
              ['≤ 4 jam',   'Tugas kecil, bisa selesai setengah hari'],
              ['8 jam',     'Satu hari kerja penuh'],
              ['16 jam',    'Dua hari kerja'],
              ['24–40 jam', 'Satu minggu kerja'],
              ['> 40 jam',  'Pertimbangkan untuk dipecah menjadi beberapa task'],
            ].map(([est, desc]) => (
              <div key={est} className="flex gap-2 text-xs">
                <span className="shrink-0 font-semibold text-orange-600 w-16">{est}</span>
                <span className="text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1">
            <span>⚡</span> Estimasi ini langsung digunakan pada perhitungan Dashboard User Occupation
          </p>
        </F>
      ) : form.type === 'epic' ? (
        <div>
          <label className="label">
            Story Points&nbsp;<span className="text-xs font-normal text-slate-400">(otomatis)</span>
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
          <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 space-y-0.5">
            {[
              [1,  'Sangat kecil & sederhana (contoh: ubah teks pada halaman)'],
              [2,  'Kecil, langkah jelas (contoh: tambah field form sederhana)'],
              [3,  'Standar, tanpa ketidakpastian (contoh: buat endpoint API dasar)'],
              [5,  'Kompleks, butuh implementasi & testing hati-hati (contoh: integrasi layanan pihak ketiga)'],
              [8,  'Besar, banyak dependensi & ketidakpastian (contoh: rebuild halaman checkout)'],
              [13, 'Epic terlalu besar — harus dipecah menjadi item lebih kecil sebelum dikerjakan'],
            ].map(([pt, desc]) => (
              <div key={pt} className="flex gap-2 text-xs">
                <span className="shrink-0 font-semibold text-slate-800 w-5">{pt}</span>
                <span className="text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </F>
      )}
      <F label="Feature">
        <select className="select" value={form.feature_id} onChange={e => setForm(f => ({ ...f, feature_id: e.target.value }))}>
          <option value="">—</option>
          {filteredFeatures.map(f => <option key={f.id} value={f.id}>{f.feature_name}</option>)}
        </select>
        {form.product_id && filteredFeatures.length === 0 && (
          <p className="text-xs text-slate-400 mt-1">Belum ada feature. Tambahkan di <strong>Products → Roadmap</strong>.</p>
        )}
      </F>
      <F label="Assignee">
        <SearchableMultiSelect label="assignee"
          options={users.map(u => ({ v: u.id, l: u.name }))}
          selected={form.assignee_ids}
          searchPlaceholder="Cari nama assignee..."
          onChange={vals => setForm(f => ({ ...f, assignee_ids: vals }))} />
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
        <F label={
          <span className="flex items-center justify-between w-full">
            Catatan
            <LinkInsertButton onInsert={insertNotesLink} />
          </span>
        }>
          <textarea ref={notesRef} className="input h-16 resize-none" value={form.notes}
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
                Lampiran
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
                {uploading ? 'Mengunggah...' : 'Unggah File'}
              </button>
              <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleUpload} />
            </div>
            {attachments.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}>
                <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Klik untuk unggah file</p>
                <p className="text-xs text-slate-300 mt-0.5">Gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT • Maks 10MB</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map(att => {
                  const isImage = isImageAttachment(att);
                  const docKind = !isImage ? previewKindOf(att) : null;
                  const openAttachment = () => {
                    if (isImage) { setPreviewImage(att); return; }
                    if (docKind) { setPreviewDoc({ att, kind: docKind }); return; }
                    window.open(`/api/attachments/file/${att.filename}`, '_blank');
                  };
                  return (
                    <div key={att.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-video cursor-pointer"
                      onClick={openAttachment}>
                      {isImage ? (
                        <img src={`/api/attachments/file/${att.filename}`} alt={att.original_name}
                          className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-2">
                          <AttachmentIcon att={att} className="w-7 h-7 text-slate-400" />
                          <p className="text-[11px] text-slate-500 text-center truncate w-full">{att.original_name}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <button type="button" onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {isImage && (
                        <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {att.original_name}
                        </p>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="aspect-video rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center gap-1">
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
          <ActivitySection itemId={item.id} users={users} />
        </div>
      )}

      <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : (item?.id ? 'Perbarui' : 'Tambah Item')}
        </button>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewImage(null)}>
          <button type="button" onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2">
            <X className="w-5 h-5" />
          </button>
          <img src={`/api/attachments/file/${previewImage.filename}`} alt={previewImage.original_name}
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewDoc(null)}>
          <div className="w-full h-full max-w-4xl bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
              <p className="text-sm font-medium text-slate-700 truncate pr-2">{previewDoc.att.original_name}</p>
              <div className="flex items-center gap-1 shrink-0">
                <a href={`/api/attachments/file/${previewDoc.att.filename}`} target="_blank" rel="noreferrer"
                  className="btn-ghost btn-sm rounded-lg p-1.5" title="Buka di tab baru">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button type="button" onClick={() => setPreviewDoc(null)} className="btn-ghost btn-sm rounded-lg p-1.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50">
              {previewDoc.kind === 'pdf' && (
                <iframe src={`/api/attachments/file/${previewDoc.att.filename}`} title={previewDoc.att.original_name}
                  className="w-full h-full border-0" />
              )}
              {previewDoc.kind === 'txt' && (
                docLoading
                  ? <p className="p-4 text-sm text-slate-400">Memuat...</p>
                  : <pre className="p-4 text-xs text-slate-700 whitespace-pre-wrap break-words">{docContent}</pre>
              )}
              {previewDoc.kind === 'csv' && (
                docLoading
                  ? <p className="p-4 text-sm text-slate-400">Memuat...</p>
                  : (
                    <table className="text-xs border-collapse">
                      <tbody>
                        {parseCsvSimple(docContent).map((row, i) => (
                          <tr key={i} className={i === 0 ? 'bg-slate-100 font-semibold' : 'even:bg-white odd:bg-slate-50'}>
                            {row.map((cell, j) => (
                              <td key={j} className="border border-slate-200 px-2 py-1 whitespace-nowrap">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SHORTCUTS = [
  { label: 'Backlog',  icon: '📋', filterKey: 'status', filterVal: 'backlog' },
  { label: 'Story',    icon: '📖', filterKey: 'type',   filterVal: 'story'   },
  { label: 'Task',     icon: '🔧', filterKey: 'type',   filterVal: 'task'    },
  { label: 'Epic',     icon: '🗂️', filterKey: 'type',   filterVal: 'epic'    },
  { label: 'Selesai',  icon: '✅', filterKey: 'status', filterVal: 'done'    },
];

function ProductTag({ item }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600 whitespace-nowrap">
      <span className="w-[18px] h-[18px] rounded grid place-items-center text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: item.product_color || '#9A9CA4' }}>
        {(item.product_code || '?').charAt(0)}
      </span>
      {item.product_code}
    </span>
  );
}

function Deadline({ item }) {
  if (!item.deadline) return <span className="text-slate-400">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${item.is_delayed ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
      {item.is_delayed && <AlertCircle className="w-3 h-3" />}
      {format(parseISO(item.deadline), 'dd MMM')}
    </span>
  );
}

// Clicking a row/card opens the item, unless the click was really a text selection (e.g. copying a code).
const isSelectingText = () => !!window.getSelection?.().toString();

export default function Backlog() {
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  // ?product=<id> comes from the Products list in the sidebar
  const productParam = searchParams.get('product');
  const [items, setItems]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [products, setProducts] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [sprints,  setSprints]  = useState([]);
  const [features, setFeatures] = useState([]);
  const [epics,    setEpics]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState({ open: false, item: null, defaults: null });
  const [filters,  setFilters]  = useState(() => ({ product_id: productParam ? [Number(productParam)] : [], status: [], priority: [], type: [], assignee_id: [], deadline_from: '', deadline_to: '', search: '' }));
  const [page,     setPage]     = useState(1);
  const [perPage,  setPerPage]  = useState(30);
  const [view,     setView]     = useState('list');   // 'list' | 'board' — presentation only, same data
  const [grouped,  setGrouped]  = useState(true);     // list grouped by status
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const lastProductParam = useRef(productParam);
  const PER_PAGE = perPage;

  const canEdit   = can('backlog', 'update') || can('backlog', 'update_assigned');
  const canCreate = can('backlog', 'create');

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, limit: PER_PAGE };
    // Multi-value filters → comma-joined lists (backend expands with ANY(...))
    ['product_id', 'status', 'priority', 'type', 'assignee_id'].forEach(k => {
      if (filters[k].length) params[k] = filters[k].join(',');
    });
    if (filters.search)        params.search        = filters.search;
    if (filters.deadline_from) params.deadline_from = filters.deadline_from;
    if (filters.deadline_to)   params.deadline_to   = filters.deadline_to;
    // Hide done items by default; only show when status filter includes 'done'
    if (!filters.status.length) params.hide_done = true;
    try {
      const [bl, pr, us, sp, ft, ep] = await Promise.all([
        client.get('/backlog', { params }),
        products.length ? null : client.get('/products'),
        users.length ? null : client.get('/users'),
        sprints.length ? null : client.get('/sprints'),
        features.length ? null : client.get('/roadmap'),
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

  // Sidebar product link changed (or cleared by clicking "Backlog"): apply it as the product filter
  useEffect(() => {
    if (productParam === lastProductParam.current) return;
    lastProductParam.current = productParam;
    setFilters(f => ({ ...f, product_id: productParam ? [Number(productParam)] : [] }));
    setPage(1);
  }, [productParam]);

  // Auto-open item from URL ?item=123 (from notification click)
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (!itemId) return;
    client.get(`/backlog/${itemId}`).then(res => {
      setModal({ open: true, item: res.data, defaults: null });
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

  const quickSprint = async (id, sprintId) => {
    await client.patch(`/backlog/${id}/sprint`, { sprint_id: sprintId || null });
    load();
  };

  const setFilter = (key, vals) => { setFilters(f => ({ ...f, [key]: vals })); setPage(1); };
  // Same rule as the old pencil button: only users who may edit can open an item
  const openItem = (item) => { if (canEdit && !isSelectingText()) setModal({ open: true, item, defaults: null }); };
  const openNew  = (status) => setModal({ open: true, item: null, defaults: status ? { status } : null });
  const closeModal = () => setModal({ open: false, item: null, defaults: null });
  const toggleGroup = (s) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    return next;
  });

  const stop = e => e.stopPropagation();

  const sprintCell = (item) => item.type === 'independent' ? (
    <span className="inline-flex items-center gap-1 text-[12.5px] text-orange-600"><Zap className="w-3 h-3" />independent</span>
  ) : (
    <select
      className="max-w-[170px] text-[12.5px] text-slate-600 bg-transparent border-0 rounded-md pl-1.5 pr-6 py-1 -ml-1.5 cursor-pointer hover:bg-slate-100 focus:ring-0 focus:outline-none disabled:cursor-default disabled:hover:bg-transparent"
      value={item.sprint_id || ''}
      onClick={stop}
      onChange={e => quickSprint(item.id, e.target.value)}
      disabled={!canEdit}
    >
      <option value="">Backlog (no sprint)</option>
      {sprints.filter(s => s.product_id === item.product_id).map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );

  const pointsCell = (item) => item.type === 'independent'
    ? <span className="text-orange-600">{item.estimated_hours ? `${item.estimated_hours}h` : '—'}</span>
    : item.story_points;

  const rowActions = (item) => (
    <div className="flex items-center gap-0.5 justify-end md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      {canEdit && (
        <button className="w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-800"
          title={`Edit ${item.code}`} onClick={e => { stop(e); setModal({ open: true, item, defaults: null }); }}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {can('backlog', 'delete') && (
        <button className="w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
          title={`Hapus ${item.code}`} onClick={e => { stop(e); deleteItem(item.id); }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  const itemRow = (item) => (
    <tr key={item.id} onClick={() => openItem(item)}
      className={`group border-b border-slate-100 hover:bg-slate-50 transition-colors ${canEdit ? 'cursor-pointer' : ''}`}>
      <td className="pl-3 pr-3 py-2">
        <div className="flex items-center gap-2 min-w-0 max-w-[560px]">
          <StatusIcon status={item.status} />
          <span className="font-mono text-[11.5px] text-slate-400 shrink-0">{item.code}</span>
          {item.is_delayed && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" aria-label="Terlambat" />}
          <span className={`font-medium truncate min-w-0 ${item.type === 'epic' ? 'text-purple-700' : 'text-slate-800'}`} title={item.title}>{item.title}</span>
          <TypeTag type={item.type} />
          {item.parent_code && (
            <span className="shrink-0 inline-flex items-center gap-0.5 font-mono text-[11px] text-slate-600 bg-slate-100 rounded px-1.5 leading-[18px]" title="Parent">
              <Link2 className="w-2.5 h-2.5" />{item.parent_code}
            </span>
          )}
          {(item.feature_name || item.epic_name) && (
            <span className="text-xs text-slate-400 truncate min-w-0">{item.feature_name || item.epic_name}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        {item.assignees?.length > 0
          ? <AssigneeStack assignees={item.assignees} />
          : <span className="text-xs text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2 text-[12.5px]"><Deadline item={item} /></td>
      <td className="px-3 py-2"><PriorityBadge priority={item.priority} /></td>
      <td className="px-3 py-2">
        <StatusMenuButton status={item.status} canChange={canEdit} onChange={s => quickStatus(item.id, s)} />
      </td>
      <td className="px-3 py-2 text-right font-semibold text-slate-600 tabular-nums">{pointsCell(item)}</td>
      <td className="px-3 py-2"><ProductTag item={item} /></td>
      <td className="px-3 py-2">{sprintCell(item)}</td>
      <td className="pl-2 pr-3 py-2">{rowActions(item)}</td>
    </tr>
  );

  const groupedStatuses = STATUSES.filter(s => items.some(i => i.status === s));

  return (
    <div className="space-y-3">
      {/* View tabs + primary actions */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        <div className="flex gap-5" role="tablist">
          {[{ k: 'list', l: 'List', Icon: List }, { k: 'board', l: 'Board', Icon: Columns3 }].map(({ k, l, Icon }) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={`inline-flex items-center gap-1.5 h-10 -mb-px border-b-2 text-[13.5px] transition-colors
                ${view === k ? 'border-slate-800 text-slate-800 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <Icon className="w-3.5 h-3.5" />{l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 pb-1.5">
          {can('import', 'run') && (
            <Link to="/import/jira" className="btn-ghost">
              <FileDown className="w-4 h-4" />
              Import Jira
            </Link>
          )}
          {canCreate && (
            <button className="btn-primary" onClick={() => openNew(null)}>
              <Plus className="w-4 h-4" /> Tambah Item
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            className="input h-8 py-1 pl-8 text-[12.5px]" placeholder="Cari judul atau kode..."
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
          <MultiSelect key={key} label={label} options={opts} minWidth={0}
            selected={filters[key]}
            onChange={vals => setFilter(key, vals)} />
        ))}
        {/* Assignee filter */}
        <SearchableMultiSelect label="Assignee" minWidth={150}
          options={users.map(u => ({ v: u.id, l: u.name }))}
          selected={filters.assignee_id}
          searchPlaceholder="Cari nama assignee..."
          onChange={vals => setFilter('assignee_id', vals)} />
        {/* Deadline range */}
        <div className={`chip pr-1.5 ${filters.deadline_from || filters.deadline_to ? 'chip-on' : ''}`}>
          <span className="whitespace-nowrap">Deadline</span>
          <input type="date" aria-label="Deadline dari" className="bg-transparent text-[12.5px] w-[118px] focus:outline-none"
            value={filters.deadline_from}
            onChange={e => { setFilters(f => ({ ...f, deadline_from: e.target.value })); setPage(1); }} />
          <span className="opacity-50">—</span>
          <input type="date" aria-label="Deadline sampai" className="bg-transparent text-[12.5px] w-[118px] focus:outline-none"
            value={filters.deadline_to}
            onChange={e => { setFilters(f => ({ ...f, deadline_to: e.target.value })); setPage(1); }} />
          {(filters.deadline_from || filters.deadline_to) && (
            <button title="Hapus filter deadline" className="w-5 h-5 grid place-items-center rounded opacity-70 hover:opacity-100"
              onClick={() => { setFilters(f => ({ ...f, deadline_from: '', deadline_to: '' })); setPage(1); }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {view === 'list' && (
          <button type="button" onClick={() => setGrouped(g => !g)} aria-pressed={grouped}
            className={`chip sm:ml-auto ${grouped ? 'chip-on' : ''}`}>
            <Layers className="w-3.5 h-3.5" />Group: Status
          </button>
        )}
      </div>

      {/* Shortcut filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-slate-400 shrink-0 mr-0.5">Shortcut:</span>
        {SHORTCUTS.map(({ label, icon, filterKey, filterVal }) => {
          const active = filters[filterKey].includes(filterVal);
          return (
            <button key={label} type="button"
              onClick={() => { setFilters(f => ({ ...f, [filterKey]: active ? f[filterKey].filter(x => x !== filterVal) : [...f[filterKey], filterVal] })); setPage(1); }}
              className={`chip h-7 text-xs ${active ? 'chip-on' : ''}`}>
              <span>{icon}</span>
              {label}
              {active && <X className="w-3 h-3 ml-0.5 opacity-60" />}
            </button>
          );
        })}
      </div>

      {/* Count, page size, pager */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-slate-500">
        <p>Menampilkan <strong className="text-slate-800">{items.length}</strong> dari <strong className="text-slate-800">{total}</strong> item</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            Tampilkan
            <select className="h-7 border border-slate-200 rounded-md bg-panel px-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
              value={perPage}
              onChange={e => { setPerPage(+e.target.value); setPage(1); }}>
              {[10, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            baris
          </div>
          {total > PER_PAGE && (
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span className="tabular-nums">{page} / {Math.ceil(total/PER_PAGE)}</span>
              <button className="btn-secondary btn-sm" disabled={page >= Math.ceil(total/PER_PAGE)} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-14 text-slate-500">
          <span className="w-11 h-11 rounded-xl bg-app border border-slate-200 grid place-items-center"><Search className="w-5 h-5" /></span>
          <p className="text-[15px] font-semibold text-slate-800">Tidak ada item ditemukan</p>
        </div>
      ) : view === 'list' ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="text-[12.5px] text-slate-500 border-b border-slate-200">
                <th className="text-left font-normal pl-3 pr-3 py-2">Judul</th>
                <th className="text-left font-normal px-3 py-2 w-36">Assignee</th>
                <th className="text-left font-normal px-3 py-2 w-[88px]">Deadline</th>
                <th className="text-left font-normal px-3 py-2 w-24">Prioritas</th>
                <th className="text-left font-normal px-3 py-2 w-32">Status</th>
                <th className="text-right font-normal px-3 py-2 w-12">Pts</th>
                <th className="text-left font-normal px-3 py-2 w-[84px]">Produk</th>
                <th className="text-left font-normal px-3 py-2 w-40">Sprint</th>
                <th className="w-[72px]"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {grouped ? groupedStatuses.map(s => {
                const list = items.filter(i => i.status === s);
                const closed = collapsedGroups.has(s);
                return [
                  <tr key={`g-${s}`}>
                    <td colSpan={9} className="pt-4 pb-1.5">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => toggleGroup(s)} aria-expanded={!closed}
                          aria-label={`${closed ? 'Buka' : 'Tutup'} grup ${STATUS_MAP[s].label}`}
                          className="w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100">
                          <ChevronDown className={`w-4 h-4 transition-transform ${closed ? '-rotate-90' : ''}`} />
                        </button>
                        <StatusBadge status={s} variant="solid" />
                        <span className="text-[12.5px] text-slate-400 tabular-nums">{list.length}</span>
                        {canCreate && (
                          <button type="button" title={`Tambah item ${STATUS_MAP[s].label}`} onClick={() => openNew(s)}
                            className="w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>,
                  ...(closed ? [] : list.map(itemRow)),
                ];
              }) : items.map(itemRow)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 items-start">
          {STATUSES.map(s => {
            const list = items.filter(i => i.status === s);
            return (
              <div key={s} className="w-[272px] shrink-0 bg-slate-100/80 rounded-xl p-2 flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1 pt-0.5">
                  <StatusBadge status={s} variant="solid" />
                  <span className="text-[12.5px] text-slate-400 tabular-nums">{list.length}</span>
                  {canCreate && (
                    <button type="button" title={`Tambah item ${STATUS_MAP[s].label}`} onClick={() => openNew(s)}
                      className="ml-auto w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-800">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {list.map(item => (
                  <div key={item.id} onClick={() => openItem(item)}
                    className={`bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 flex flex-col gap-2 text-left hover:border-slate-300 hover:shadow-sm transition ${canEdit ? 'cursor-pointer' : ''}`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <StatusMenuButton variant="icon" status={item.status} canChange={canEdit} onChange={st => quickStatus(item.id, st)} />
                      <span className="font-mono text-[11.5px] text-slate-400">{item.code}</span>
                      <TypeTag type={item.type} />
                      <span className="ml-auto"><ProductTag item={item} /></span>
                    </div>
                    <p className={`text-[13.5px] font-medium leading-snug ${item.type === 'epic' ? 'text-purple-700' : 'text-slate-800'}`}>{item.title}</p>
                    {item.parent_code && (
                      <span className="self-start inline-flex items-center gap-0.5 font-mono text-[11px] text-slate-600 bg-slate-100 rounded px-1.5 leading-[18px]">
                        <Link2 className="w-2.5 h-2.5" />{item.parent_code}
                      </span>
                    )}
                    <div className="flex items-center gap-2.5 text-xs text-slate-500 min-h-6">
                      <span title={`Prioritas ${item.priority}`}><PriorityFlag priority={item.priority} /></span>
                      <span className="tabular-nums">{item.type === 'independent' ? pointsCell(item) : `${item.story_points} pt`}</span>
                      <Deadline item={item} />
                      <span className="ml-auto" onClick={stop}>
                        {item.assignees?.length > 0 && <AssigneeStack assignees={item.assignees} showName={false} />}
                      </span>
                    </div>
                  </div>
                ))}
                {canCreate && (
                  <button type="button" onClick={() => openNew(s)}
                    className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-md text-[13px] text-slate-400 hover:bg-slate-200/70 hover:text-slate-800">
                    <Plus className="w-3.5 h-3.5" />Tambah Item
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modal.open} onClose={closeModal}
        title={modal.item ? `Edit Item — ${modal.item.code}` : 'Tambah Backlog Item'} size="lg">
        <ItemForm
          item={modal.item} defaults={modal.defaults} products={products} users={users}
          sprints={sprints} features={features} epics={epics}
          onSave={() => { closeModal(); load(); }}
          onClose={closeModal}
          onOpenItem={childItem => setModal({ open: true, item: childItem, defaults: null })}
        />
      </Modal>
    </div>
  );
}
