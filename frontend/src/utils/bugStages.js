// Bug stages are configurable (Super Admin, /settings/bug-stages): the list comes from GET /bug-stages (or the
// `bugStages` field of the Bugs Incident / QA dashboard payload). This module turns that list into the lookups the
// pages need, so no page hard-codes stage names, colours or behaviour any more.
//
// A stage object from the API: { code, name, color, sort_order, is_builtin, is_closed, not_late, counts_open }.
//   code       stable id stored on the bug (bugs.stage); never changes
//   is_closed  counts as finished (Done): fills "Tanggal Closed", is hidden by "Closed/Done disembunyikan"
//   not_late   its Deadline is never shown red (Done, Ready to Test, ...)

// Icon of the built-in stages (same look as before); a stage someone adds gets one from its flags.
const BUILTIN_ICON = { open: 'dashed', in_progress: 'half', ready_to_test: 'tq', reopen: 'half', done: 'check', improvement: 'dashed' };

export function stageIcon(stage) {
  return BUILTIN_ICON[stage.code] ?? (stage.is_closed ? 'check' : stage.not_late ? 'tq' : 'half');
}

// `meta` in the shape StatusBadge / StatusIcon / StatusMenu take: { label, c, icon, n? }
export function stageMeta(stage) {
  return { label: stage.name, c: stage.color || '#64748B', icon: stageIcon(stage) };
}

// "waiting_client" -> "Waiting client": only for a stage code that no longer exists (e.g. in old progress history)
function prettifyCode(code) {
  const s = String(code ?? '').replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
}

export function makeStageLookup(stages = []) {
  const list = [...stages].sort((a, b) => (a.sort_order - b.sort_order) || String(a.name).localeCompare(String(b.name)));
  const byCode = {};
  const rank = {};
  list.forEach((s, i) => { byCode[s.code] = s; rank[s.code] = i; });
  const missing = (code) => ({ label: prettifyCode(code), c: '#9A9CA4', icon: 'dashed', n: true });
  return {
    list,                                              // stages in display order
    codes: list.map(s => s.code),
    rank,                                              // code -> position (sorting by the Stage column)
    label: (code) => byCode[code]?.name ?? prettifyCode(code),
    color: (code) => byCode[code]?.color ?? '#94a3b8',
    metaOf: (code) => (byCode[code] ? stageMeta(byCode[code]) : missing(code)),
    isClosed: (code) => !!byCode[code]?.is_closed,
    notLate: (code) => !!byCode[code]?.not_late,
  };
}
