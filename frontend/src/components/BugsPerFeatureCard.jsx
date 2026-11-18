// "Bugs per Feature" card, shared by the QA dashboard and the Bugs Incident dashboard so both show the
// same numbers the same way. Rows come from the backend (BugStats.bugsByFeature): one row per product
// feature that has bugs, most bugs first, plus a last row with feature_id = null for bugs without a feature.
// Numbers only (no chart), one column per bug stage.

// Columns are the configurable bug stages (Super Admin, /settings/bug-stages), passed in as `stages` — the same list,
// order, labels and hues as the Bugs Incident module. Each row carries `counts` (stage code -> number of bugs).
// `lines` is how a header label breaks: at most 2 lines, split on purpose (not by the browser),
// so every header ends on the same baseline ("Ready to Test" -> "Ready" / "to Test").
function splitLabel(name) {
  const words = String(name).trim().split(/\s+/);
  if (words.length < 2) return [words[0] || ""];
  let best = 1, bestMax = Infinity;
  for (let i = 1; i < words.length; i++) {
    const m = Math.max(words.slice(0, i).join(" ").length, words.slice(i).join(" ").length);
    if (m < bestMax) { bestMax = m; best = i; }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function Count({ value, color }) {
  const n = +value || 0;
  if (!n) return <span className="text-slate-300">–</span>;
  return color
    ? <span className="status-pill h-5 min-w-[22px] justify-center px-1.5 text-[11px] font-semibold tabular-nums" style={{ '--c': color }}>{n}</span>
    : <span className="font-semibold text-slate-700 tabular-nums">{n}</span>;
}

export default function BugsPerFeatureCard({ rows = [], stages = [], className = '' }) {
  const STAGE_COLUMNS = stages.map(s => ({ key: s.code, name: s.name, lines: splitLabel(s.name), color: s.color }));
  // Product code only helps when the list mixes products ("Semua Produk")
  const multiProduct = new Set(rows.filter(r => r.feature_id != null).map(r => r.product_code)).size > 1;
  const totals = STAGE_COLUMNS.reduce((acc, s) => ({ ...acc, [s.key]: rows.reduce((sum, r) => sum + (+r.counts?.[s.key] || 0), 0) }), {});
  const grandTotal = rows.reduce((sum, r) => sum + (+r.total || 0), 0);

  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="font-semibold text-slate-700">Bugs per Feature</h3>
        <span className="text-xs text-slate-400">feature produk · stage Bugs Incident</span>
        <span className="ml-auto text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{grandTotal} bug</span>
      </div>

      {rows.length === 0
        ? <p className="text-center py-10 text-sm text-slate-400">Belum ada bug</p>
        : (
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-panel">
              {/* Every header cell is bottom-aligned and ends with a 2px bar (coloured per stage, transparent for
                  Feature/Total), so all labels share one baseline whether they take one line or two. */}
              <tr className="text-[10.5px] leading-tight text-slate-500 border-b border-slate-100 align-bottom">
                <th className="text-left font-medium px-4 pt-3 pb-2 min-w-[150px]">
                  Feature
                  <i className="block mt-1.5 h-0.5" />
                </th>
                {STAGE_COLUMNS.map(s => (
                  <th key={s.key} title={s.name} className="text-center font-medium px-1 pt-3 pb-2 w-[52px] whitespace-nowrap">
                    {s.lines.map((l, i) => <span key={i} className="block">{l}</span>)}
                    <i className="block mt-1.5 h-0.5 rounded-full mx-auto w-full max-w-[40px]" style={{ background: s.color }} />
                  </th>
                ))}
                <th className="text-center font-semibold text-slate-600 px-3 pt-3 pb-2 w-[52px]">
                  Total
                  <i className="block mt-1.5 h-0.5" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const noFeature = r.feature_id == null;
                const title = noFeature ? 'Bug tanpa Feature' : `[${r.product_code}] ${r.feature_code} · ${r.feature_name}`;
                return (
                  <tr key={noFeature ? 'none' : r.feature_id} className="table-row">
                    <td className="px-4 py-2 max-w-0 w-full" title={title}>
                      {noFeature
                        ? <span className="italic text-slate-400">Tanpa Feature</span>
                        : (
                          // Code on top, name below (up to 2 lines): stays readable when the card is half width
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[10.5px]">
                              {multiProduct && <span className="shrink-0 font-semibold px-1.5 py-px rounded bg-slate-100 text-slate-500">{r.product_code}</span>}
                              <span className="truncate font-mono text-slate-400">{r.feature_code}</span>
                            </div>
                            <p className="mt-0.5 text-slate-700 line-clamp-2 break-words">{r.feature_name}</p>
                          </div>
                        )}
                    </td>
                    {STAGE_COLUMNS.map(s => (
                      <td key={s.key} className="text-center px-1 py-2"><Count value={r.counts?.[s.key]} color={s.color} /></td>
                    ))}
                    <td className="text-center px-3 py-2"><Count value={r.total} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-panel">
              <tr className="border-t border-slate-200 text-slate-600">
                <td className="px-4 py-2 font-semibold">Total</td>
                {STAGE_COLUMNS.map(s => (
                  <td key={s.key} className="text-center px-1 py-2 font-semibold tabular-nums">{totals[s.key] || <span className="text-slate-300">–</span>}</td>
                ))}
                <td className="text-center px-3 py-2 font-bold text-slate-800 tabular-nums">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
