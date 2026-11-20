import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CornerDownRight } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../StatusBadge';
import StatusMenu from '../StatusMenu';
import ProgressBar from '../ProgressBar';
import DeadlineDate from '../DeadlineDate';
import AssigneeStack from '../AssigneeStack';
import { PERSONAL_STATUSES } from '../PersonalTaskModal';
import { makeStageLookup } from '../../utils/bugStages';
import { SectionNote } from './Section';
import RemarkCell, { missedExpectation } from './RemarkCell';

// Where an Open Item row comes from, in the order the server lists them.
export const SOURCES = [
  { key: 'backlog', label: 'Backlog', cls: 'text-blue-700 bg-blue-50' },
  { key: 'mytask',  label: 'My Task', cls: 'text-amber-700 bg-amber-50' },
  { key: 'qa',      label: 'QA',      cls: 'text-teal-700 bg-teal-50' },
  { key: 'bug',     label: 'Bug',     cls: 'text-red-700 bg-red-50' },
];
const SOURCE_OF = Object.fromEntries(SOURCES.map(s => [s.key, s]));

const BACKLOG_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'];
// QA rows show the latest test run; "not_run" = no run yet.
const QA_META = { not_run: { label: 'Belum Dijalankan', c: '#9AA0A9', icon: 'dashed', n: true } };

// Link to the row's own record (null when the viewer cannot open that module).
function hrefOf(item, can, userId) {
  if (item.source === 'backlog') return `/backlog?item=${item.id}`;
  if (item.source === 'bug') return can('bugs', 'access') ? `/bugs?bug=${item.id}` : null;
  if (item.source === 'qa') return `/qa?case=${item.id}`;
  // A personal task opens in its owner's My Task only (PIC = the owner)
  if (item.source === 'mytask') return item.pic?.[0]?.id === userId ? `/my-tasks?ptask=${item.id}` : null;
  return null;
}

/**
 * Open Item of one week: Item, PIC, Status, Deadline, Progress, PO Remarks. Only work still open comes from the server
 * (In Review / Done / Ready to Test / Pass / Skip ... are left out); tasks sit indented under their story.
 * `editable` (the running week only) turns Status into the same dropdown the module uses, for whoever may change it
 * there: Backlog with backlog.update / update_assigned, Bug with bugs.access, My Task for its owner (or Super Admin).
 * QA status is the latest test run, so it is changed by running the test in QA Module, not here.
 * A frozen week passes editable=false: everything is read-only and lateness comes from the snapshot (is_late).
 * PO Remarks: `remarksEditable` (running week + Owner/Manager/Super Admin); `asOf` (yyyy-MM-dd) is the day an expected
 * date counts as missed from: today for the running week, the Monday after for a past week.
 * `toolbar` replaces the source filter chips (the past-week card shows week chips there instead, and every item).
 */
