// "Progress %" bar. The value is always derived by the backend (never typed in): from an item's status or
// its children (Backlog / My Task / Products), the latest test run (QA), or a snapshot (Standup).
// null / undefined = not applicable -> "—".
//   variant: "inline" (default, small bar + number, for table cells) | "block" (full width, for cards)

// Fill of every progress bar: always green, whatever the percentage (25% and 100% alike). The number next to the
// bar says how far along it is; red/amber stay reserved for bars that mean trouble (workload overload, standup
// participation), which are not progress bars and do not use this. Also used by the hand-written progress bars
// (Dashboard, Products, Sprints).
export const PROGRESS_FILL = 'bg-emerald-500';
export const progressFill = () => PROGRESS_FILL;

export default function ProgressBar({ value, variant = 'inline', title, className = '' }) {
  if (value === null || value === undefined) return <span className={`text-slate-400 ${className}`}>—</span>;
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const tip = title || `Progress ${pct}% (dihitung otomatis)`;
  const wide = variant === 'block';
  return (
    <span className={`${wide ? 'flex w-full' : 'inline-flex'} items-center gap-2 ${className}`} title={tip}>
      <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress"
        className={`${wide ? 'flex-1' : 'w-14'} h-1.5 rounded-full bg-slate-200 overflow-hidden`}>
        <span className={`block h-full rounded-full transition-all ${PROGRESS_FILL}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[11.5px] tabular-nums text-slate-500 w-8 text-right shrink-0">{pct}%</span>
    </span>
  );
}
