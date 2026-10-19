// Shared badge styling for backlog item types, used wherever a backlog item
// needs a compact type indicator (e.g. the QA / Bugs Incident backlog picker).
// Colors mirror the TYPE_COLORS convention already used on the Backlog page.
export const BACKLOG_TYPE_BADGE = {
  epic:        { text: 'Epic',        className: 'bg-purple-100 text-purple-700' },
  story:       { text: 'Story',       className: 'bg-blue-100 text-blue-700' },
  task:        { text: 'Task',        className: 'bg-slate-200 text-slate-700' },
  bug:         { text: 'Bug',         className: 'bg-red-100 text-red-700' },
  independent: { text: 'Independent', className: 'bg-orange-100 text-orange-700' },
};

// Hierarchy level, not creation order: siblings are grouped by type before
// being sorted by code, so e.g. an orphan Task never lands ahead of a Story
// just because its code happens to sort lower.
const TYPE_ORDER = { epic: 0, story: 1, task: 2, bug: 3, independent: 4 };

const sortSiblings = (a, b) =>
  (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)
  || a.code.localeCompare(b.code, undefined, { numeric: true });

const toOption = (item, depth) => ({
  value: String(item.id),
  label: `[${item.code}] ${item.title}`,
  depth,
  badge: BACKLOG_TYPE_BADGE[item.type] || null,
});

// Flattens backlog items (Epic -> Story -> Task/Bug, via parent_id) into an
// ordered, indented option list for SearchableSelect: Epics and standalone
// Stories first (each followed by its descendants), then Independent items
// last as their own group. An item whose parent isn't in this set (wrong
// product, filtered out, or missing) is treated as a root rather than
// dropped, so it stays visible instead of silently disappearing.
export function buildBacklogTreeOptions(items) {
  const byId = new Map(items.map(it => [it.id, it]));
  const childrenByParent = new Map();
  for (const it of items) {
    if (it.parent_id != null && byId.has(it.parent_id)) {
      const list = childrenByParent.get(it.parent_id) || [];
      list.push(it);
      childrenByParent.set(it.parent_id, list);
    }
  }
  for (const list of childrenByParent.values()) list.sort(sortSiblings);

  const result = [];
  const visited = new Set();

  // Guards against a corrupted/circular parent_id chain, same concern as the
  // backend's recalcAncestorSp cycle guard.
  const walk = (item, depth) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    result.push(toOption(item, depth));
    for (const kid of childrenByParent.get(item.id) || []) walk(kid, depth + 1);
  };

  const roots = items
    .filter(it => it.type !== 'independent' && (it.parent_id == null || !byId.has(it.parent_id)))
    .sort(sortSiblings);
  for (const root of roots) walk(root, 0);

  const independents = items.filter(it => it.type === 'independent').sort(sortSiblings);
  for (const ind of independents) walk(ind, 0);

  return result;
}
