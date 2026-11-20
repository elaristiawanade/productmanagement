import { useRef, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import toast from 'react-hot-toast';
import client from '../../api/client';
import FloatingMenu from '../FloatingMenu';
import { weekNo } from './WeekPicker';

const MAX = 300;

/** Remark expected date already passed (as of `asOf`, yyyy-MM-dd) while the item is still open. */
export const missedExpectation = (item, asOf) =>
  !!item.remark?.expected_date && !item.done_in_week && item.remark.expected_date < asOf;

/**
 * "PO Remarks" cell: when the Product Owner expects the item to be finished (date) plus a short note, typed by hand.
 * A remark written in an earlier week is still in force ("dari W46") until it is changed. The date turns red when
 * it has passed (as of `asOf`) and the item is not finished. `editable` = running week and the viewer may write.
 */
export default function RemarkCell({ item, productId, editable, asOf, onSaved }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ expected_date: '', remark: '' });
  const [saving, setSaving] = useState(false);
  const r = item.remark;
  const missed = missedExpectation(item, asOf);

  const openEditor = () => {
    setForm({ expected_date: r?.expected_date || '', remark: r?.text || '' });
    setOpen(true);
  };

  const save = async (clear = false) => {
    setSaving(true);
    try {
      const res = await client.put('/management/remarks', {
        product_id: Number(productId), item_source: item.source, item_id: item.id,
        expected_date: clear ? null : form.expected_date || null,
        remark: clear ? null : form.remark.trim() || null,
      });
      toast.success(clear ? 'Remark dihapus' : 'Remark disimpan');
      setOpen(false);
      onSaved?.(item, res.data?.remark ?? null);
    } catch { /* the API client shows the error */ } finally { setSaving(false); }
  };

  const who = r ? `Diisi ${r.updated_by_name || '—'}${r.updated_at ? `, ${format(parseISO(r.updated_at), 'd MMM yyyy HH:mm', { locale: localeId })}` : ''}` : '';
  const view = r ? (
    <span className="block min-w-0 text-left" title={`${r.text ? `${r.text}\n` : ''}${who}`}>
      {r.expected_date && (
        <span className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap ${missed ? 'text-red-600' : 'text-slate-700'}`}>
          <CalendarClock className="w-3.5 h-3.5 shrink-0" />
          {format(parseISO(r.expected_date), 'd MMM yyyy', { locale: localeId })}
          {missed && <span className="font-normal">· lewat</span>}
        </span>
      )}
      {r.text && <span className="text-xs text-slate-500 line-clamp-2 break-words">{r.text}</span>}
      {r.carried && <span className="block text-[10.5px] text-slate-400">dari W{weekNo(r.week_start)}</span>}
    </span>
  ) : null;

  if (!editable) return view || <span className="text-slate-400">—</span>;

  return (
    <>
      <button ref={anchorRef} type="button" onClick={openEditor}
        className="w-full min-h-[28px] -mx-1.5 px-1.5 py-1 rounded-md text-left hover:bg-slate-100 transition-colors"
        aria-label={`PO Remarks ${item.code || item.title}`}>
        {view || <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Plus className="w-3.5 h-3.5" /> Isi remark</span>}
      </button>
      <FloatingMenu anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} width={300} className="!p-3">
        <form onSubmit={e => { e.preventDefault(); save(false); }} className="space-y-2.5">
          <p className="text-xs font-semibold text-slate-600 truncate" title={item.title}>
            PO Remarks · <span className="font-normal">{item.code || item.title}</span>
          </p>
          <div>
            <label className="label">Ekspektasi selesai</label>
            <input type="date" className="input" value={form.expected_date}
              onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Keterangan <span className="font-normal text-slate-400">(opsional)</span></label>
            <textarea className="input h-16 resize-none" maxLength={MAX} value={form.remark}
              placeholder="mis. menunggu API vendor"
              onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} />
            <p className="text-right text-[10.5px] text-slate-400 tabular-nums">{form.remark.length}/{MAX}</p>
          </div>
          {r?.carried && (
            <p className="text-[11px] text-slate-500">Remark ini dari W{weekNo(r.week_start)}. Menyimpan akan mencatatnya sebagai remark minggu ini; minggu sebelumnya tidak berubah.</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            {r && (
              <button type="button" className="btn-ghost btn-sm text-red-600 hover:bg-red-50" disabled={saving} onClick={() => save(true)}>
                Hapus
              </button>
            )}
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>Batal</button>
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </form>
      </FloatingMenu>
    </>
  );
}
