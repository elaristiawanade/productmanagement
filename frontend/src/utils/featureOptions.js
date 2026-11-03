// Options for the Feature picker in the QA test case / Bugs Incident forms
// (SearchableSelect). Features come from GET /features (Products → Features tab),
// not from the roadmap. The product code is part of the label so the picker's
// search box — which only matches the label — finds a feature by product code too,
// and so rows stay unambiguous while no product is selected yet.
export function buildFeatureOptions(features, products, productId) {
  const codeByProduct = new Map(products.map(p => [p.id, p.code]));
  return features
    .filter(f => !productId || +f.product_id === +productId)
    .sort((a, b) =>
      (codeByProduct.get(a.product_id) || '').localeCompare(codeByProduct.get(b.product_id) || '')
      || a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map(f => ({
      value: String(f.id),
      label: `[${codeByProduct.get(f.product_id) || '?'}] ${f.code} · ${f.name}`,
    }));
}

// Compact "[CODE] Name" form used by the CSV exports (matches the Backlog Item column).
export const featureText = (row) =>
  row.feature_code ? `[${row.feature_code}] ${row.feature_name || ''}`.trim() : '';
