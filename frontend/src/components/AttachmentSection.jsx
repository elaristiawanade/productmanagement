import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Paperclip, Upload, X, Image as ImageIcon, ExternalLink, FileText, FileSpreadsheet, Presentation,
  Archive, File as FileIcon,
} from 'lucide-react';
import client from '../api/client';
import toast from 'react-hot-toast';
import { usePasteFiles } from '../utils/pasteFiles';

// Attachment block for the Bugs Incident and QA test case forms. Same file types, size limit and
// previews as the Backlog item form (images, PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT, max 10MB;
// PDF/TXT/CSV preview inline, other documents open in a new tab). Keep the allowed list in sync with
// AttachmentController (BACKLOG_EXTENSIONS) — the backend is the one that actually enforces it.
//
// While the record does not exist yet (`entityId` empty) files are queued locally and uploaded by the
// parent calling `ref.current.uploadPending(newId)` right after the record is created; once it exists
// files upload immediately.
//
// Ctrl+V: while the form is open, an image/file on the clipboard (e.g. a screenshot) is attached exactly like a
// picked file — same type/size checks, same queue-or-upload behaviour (see utils/pasteFiles.js).

const ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.csv,.txt';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_EXTENSIONS = [...IMAGE_EXTENSIONS, '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.csv', '.txt'];
const MAX_BYTES = 10 * 1024 * 1024;

const fileExt = (name = '') => {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
};