export default function OpenItemTable({
  items, bugStages, editable = false, onChanged, emptyText,
  productId, remarksEditable = false, asOf, onRemarkSaved, toolbar,
}) {
  const { user, can } = useAuth();
  const [source, setSource] = useState('');
  const stages = useMemo(() => makeStageLookup(bugStages || []), [bugStages]);

  const counts = useMemo(() => {
    const c = {};
    (items || []).forEach(i => { c[i.source] = (c[i.source] || 0) + 1; });
    return c;
  }, [items]);
  const filter = toolbar ? '' : source;   // with a custom toolbar every item is shown
  const rows = useMemo(() => (items || []).filter(i => !filter || i.source === filter), [items, filter]);
  // The server sends only work still open (no In Review / Done / Ready to Test / Pass / Skip), for every week.
  const summary = useMemo(() => {
    const list = items || [];
    return {
      open: list.length,
      late: list.filter(i => i.is_late).length,
      missed: asOf ? list.filter(i => missedExpectation(i, asOf)).length : 0,
    };
  }, [items, asOf]);

  const canBacklog = can('backlog', 'update') || can('backlog', 'update_assigned');
  const canBug = can('bugs', 'access');
  const canPersonal = (item) => user?.role === 'super_admin' || item.pic?.[0]?.id === user?.id;

  const change = async (item, status) => {
    try {
      if (item.source === 'backlog') await client.patch(`/backlog/${item.id}/status`, { status });
      else if (item.source === 'bug') await client.post('/bugs/progress', { bug_id: item.id, stage: status, note: '' });
      else if (item.source === 'mytask') await client.patch(`/personal-tasks/${item.id}/status`, { status });
      toast.success('Status diperbarui');
      onChanged?.();
    } catch { /* the API client shows the error */ }
  };

  const statusCell = (item) => {
    if (item.source === 'qa') return <StatusBadge status={item.status} meta={QA_META[item.status]} size="xs" />;
    if (item.source === 'bug') {
      return <StatusMenu status={item.status} statuses={stages.codes} metaOf={stages.metaOf}
        canChange={editable && canBug} onChange={s => change(item, s)} />;
    }
    const list = item.source === 'mytask' ? PERSONAL_STATUSES : BACKLOG_STATUSES;
    const allowed = item.source === 'mytask' ? canPersonal(item) : canBacklog;
    return <StatusMenu status={item.status} statuses={list} canChange={editable && allowed} onChange={s => change(item, s)} />;
  };

  if (!items) return <SectionNote>Memuat...</SectionNote>;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100">
        {toolbar || (
          <>
            <button type="button" className={`chip ${!source ? 'chip-on' : ''}`} onClick={() => setSource('')}>
              Semua <span className="tabular-nums text-slate-400">{items.length}</span>
            </button>
            {SOURCES.map(s => (
              <button key={s.key} type="button" className={`chip ${source === s.key ? 'chip-on' : ''}`}
                onClick={() => setSource(source === s.key ? '' : s.key)} disabled={!counts[s.key]}>
                {s.label} <span className="tabular-nums text-slate-400">{counts[s.key] || 0}</span>
              </button>
            ))}
          </>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {summary.open} terbuka
          {summary.late > 0 && <span className="text-red-600 font-medium"> · {summary.late} lewat deadline</span>}
          {summary.missed > 0 && <span className="text-red-600 font-medium"> · {summary.missed} lewat ekspektasi</span>}
        </span>
      </div>

      {rows.length === 0 ? <SectionNote>{emptyText || 'Tidak ada item.'}</SectionNote> : (
        <div className="overflow-x-auto">
          {/* Fixed layout: the other columns keep their width, Item takes the rest and truncates (full title on hover). */}
          <table className="w-full text-sm table-fixed min-w-[940px]">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="text-left px-5 py-2.5">Item</th>
                <th className="text-left px-3 py-2.5 w-40">PIC</th>
                <th className="text-left px-3 py-2.5 w-[150px]">Status</th>
                <th className="text-left px-3 py-2.5 w-[118px]">Deadline</th>
                <th className="text-left px-3 py-2.5 w-[124px]">Progress</th>
                <th className="text-left px-3 py-2.5 w-48" title="Ekspektasi selesai dari Product Owner, diisi manual">PO Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(item => {
                const src = SOURCE_OF[item.source];
                const href = hrefOf(item, can, user?.id);
                const child = !!item.parent_id && !filter;   // indent only while the story is shown too
                const title = (
                  <span className={`font-medium truncate text-slate-700 ${href ? 'group-hover:underline group-hover:text-indigo-600 underline-offset-2' : ''}`}
                    title={item.title}>{item.title}</span>
                );
                return (
                  <tr key={`${item.source}-${item.id}`} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5">
                      <div className={`flex items-center gap-2 min-w-0 ${child ? 'pl-6' : ''}`}>
                        {child && <CornerDownRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                        <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${src?.cls || ''}`}>{src?.label}</span>
                        {item.code && <span className="font-mono text-xs text-slate-400 shrink-0">{item.code}</span>}
                        {href ? <Link to={href} className="group min-w-0 flex">{title}</Link> : <span className="min-w-0 flex">{title}</span>}
                        {item.source === 'qa' && item.type === 'draft' && (
                          <span className="text-[10px] px-1 rounded bg-slate-100 text-slate-500 shrink-0">draft</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 overflow-hidden">
                      {item.pic?.length ? <AssigneeStack assignees={item.pic} size="xs" /> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5">{statusCell(item)}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap"><DeadlineDate date={item.deadline} late={!!item.is_late} /></td>
                    <td className="px-3 py-2.5"><ProgressBar value={item.progress} /></td>
                    <td className="px-3 py-2">
                      <RemarkCell item={item} productId={productId} editable={remarksEditable} asOf={asOf} onSaved={onRemarkSaved} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
