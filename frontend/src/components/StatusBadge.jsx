// ClickUp-style status pill: a status icon (dashed ring = not started, half = in progress,
// three-quarter = in review/testing, check = done, slashed ring = blocked/failed) plus an uppercase label.
// `c` is the status hue; neutral statuses (n) stay grey. Same keys and labels as before.
export const STATUS_MAP = {
  todo:        { label: 'To Do',       c: '#7C8494', icon: 'dashed', n: true },
  in_progress: { label: 'In Progress', c: '#3E63DD', icon: 'half' },
  in_review:   { label: 'In Review',   c: '#D9891A', icon: 'tq' },
  done:        { label: 'Done',        c: '#1F9D55', icon: 'check' },
  blocked:     { label: 'Blocked',     c: '#E5484D', icon: 'blocked' },
  backlog:     { label: 'Backlog',     c: '#8B5CF6', icon: 'dashed' },
  // Sprint
  planned:    { label: 'Planned',     c: '#7C8494', icon: 'dashed', n: true },
  active:     { label: 'Active',      c: '#3E63DD', icon: 'half' },
  completed:  { label: 'Completed',   c: '#1F9D55', icon: 'check' },
  // Feature
  not_started:    { label: 'Not Started', c: '#7C8494', icon: 'dashed', n: true },
  in_development: { label: 'In Dev',      c: '#3E63DD', icon: 'half' },
  testing:        { label: 'Testing',     c: '#D9891A', icon: 'tq' },
  released:       { label: 'Released',    c: '#1F9D55', icon: 'check' },
  on_hold:        { label: 'On Hold',     c: '#E8740F', icon: 'blocked' },
  // QA
  pass:    { label: 'Pass',    c: '#1F9D55', icon: 'check' },
  fail:    { label: 'Fail',    c: '#E5484D', icon: 'blocked' },
  pending: { label: 'Pending', c: '#7C8494', icon: 'dashed', n: true },
  skip:    { label: 'Skip',    c: '#9AA0A9', icon: 'dashed', n: true },
  // Product
  archived: { label: 'Archived', c: '#9AA0A9', icon: 'dashed', n: true },
  // Bugs
  open:          { label: 'Open',          c: '#E5484D', icon: 'dashed' },
  ready_to_test: { label: 'Ready to Test', c: '#D9891A', icon: 'tq' },
  reopen:        { label: 'Re-Open',       c: '#9B51E0', icon: 'half' },
  improvement:   { label: 'Improvement',   c: '#0B8FCB', icon: 'dashed' },
};

const FALLBACK = { c: '#9A9CA4', icon: 'dashed', n: true };

export function StatusIcon({ status, size = 14, onSolid = false }) {
  const s = STATUS_MAP[status] ?? FALLBACK;
  const c = onSolid ? '#fff' : s.c;
  const ring = <circle cx="8" cy="8" r="6.2" fill="none" stroke={c} strokeWidth="1.6" />;
  const props = { width: size, height: size, viewBox: '0 0 16 16', className: 'shrink-0', 'aria-hidden': true };
  switch (s.icon) {
    case 'half':    return <svg {...props}>{ring}<path d="M8 4.2a3.8 3.8 0 0 1 0 7.6z" fill={c} /></svg>;
    case 'tq':      return <svg {...props}>{ring}<path d="M8 4.2A3.8 3.8 0 1 1 4.2 8H8z" fill={c} /></svg>;
    case 'check':   return <svg {...props}><circle cx="8" cy="8" r="7" fill={c} /><path d="M5 8.3l2 2 4-4.3" fill="none" stroke={onSolid ? s.c : '#fff'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'blocked': return <svg {...props}>{ring}<path d="M3.8 12.2 12.2 3.8" stroke={c} strokeWidth="1.6" /></svg>;
    default:        return <svg {...props}><circle cx="8" cy="8" r="6.2" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="2.4 2" /></svg>;
  }
}

// variant 'soft' (default, in rows) or 'solid' (group headers / board columns); neutral statuses never go solid.
export default function StatusBadge({ status, size = 'sm', variant = 'soft' }) {
  const s = STATUS_MAP[status] ?? { label: status, ...FALLBACK };
  const solid = variant === 'solid' && !s.n;
  const sz = size === 'xs' ? 'h-5 px-1.5 gap-1 text-[10px]' : 'h-6 px-2 gap-1.5 text-[11px]';
  const cls = s.n ? 'status-pill neutral' : solid ? 'status-pill solid' : 'status-pill';
  return (
    <span className={`${cls} ${sz}`} style={{ '--c': s.c }}>
      <StatusIcon status={status} size={size === 'xs' ? 11 : 13} onSolid={solid} />
      {s.label}
    </span>
  );
}
