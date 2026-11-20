import { useEffect, useState } from 'react';
import { NotebookPen, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { renderWithLinks } from '../../utils/linkify';

const MAX = 5000;

/**
 * The Product Owner's note of one week, under that week's Open Item table: why items ran past their deadline or
 * past the expected date in PO Remarks, and what happens next. One note per product per week; it stays with that week,
 * so an older week still shows its note. A past week's note can still be written (reviews often come on Monday).
 * `note` = {content, updated_by_name, updated_at} or null; onSaved(note) hands the saved note (or null) back.
 */
export default function WeekNotes({ productId, weekStart, note, canEdit, live, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setEditing(false); }, [productId, weekStart]);

  const start = () => { setText(note?.content || ''); setEditing(true); };
  const save = async () => {
    setSaving(true);
    try {
      const res = await client.put('/management/notes', { product_id: Number(productId), week: weekStart, content: text });
      toast.success(res.data?.note ? 'Catatan disimpan' : 'Catatan dihapus');
      onSaved?.(res.data?.note ?? null);
      setEditing(false);
    } catch { /* the API client shows the error */ } finally { setSaving(false); }
  };

  return (
    <div className="px-5 py-4 border-t border-slate-100">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <NotebookPen className="w-4 h-4 text-slate-400" /> Catatan Product Owner
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Penjelasan untuk item yang lewat deadline atau belum selesai di tanggal ekspektasi (PO Remarks) {live ? 'minggu ini' : 'minggu itu'}:
            penyebabnya dan langkah selanjutnya. Catatan tetap tersimpan bersama minggunya.
          </p>
        </div>
        {canEdit && !editing && (
          <button type="button" className="btn-secondary btn-sm" onClick={start}>
            <Pencil className="w-3.5 h-3.5" /> {note ? 'Ubah catatan' : 'Tulis catatan'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3">
          <textarea className="input h-32 resize-y" value={text} maxLength={MAX} autoFocus
            onChange={e => setText(e.target.value)}
            placeholder="mis. Item A mundur ke 28 Nov karena menunggu data dari tim Finance; item B lewat deadline, dipecah jadi dua task." />
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-slate-400 tabular-nums">{text.length}/{MAX}</span>
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(false)} disabled={saving}>Batal</button>
              <button type="button" className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      ) : note ? (
        <div className="mt-3">
          <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{renderWithLinks(note.content, 'wn')}</div>
          <p className="text-[11px] text-slate-400 mt-2">
            Terakhir diubah oleh {note.updated_by_name || '—'}
            {note.updated_at ? ` · ${format(parseISO(note.updated_at), 'd MMM yyyy, HH:mm', { locale: localeId })}` : ''}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Belum ada catatan untuk {live ? 'minggu ini' : 'minggu itu'}.</p>
      )}
    </div>
  );
}
