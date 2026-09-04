const STATUS_MAP = {
  todo:        { label: 'To Do',       cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700'  },
  in_review:   { label: 'In Review',   cls: 'bg-amber-100 text-amber-700' },
  done:        { label: 'Done',        cls: 'bg-emerald-100 text-emerald-700' },
  blocked:     { label: 'Blocked',     cls: 'bg-red-100 text-red-700'    },
  backlog:     { label: 'Backlog',     cls: 'bg-purple-100 text-purple-700' },
  // Sprint
  planned:    { label: 'Planned',     cls: 'bg-slate-100 text-slate-600' },
  active:     { label: 'Active',      cls: 'bg-blue-100 text-blue-700'  },
  completed:  { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-700' },
  // Feature
  not_started:    { label: 'Not Started',   cls: 'bg-slate-100 text-slate-500' },
  in_development: { label: 'In Dev',        cls: 'bg-blue-100 text-blue-700'  },
  testing:        { label: 'Testing',       cls: 'bg-amber-100 text-amber-700' },
  released:       { label: 'Released',      cls: 'bg-emerald-100 text-emerald-700' },
  on_hold:        { label: 'On Hold',       cls: 'bg-orange-100 text-orange-700' },
  // QA
  pass:    { label: 'Pass',    cls: 'bg-emerald-100 text-emerald-700' },
  fail:    { label: 'Fail',    cls: 'bg-red-100 text-red-700' },
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600' },
  skip:    { label: 'Skip',    cls: 'bg-slate-100 text-slate-500' },
  // Product
  archived: { label: 'Archived', cls: 'bg-slate-100 text-slate-400' },
  // Bugs
  open:          { label: 'Open',          cls: 'bg-red-100 text-red-700' },
  ready_to_test: { label: 'Ready to Test', cls: 'bg-amber-100 text-amber-700' },
};

export default function StatusBadge({ status, size = 'sm' }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  const sz = size === 'xs' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return <span className={`inline-flex items-center font-medium rounded-full whitespace-nowrap ${sz} ${s.cls}`}>{s.label}</span>;
}
