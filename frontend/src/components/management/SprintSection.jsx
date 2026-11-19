import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import StatusBadge from '../StatusBadge';
import ProgressBar from '../ProgressBar';
import Section, { SectionNote } from './Section';

const day = (d) => (d ? parseISO(String(d).slice(0, 10)) : null);
const fmt = (d) => (d ? format(d, 'd MMM yyyy', { locale: localeId }) : '—');

// How the sprint stands against its calendar: days left, or how long ago it should have ended.
function timeNote(sprint) {
  const end = day(sprint.end_date);
  if (!end || sprint.status === 'completed') return null;
  const left = differenceInCalendarDays(end, new Date());
  if (left > 0) return { text: `${left} hari lagi`, late: false };
  if (left === 0) return { text: 'Berakhir hari ini', late: false };
  return { text: `Lewat ${-left} hari dari tanggal selesai`, late: true };
}

// "Sprint Aktif": picker of the product's sprints (the active one first and selected by default), or "–".
export default function SprintSection({ data, sprintId, onSprint }) {
  const sprints = data?.sprints || [];
  const sprint = sprints.find(s => String(s.id) === String(sprintId)) || null;
  const note = sprint && timeNote(sprint);

  const picker = (
    <select className="select w-72" value={sprint ? String(sprint.id) : ''} onChange={e => onSprint(e.target.value)}
      aria-label="Pilih sprint" disabled={sprints.length === 0}>
      <option value="">–</option>
      {sprints.map(s => (
        <option key={s.id} value={s.id}>
          {s.name} · {s.start_date ? format(day(s.start_date), 'd MMM', { locale: localeId }) : '?'} – {fmt(day(s.end_date))}
          {s.status === 'active' ? ' (aktif)' : ''}
        </option>
      ))}
    </select>
  );

  return (
    <Section title="Sprint Aktif" hint="Sprint yang sedang berjalan; bisa diganti ke sprint lain produk ini" actions={picker}
      bodyClassName="">
      {!data ? <SectionNote>Memuat sprint...</SectionNote>
        : !sprint ? <SectionNote>{sprints.length === 0 ? 'Produk ini belum punya sprint.' : '– Tidak ada sprint aktif. Pilih sprint lain di kanan atas.'}</SectionNote>
        : (
          <div className="p-5 grid gap-4 sm:grid-cols-[1fr_minmax(220px,320px)] items-start">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">{sprint.name}</span>
                <StatusBadge status={sprint.status} size="xs" />
                <Link to={`/sprints?sprint=${sprint.id}`} className="text-slate-400 hover:text-slate-800" title="Buka di Sprints">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
              <p className="text-sm text-slate-500 tabular-nums">
                {fmt(day(sprint.start_date))} – {fmt(day(sprint.end_date))}
                {note && <span className={`ml-2 text-xs ${note.late ? 'text-red-600 font-medium' : 'text-slate-400'}`}>· {note.text}</span>}
              </p>
              {sprint.goal && <p className="text-sm text-slate-600 line-clamp-2" title={sprint.goal}>{sprint.goal}</p>}
            </div>
            <div className="space-y-1.5">
              <ProgressBar value={sprint.progress} variant="block" />
              <p className="text-xs text-slate-500">
                {sprint.work_items > 0 ? `${sprint.done_items} dari ${sprint.work_items} item kerja selesai` : 'Belum ada item di sprint ini'}
              </p>
            </div>
          </div>
        )}
    </Section>
  );
}
