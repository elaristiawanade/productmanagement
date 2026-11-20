import { Link } from 'react-router-dom';

/**
 * "[CODE] title" of a related record in a table cell, as a way to that record:
 *   to      a route (another page's deep link, e.g. `/backlog?item=12`): a real link, so Ctrl/middle click opens a new tab
 *   onOpen  a handler (open the record in this page's own modal)
 *   neither plain text (the viewer cannot open it, or the id is unknown)
 * Stops the click, so a row that opens its own record doesn't open as well. The code turns red (accent) when it is a
 * way somewhere, and the title underlines on hover.
 */
export default function RefLink({
  to, onOpen, code, title, tip = 'Buka', codeClass = 'text-slate-400', className = 'min-w-[170px] max-w-[240px]',
}) {
  const text = `[${code}] ${title || ''}`;
  const base = `flex items-center gap-1 ${className}`;
  const linked = !!(to || onOpen);
  const inner = (
    <>
      <span className={`font-mono shrink-0 whitespace-nowrap ${linked ? 'text-indigo-600' : codeClass}`}>[{code}]</span>
      <span className={`truncate ${linked ? 'group-hover/ref:underline group-hover/ref:text-indigo-600 underline-offset-2' : ''}`}>{title}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} onClick={e => e.stopPropagation()} title={`${tip}: ${text}`} className={`group/ref ${base}`}>{inner}</Link>
    );
  }
  if (onOpen) {
    return (
      <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }} title={`${tip}: ${text}`}
        className={`group/ref ${base} text-left`}>{inner}</button>
    );
  }
  return <div className={base} title={text}>{inner}</div>;
}
