import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { STATUS_MAP } from './StatusBadge';

// Linear happy-path for backlog items. 'blocked' sits outside this flow —
// it's reachable only through the dropdown opened by clicking the badge.
const FLOW = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];
const ALL_STATUSES = [...FLOW, 'blocked'];

export default function StatusStepper({ status, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const idx = FLOW.indexOf(status);
  const prev = idx > 0 ? FLOW[idx - 1] : null;
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  const meta = STATUS_MAP[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };

  return (
    <div className="relative inline-flex items-center gap-0.5" ref={ref}>
      <button type="button" disabled={disabled || !prev}
        onClick={() => onChange(prev)}
        title={prev ? `Kembalikan ke ${STATUS_MAP[prev]?.label || prev}` : undefined}
        className="p-0.5 rounded text-slate-400 enabled:hover:text-slate-700 enabled:hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <button type="button" disabled={disabled}
        onClick={() => setOpen(o => !o)}
        title="Pilih status lain"
        className={`text-xs font-medium rounded-full px-2.5 py-1 whitespace-nowrap transition-opacity ${meta.cls} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}>
        {meta.label}
      </button>

      <button type="button" disabled={disabled || !next}
        onClick={() => onChange(next)}
        title={next ? `Majukan ke ${STATUS_MAP[next]?.label || next}` : undefined}
        className="p-0.5 rounded text-slate-400 enabled:hover:text-slate-700 enabled:hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {open && !disabled && (
        <div className="absolute z-40 top-full left-1/2 -translate-x-1/2 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {ALL_STATUSES.map(s => (
            <button key={s} type="button"
              onClick={() => { onChange(s); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${s === status ? 'text-indigo-700 bg-indigo-50/50 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <span className="w-3.5 shrink-0">{s === status && <Check className="w-3.5 h-3.5" />}</span>
              {STATUS_MAP[s]?.label || s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
