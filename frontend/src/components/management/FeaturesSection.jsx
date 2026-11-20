import { Link } from 'react-router-dom';
import StatusBadge from '../StatusBadge';
import ProgressBar from '../ProgressBar';
import DeadlineDate from '../DeadlineDate';
import Section, { SectionNote } from './Section';

// Finished feature statuses: their Target is never shown as late.
const FINISHED = ['done', 'released', 'offline'];

// "Features": Products -> Features of the product. Target = the feature's Target date; Progress % is set by hand through
// the feature's status (+20% per stage, the same number as Products and Roadmap show), not from the Backlog. The count
// of Backlog items that reference the feature (Impacted Features) is shown as information only.
export default function FeaturesSection({ features }) {
  return (
    <Section title="Features" bodyClassName=""
      hint="Dari Products → Features. Progress diatur lewat status fitur (Planned 20% … Active/Offline 100%), tidak dari Backlog">
      {!features ? <SectionNote>Memuat fitur...</SectionNote>
        : !features.length ? <SectionNote>Produk ini belum punya fitur.</SectionNote>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="text-left px-5 py-2.5 w-12">No</th>
                  <th className="text-left px-3 py-2.5">Feature</th>
                  <th className="text-left px-3 py-2.5 w-36">Status</th>
                  <th className="text-left px-3 py-2.5 w-32">Target</th>
                  <th className="text-left px-3 py-2.5 w-[130px]" title="Dari status fitur: Planned 20%, Research 40%, On Progress 60%, Testing 80%, Active/Offline 100%; On Hold tetap di persen terakhir">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {features.map((f, i) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 text-xs text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2.5 min-w-0">
                      <Link to={`/products?feature=${f.id}`} className="group flex items-baseline gap-2 min-w-0" title="Buka di Products">
                        <span className="font-mono text-xs text-slate-400 shrink-0">{f.code}</span>
                        <span className="font-medium text-slate-700 truncate group-hover:underline group-hover:text-indigo-600 underline-offset-2">{f.name}</span>
                      </Link>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {f.linked_items > 0 ? `${f.linked_items} item Backlog terkait (label, tidak memengaruhi progress)` : 'Belum ada item Backlog terkait'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={f.status} size="xs" /></td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap"><DeadlineDate date={f.target_date} done={FINISHED.includes(f.status)} /></td>
                    <td className="px-3 py-2.5"><ProgressBar value={f.progress} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Section>
  );
}
