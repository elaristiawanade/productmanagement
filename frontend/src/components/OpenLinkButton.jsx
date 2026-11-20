import { ArrowUpRight } from 'lucide-react';

// Ctrl/Cmd/Shift/Alt or a non-left click is the browser's own "open in a new tab/window": leave it to the <a href>.
export const isNewTabClick = (e) => e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0;

/**
 * "↗ Buka <code>" button beside a relation field: the Parent field of a backlog item, the Backlog Item of a QA test case.
 * A real <a href>, not a <button>: it stays usable inside a read-only <fieldset disabled>, and Ctrl/middle click opens
 * the record in a new tab. A plain click runs onOpen() instead of following href, so the caller decides how to open it
 * (switch the modal in place, or navigate after asking about unsaved edits).
 */
export default function OpenLinkButton({ href, onOpen, code, title }) {
  return (
    <a href={href} title={title} aria-label={title}
      onClick={e => { if (isNewTabClick(e)) return; e.preventDefault(); onOpen(); }}
      className="shrink-0 self-stretch inline-flex items-center gap-1.5 px-2.5 rounded-md border border-indigo-200 bg-indigo-50 text-[13px] font-medium text-indigo-700 whitespace-nowrap transition-colors hover:bg-indigo-100 hover:border-indigo-300">
      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
      Buka <span className="font-mono text-[12px]">{code}</span>
    </a>
  );
}
