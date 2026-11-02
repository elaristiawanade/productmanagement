import { useState, useRef, useEffect } from 'react';
import PresenceDot from './PresenceDot';

// Renders a backlog item's assignee list. A single assignee shows as a plain
// avatar (+ name, optionally) — no interaction needed. Multiple assignees
// show just the primary's avatar (+ name) plus a "+N" bubble for everyone
// else; the whole cluster is a button that toggles a small popover listing
// every assignee's name.
function AvatarCircle({ id, name, color, size }) {
  const sizeCls = size === 'xs' ? 'w-4 h-4 text-[9px]' : 'w-6 h-6 text-[10.5px]';
  return (
    <div
      className={`relative ${sizeCls} rounded-full text-white flex items-center justify-center font-semibold shrink-0`}
      style={{ backgroundColor: color || '#6366f1' }}>
      {name?.charAt(0)}
      {id != null && <PresenceDot userId={id} size="sm" />}
    </div>
  );
}

export default function AssigneeStack({ assignees, showName = true, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!assignees || assignees.length === 0) return null;

  if (assignees.length === 1) {
    const a = assignees[0];
    return (
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        <AvatarCircle id={a.id} name={a.name} color={a.color} size={size} />
        {showName && <span className="text-[12.5px] text-slate-600 truncate">{a.name}</span>}
      </div>
    );
  }

  const [primary, ...rest] = assignees;
  const extraCls = size === 'xs' ? 'w-4 h-4 text-[8px]' : 'w-6 h-6 text-[10px]';

  return (
    <div className="relative shrink-0" ref={ref}>
      <button type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1.5 rounded-full p-0.5 -m-0.5 hover:bg-slate-100 transition-colors">
        <AvatarCircle id={primary.id} name={primary.name} color={primary.color} size={size} />
        {showName && <span className="text-[12.5px] text-slate-600 truncate">{primary.name}</span>}
        <span className={`inline-flex items-center justify-center rounded-full bg-slate-200 text-slate-600 font-semibold shrink-0 ${extraCls}`}>
          +{rest.length}
        </span>
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()}
          className="absolute z-50 top-full left-0 mt-1 min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-pop p-1">
          {assignees.map(a => (
            <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <AvatarCircle id={a.id} name={a.name} color={a.color} size={size} />
              <span className="text-[13px] text-slate-800 truncate">{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
