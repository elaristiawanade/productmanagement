import { Link } from 'react-router-dom';
import StatusBadge from '../StatusBadge';
import ProgressBar from '../ProgressBar';
import DeadlineDate from '../DeadlineDate';
import Section, { SectionNote } from './Section';

// Finished feature statuses: their Target is never shown as late.
const FINISHED = ['done', 'released'];

// "Features": Products -> Features of the product. Target = the feature's Target date; Progress % is derived from
// the Backlog work linked to it (a Done/Released feature is 100%, no linked work = "—").
export default function FeaturesSection({ features }) {
  return (
    <Section title="Features" bodyClassName=""
      hint="Dari Products → Features. Progress dihitung dari item Backlog yang terhubung ke fitur">
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
                  <th className="text-left px-3 py-2.5 w-[130px]" title="Rata-rata progress item Backlog yang terhubung, berbobot story point">Progress</th>
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
                        {f.linked_items > 0 ? `${f.linked_items} item Backlog terhubung` : f.is_roadmap_item ? 'Belum ada item Backlog terhubung' : 'Bukan roadmap item, jadi tidak bisa dihubungkan ke Backlog'}
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
