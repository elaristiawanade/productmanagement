// "Progress %" bar. The value is always derived by the backend (never typed in): from an item's status or
// its children (Backlog / My Task / Products), the latest test run (QA), or a snapshot (Standup).
// null / undefined = not applicable -> "—".
//   color:   fill colour; default neutral grey, green once complete
//   variant: "inline" (default, small bar + number, for table cells) | "block" (full width, for cards)

// Fill for a plain progress bar: grey while running, green once complete. Not red on purpose: red bars mean
// trouble elsewhere (QA fail, workload overload, low standup compliance). slate-500 keeps ~4:1 contrast against
// the slate-100/200 track in both themes. Also used by the hand-written bars (Dashboard, Products, Sprints).
export const progressFill = pct => (pct >= 100 ? 'bg-emerald-500' : 'bg-slate-500');

export default function ProgressBar({ value, color, variant = 'inline', title, className = '' }) {
  if (value === null || value === undefined) return <span className={`text-slate-400 ${className}`}>—</span>;
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const fillClass = color ? '' : progressFill(pct);
  const tip = title || `Progress ${pct}% (dihitung otomatis)`;
  const wide = variant === 'block';
  return (
    <span className={`${wide ? 'flex w-full' : 'inline-flex'} items-center gap-2 ${className}`} title={tip}>
      <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress"
        className={`${wide ? 'flex-1' : 'w-14'} h-1.5 rounded-full bg-slate-200 overflow-hidden`}>
        <span className={`block h-full rounded-full transition-all ${fillClass}`} style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} />
      </span>
      <span className="text-[11.5px] tabular-nums text-slate-500 w-8 text-right shrink-0">{pct}%</span>
    </span>
  );
}
