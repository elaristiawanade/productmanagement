// ClickUp-style priority: a coloured flag + label. Same keys/labels as before; unknown falls back to medium.
const P = {
  critical: { label: 'Critical', c: '#E5484D' },
  high:     { label: 'High',     c: '#E8920F' },
  medium:   { label: 'Medium',   c: '#4F7FE6' },
  low:      { label: 'Low',      c: '#A1A7B0' },
};

export function PriorityFlag({ priority, size = 14 }) {
  const p = P[priority] ?? P.medium;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={p.c} stroke={p.c} strokeWidth="2"
      strokeLinejoin="round" strokeLinecap="round" className="shrink-0" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" />
    </svg>
  );
}

export default function PriorityBadge({ priority }) {
  const p = P[priority] ?? P.medium;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600 whitespace-nowrap">
      <PriorityFlag priority={priority} />
      {p.label}
    </span>
  );
}
