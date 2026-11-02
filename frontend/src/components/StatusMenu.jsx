import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import StatusBadge, { StatusIcon, STATUS_MAP } from './StatusBadge';
import FloatingMenu from './FloatingMenu';

// Status shown as a pill (lists) or icon (cards). With canChange it opens a menu of `statuses`
// and calls onChange(newStatus) — the page keeps its own update call (e.g. PATCH /backlog/:id/status).
export default function StatusMenuButton({ status, statuses, canChange = true, onChange, variant = 'pill' }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const face = variant === 'icon' ? <StatusIcon status={status} /> : <StatusBadge status={status} />;
  if (!canChange) return face;
  return (
    <>
      <button ref={ref} type="button" title="Ubah status" aria-haspopup="menu" aria-expanded={open}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className={variant === 'icon'
          ? 'w-5 h-5 -ml-0.5 grid place-items-center rounded hover:bg-slate-200/70'
          : 'rounded-md hover:shadow-[inset_0_0_0_1px_rgb(var(--c-slate-300))]'}>
        {face}
      </button>
      <FloatingMenu anchorRef={ref} open={open} onClose={() => setOpen(false)} width={200}>
        <p className="px-2 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[.06em] text-slate-400">Status</p>
        {statuses.map(s => (
          <button key={s} type="button" role="menuitemradio" aria-checked={s === status}
            onClick={() => { setOpen(false); if (s !== status) onChange(s); }}
            className="w-full flex items-center gap-2 h-8 px-2 rounded-md text-[13px] text-slate-800 hover:bg-slate-100">
            <StatusIcon status={s} />
            <span className="flex-1 text-left">{STATUS_MAP[s]?.label ?? s}</span>
            {s === status && <Check className="w-3.5 h-3.5 text-indigo-600" />}
          </button>
        ))}
      </FloatingMenu>
    </>
  );
}
