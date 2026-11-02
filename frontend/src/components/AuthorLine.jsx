import { User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Read-only "who made this, and when" line shown at the top of a ticket's edit modal.
// Spans both columns of the form grid; `name` falls back to "—" when the author is unknown (user deleted).
export default function AuthorLine({ label = 'Author', name, date }) {
  return (
    <div className="col-span-2 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span>{label}:</span>
      <span className="font-medium text-slate-700">{name || '—'}</span>
      {date && <span className="text-slate-400">· {format(parseISO(date), 'dd MMM yyyy, HH:mm')}</span>}
    </div>
  );
}
