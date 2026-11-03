import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// One-shot URL params (?bug=12, ?new=1) used by the Ctrl K palette and notification links.
// When any of `keys` is present, `onParams({ key: value|null })` runs once and the keys are removed
// from the URL (replace), so a refresh doesn't reopen the modal and choosing the same target again
// still changes the URL and fires again.
export function useDeepLink(keys, onParams) {
  const [searchParams, setSearchParams] = useSearchParams();
  const signature = keys.map(k => searchParams.get(k) ?? '').join('|');

  useEffect(() => {
    const values = Object.fromEntries(keys.map(k => [k, searchParams.get(k)]));
    if (!keys.some(k => values[k])) return;
    onParams(values);
    setSearchParams(p => {
      const next = new URLSearchParams(p);
      keys.forEach(k => next.delete(k));
      return next;
    }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