// 'image', 'pdf', 'txt', 'csv' render inline; null (docx/xlsx/zip/…) opens in a new tab / downloads
function kindOf(name, mime) {
  const ext = fileExt(name);
  if (mime?.startsWith('image/') || IMAGE_EXTENSIONS.includes(ext)) return 'image';
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

function FileTypeIcon({ name, className }) {
  const ext = fileExt(name);
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return <FileSpreadsheet className={className} />;
  if (['.ppt', '.pptx'].includes(ext)) return <Presentation className={className} />;
  if (ext === '.zip') return <Archive className={className} />;
  if (['.pdf', '.doc', '.docx', '.txt'].includes(ext)) return <FileText className={className} />;
  return <FileIcon className={className} />;
}

// `basePath`: '/bugs' or '/qa/test-cases' (list/upload at `${basePath}/${id}/attachments`)
// `deletePath`: '/bugs/attachments' or '/qa/attachments' (delete at `${deletePath}/${attachmentId}`)
const AttachmentSection = forwardRef(function AttachmentSection({ basePath, deletePath, entityId, noun = 'item' }, ref) {
  const [attachments, setAttachments] = useState([]); // saved on the server
  const [pending,     setPending]     = useState([]); // { file, url, name } queued until the record exists
  const [uploading,   setUploading]   = useState(false);
  const [preview,     setPreview]     = useState(null); // { name, url, kind }
  const [docContent,  setDocContent]  = useState('');
  const [docLoading,  setDocLoading]  = useState(false);
  const fileInputRef = useRef(null);

  const loadAttachments = useCallback(async () => {
    if (!entityId) return;
    try {
      const res = await client.get(`${basePath}/${entityId}/attachments`);
      setAttachments(res.data || []);
    } catch { setAttachments([]); }
  }, [basePath, entityId]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  // Text-based previews are fetched as text (blob: URLs work too, so queued files preview the same way)
  useEffect(() => {
    if (!preview || preview.kind === 'pdf' || preview.kind === 'image') { setDocContent(''); return; }
    setDocLoading(true);
    fetch(preview.url)
      .then(r => r.text())
      .then(setDocContent)
      .catch(() => setDocContent('Gagal memuat isi file.'))
      .finally(() => setDocLoading(false));
  }, [preview]);

  useEffect(() => {
    if (!preview) return;
    // Capture + stopPropagation: Esc closes only the preview, not the modal underneath
    const handler = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setPreview(null); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [preview]);

  // Revoke local object URLs for queued (not-yet-uploaded) files on unmount only.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => () => { pendingRef.current.forEach(p => URL.revokeObjectURL(p.url)); }, []);

  useImperativeHandle(ref, () => ({
    // Uploads everything queued while the record did not exist yet; a failed file is reported, not fatal
    async uploadPending(newId) {
      for (const p of pendingRef.current) {
        try {
          const fd = new FormData();
          fd.append('file', p.file);
          await client.post(`${basePath}/${newId}/attachments`, fd);
        } catch {
          toast.error(`Gagal mengunggah ${p.name}`);
        } finally {
          URL.revokeObjectURL(p.url);
        }
      }
      pendingRef.current = [];
      setPending([]);
    },
  }), [basePath]);

  // Validates one file, then queues it (record not saved yet) or uploads it right away.
  // `fromPaste` only changes the feedback: a pasted file has no file-picker dialog to confirm it was taken.
  const addFile = async (file, fromPaste = false) => {
    if (!ALLOWED_EXTENSIONS.includes(fileExt(file.name))) {
      toast.error('Tipe file tidak didukung. Gunakan gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, atau TXT');
      return;
    }
    if (file.size > MAX_BYTES) { toast.error('Ukuran file maks 10MB'); return; }

    // Record not created yet: queue the file, upload it once the record is saved.
    if (!entityId) {
      setPending(pf => [...pf, { file, url: URL.createObjectURL(file), name: file.name }]);
      if (fromPaste) toast.success(`${file.name} dilampirkan, diunggah setelah ${noun} disimpan`);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await client.post(`${basePath}/${entityId}/attachments`, fd);
      toast.success(fromPaste ? `${file.name} dilampirkan` : 'File berhasil diunggah');
      loadAttachments();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengunggah file');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (file) await addFile(file);
  };

  // Ctrl+V anywhere in the open form. Paused while a preview is open so a paste can't attach behind it.
  usePasteFiles(async (files) => { for (const f of files) await addFile(f, true); }, !preview);

  const removePending = (idx) => {
    setPending(pf => {
      URL.revokeObjectURL(pf[idx].url);
      return pf.filter((_, i) => i !== idx);
    });
  };

  const deleteAttachment = async (id) => {
    if (!confirm('Hapus lampiran ini?')) return;
    try {
      await client.delete(`${deletePath}/${id}`);
      toast.success('Lampiran dihapus');
      loadAttachments();
    } catch { toast.error('Gagal menghapus'); }
  };

  // One shape for saved and queued files so the grid and previews are shared
  const tiles = entityId
    ? attachments.map(a => ({
        key: `a${a.id}`, name: a.original_name, url: `/api/attachments/file/${a.filename}`,
        kind: kindOf(a.original_name || a.filename, a.mime_type), onRemove: () => deleteAttachment(a.id),
      }))
    : pending.map((p, i) => ({
        key: `p${i}`, name: p.name, url: p.url, kind: kindOf(p.name, p.file.type), onRemove: () => removePending(i),
      }));

  const open = (t) => {
    if (t.kind) setPreview(t);
    else window.open(t.url, '_blank');
  };

  return (
    <div className="col-span-2">
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <label className="label mb-0 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
            Lampiran
            {tiles.length > 0 && <span className="text-xs font-normal text-slate-400 ml-1">({tiles.length})</span>}
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
          <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleUpload} />
        </div>
        {!entityId && (
          <p className="text-xs text-slate-400 -mt-2 mb-3">File akan diunggah setelah {noun} disimpan.</p>
        )}
        {tiles.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Klik untuk unggah file, atau tempel gambar dengan Ctrl+V</p>
            <p className="text-xs text-slate-300 mt-0.5">Gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT • Maks 10MB</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {tiles.map(t => (
              <div key={t.key} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-video cursor-pointer"
                onClick={() => open(t)}>
                {t.kind === 'image' ? (
                  <img src={t.url} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-2">
                    <FileTypeIcon name={t.name} className="w-7 h-7 text-slate-400" />
                    <p className="text-[11px] text-slate-500 text-center truncate w-full">{t.name}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors pointer-events-none">
                  <button type="button" onClick={(e) => { e.stopPropagation(); t.onRemove(); }}
                    title="Hapus lampiran" aria-label="Hapus lampiran"
                    className="pointer-events-auto absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {t.kind === 'image' && (
                  <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {t.name}
                  </p>
                )}
              </div>
            ))}
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="aspect-video rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center gap-1">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Tambah</span>
            </button>
          </div>
        )}
      </div>

      {preview?.kind === 'image' && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreview(null)}>
          <button type="button" onClick={() => setPreview(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2">
            <X className="w-5 h-5" />
          </button>
          <img src={preview.url} alt={preview.name}
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {preview && preview.kind !== 'image' && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreview(null)}>
          <div className="w-full h-full max-w-4xl bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
              <p className="text-sm font-medium text-slate-700 truncate pr-2">{preview.name}</p>
              <div className="flex items-center gap-1 shrink-0">
                <a href={preview.url} target="_blank" rel="noreferrer"
                  className="btn-ghost btn-sm rounded-lg p-1.5" title="Buka di tab baru">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button type="button" onClick={() => setPreview(null)} className="btn-ghost btn-sm rounded-lg p-1.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50">
              {preview.kind === 'pdf' && (
                <iframe src={preview.url} title={preview.name} className="w-full h-full border-0" />
              )}
              {preview.kind === 'txt' && (
                docLoading
                  ? <p className="p-4 text-sm text-slate-400">Memuat...</p>
                  : <pre className="p-4 text-xs text-slate-700 whitespace-pre-wrap break-words">{docContent}</pre>
              )}
              {preview.kind === 'csv' && (
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
    </div>
  );
});

export default AttachmentSection;
