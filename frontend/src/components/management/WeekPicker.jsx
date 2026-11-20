import { useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, addMonths, format, getISOWeek, isSameMonth, parseISO, startOfISOWeek, startOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import FloatingMenu from '../FloatingMenu';

// Weeks run Monday to Sunday (the dashboard's week boundary), so week numbers are ISO weeks: 16–22 Nov 2026 = W47.
export const ymd = (d) => format(d, 'yyyy-MM-dd');
export const weekNo = (weekStart) => getISOWeek(parseISO(weekStart));

/** "9 – 15 Nov 2026" (or "26 Okt – 1 Nov 2026") for the week starting on `weekStart` (yyyy-MM-dd, a Monday). */
export function weekRangeLabel(weekStart) {
  if (!weekStart) return '';
  const s = parseISO(weekStart), e = addDays(s, 6);
  const sameMonth = s.getMonth() === e.getMonth();
  return `${format(s, sameMonth ? 'd' : 'd MMM', { locale: localeId })} – ${format(e, 'd MMM yyyy', { locale: localeId })}`;
}

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Why a week cannot be opened (tooltip), or null when it can.
function unavailableReason(ws, { saved, currentWeekStart, trackingStart }) {
  if (saved.has(ws)) return null;
  if (ws === currentWeekStart) return 'Minggu ini: lihat kartu Open Item · Minggu Ini';
  if (currentWeekStart && ws > currentWeekStart) return 'Minggu ini belum dimulai';
  if (trackingStart && ws < trackingStart) return `Sebelum pencatatan mingguan dimulai (W${weekNo(trackingStart)})`;
  return 'Tidak ada data tersimpan untuk minggu ini';
}

/**
 * Quick picks for the last four weeks ("Minggu lalu", "2 minggu lalu", ...). A week that was not saved (before
 * tracking began, before the product existed, or not frozen yet) is shown but cannot be picked.
 */
export function RecentWeekChips({ currentWeekStart, trackingStart, saved, value, onChange }) {
  if (!currentWeekStart) return null;
  const current = parseISO(currentWeekStart);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Minggu sebelumnya">
      {[1, 2, 3, 4].map(k => {
        const ws = ymd(addDays(current, -7 * k));
        const reason = unavailableReason(ws, { saved, currentWeekStart, trackingStart });
        return (
          <button key={ws} type="button" disabled={!!reason} onClick={() => onChange(ws)}
            className={`chip disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-panel ${value === ws ? 'chip-on' : ''}`}
            title={reason ? `${weekRangeLabel(ws)}: ${reason}` : weekRangeLabel(ws)}>
            {k === 1 ? 'Minggu lalu' : `${k} minggu lalu`}
            <span className="tabular-nums text-slate-400">W{weekNo(ws)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Month calendar with the week number on the left, like Google Calendar; click a week row to open it. Month and
 * year can be picked directly (dropdowns) besides the arrows. Only saved (frozen) weeks can be picked. The running
 * week is shown in its own card, so it is not pickable here.
 * `weeks` = the frozen weeks [{week_start, source}]; an estimated (late-frozen) week has an amber week number.
 */
export default function WeekPicker({ weeks, value, currentWeekStart, trackingStart, onChange }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const saved = useMemo(() => new Map((weeks || []).map(w => [w.week_start, w])), [weeks]);
  const hasEstimate = useMemo(() => (weeks || []).some(w => w.source === 'backfill'), [weeks]);
  const today = ymd(new Date());

  // Years to choose from: from the first tracked (or saved) week to this year, plus the one on screen.
  const years = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const firstSaved = (weeks || []).reduce((min, w) => (w.week_start < min ? w.week_start : min), today);
    const from = Math.min(parseISO(trackingStart || firstSaved).getFullYear(), parseISO(firstSaved).getFullYear(), month.getFullYear());
    const to = Math.max(thisYear, month.getFullYear());
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }, [weeks, trackingStart, today, month]);

  // Always six rows, like Google Calendar, starting from the Monday on or before the 1st.
  const rows = useMemo(() => {
    const first = startOfISOWeek(startOfMonth(month));
    return Array.from({ length: 6 }, (_, r) => {
      const monday = addDays(first, r * 7);
      return { key: ymd(monday), days: Array.from({ length: 7 }, (_, i) => addDays(monday, i)) };
    });
  }, [month]);

  const toggle = () => {
    if (!open) setMonth(startOfMonth(parseISO(value || currentWeekStart || today)));
    setOpen(o => !o);
  };
  const pick = (ws) => { onChange(ws); setOpen(false); };

  return (
    <>
      <button ref={anchorRef} type="button" onClick={toggle} aria-label="Pilih minggu" aria-expanded={open}
        className="select w-auto flex items-center gap-2 text-left text-slate-800">
        <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
        {value
          ? <span className="whitespace-nowrap"><strong className="font-semibold tabular-nums">W{weekNo(value)}</strong> · {weekRangeLabel(value)}</span>
          : <span className="text-slate-400">Pilih minggu</span>}
      </button>
      <FloatingMenu anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} width={320} className="!p-3">
        <div className="flex items-center gap-1 mb-2">
          <select aria-label="Bulan" value={month.getMonth()}
            onChange={e => setMonth(m => new Date(m.getFullYear(), Number(e.target.value), 1))}
            className="h-8 pl-1.5 pr-1 rounded-md bg-transparent text-[15px] font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select aria-label="Tahun" value={month.getFullYear()}
            onChange={e => setMonth(m => new Date(Number(e.target.value), m.getMonth(), 1))}
            className="h-8 pl-1.5 pr-1 rounded-md bg-transparent text-[15px] font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="flex-1" />
          <button type="button" className="w-7 h-7 grid place-items-center rounded-full hover:bg-slate-100 text-slate-600"
            onClick={() => setMonth(m => addMonths(m, -1))} aria-label="Bulan sebelumnya"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" className="w-7 h-7 grid place-items-center rounded-full hover:bg-slate-100 text-slate-600"
            onClick={() => setMonth(m => addMonths(m, 1))} aria-label="Bulan berikutnya"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-[34px_repeat(7,1fr)] text-center text-[11px] font-medium text-slate-400 mb-1">
          <span />
          {DAYS.map(d => <span key={d}>{d}</span>)}
        </div>

        <div className="relative">
          {/* the grey week-number column, like Google Calendar */}
          <div className="absolute left-0 top-0 bottom-0 w-[34px] rounded-md bg-slate-100" aria-hidden />
          {rows.map(({ key, days }) => {
            const w = saved.get(key);
            const selected = key === value;
            const title = w ? `${weekRangeLabel(key)}${w.source === 'backfill' ? ' (estimasi)' : ''}`
              : unavailableReason(key, { saved, currentWeekStart, trackingStart });
            return (
              <button key={key} type="button" disabled={!w} onClick={() => pick(key)} title={title}
                aria-label={`W${weekNo(key)} ${weekRangeLabel(key)}`} aria-pressed={selected}
                className={`relative grid grid-cols-[34px_repeat(7,1fr)] items-center w-full h-9 rounded-md text-[13px] text-center
                  ${selected ? 'bg-indigo-50 ring-1 ring-indigo-200' : w ? 'hover:bg-slate-100' : 'cursor-default'}`}>
                <span className={`mx-auto min-w-[24px] px-1 leading-6 rounded text-[12px] font-semibold tabular-nums
                  ${selected ? 'bg-indigo-600 text-white' : w?.source === 'backfill' ? 'text-amber-600' : w ? 'text-slate-700' : 'text-slate-400'}`}>
                  {weekNo(key)}
                </span>
                {days.map(d => {
                  const day = ymd(d);
                  const inMonth = isSameMonth(d, month);
                  return (
                    <span key={day} className="grid place-items-center">
                      <span className={`w-7 h-7 grid place-items-center rounded-full tabular-nums
                        ${day === today ? 'bg-indigo-600 text-white font-semibold'
                          : !w ? 'text-slate-300'
                          : inMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                        {d.getDate()}
                      </span>
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
          <span>Klik baris minggu untuk membukanya. <span className="text-slate-400">Abu-abu</span> = tidak ada data.</span>
          {trackingStart && <span>Pencatatan dimulai W{weekNo(trackingStart)} · {weekRangeLabel(trackingStart)}.</span>}
          {hasEstimate && <span><span className="font-semibold text-amber-600">Nomor kuning</span> = estimasi.</span>}
        </div>
      </FloatingMenu>
    </>
  );
}
