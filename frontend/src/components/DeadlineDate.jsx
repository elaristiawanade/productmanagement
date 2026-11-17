import { AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Deadline column of the Bugs Incident and QA Test Cases tables (same look as Backlog's Deadline cell).
// `date` is a DATE column ("yyyy-MM-dd"). It turns red only once the deadline day itself is over, judged by
// the viewer's local date (the database runs in UTC, so an SQL NOW() check would be up to 7 hours off in WIB).
// `done`: work that is finished (e.g. a Done bug) is never shown as late.
export default function DeadlineDate({ date, done = false }) {
  if (!date) return <span className="text-slate-400">—</span>;
  const day = String(date).slice(0, 10);
  const late = !done && day < format(new Date(), 'yyyy-MM-dd');
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${late ? 'text-red-600 font-medium' : 'text-slate-500'}`}
      title={late ? 'Lewat deadline' : undefined}>
      {late && <AlertCircle className="w-3 h-3 shrink-0" />}
      {format(parseISO(day), 'dd MMM yyyy')}
    </span>
  );
}
