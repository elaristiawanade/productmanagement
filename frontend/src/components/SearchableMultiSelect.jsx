import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

// Multi-select dropdown with a client-side search box. Drop-in replacement for
// the checkbox-only `MultiSelect` pattern (same `label`/`options`/`selected`/
// `onChange`/`minWidth` contract, options as `{ v, l }`) for lists long enough
// that scanning them without search is impractical — e.g. assignees.
export default function SearchableMultiSelect({
  label,
  options,
  selected,
  onChange,
  minWidth = 160,
  searchPlaceholder = 'Cari...',
  emptyMessage = 'Tidak ada opsi',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const toggle = (v) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.l.toLowerCase().includes(q));
  }, [options, query]);

  const count = selected.length;
  const buttonLabel = count === 0
    ? `Semua ${label}`
    : count === 1
      ? (options.find(o => o.v === selected[0])?.l ?? `${label} (1)`)
      : `${label} (${count})`;

  return (
    <div className="relative" ref={ref} style={{ minWidth }}>
      <button type="button" disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`select w-full flex items-center justify-between gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${count ? '!border-indigo-200 !bg-indigo-50 text-indigo-800' : 'text-slate-600'}`}>
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-pop overflow-hidden">
          <div className="relative border-b border-slate-200">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); setQuery(''); } }}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-2 py-2 text-[13px] bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {count > 0 && (
              <button type="button" onClick={() => onChange([])}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 mb-1">
                Bersihkan pilihan
              </button>
            )}
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">{emptyMessage}</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">Tidak ada hasil untuk "{query}"</p>
            ) : (
              filtered.map(o => {
                const on = selected.includes(o.v);
                return (
                  <button key={o.v} type="button" onClick={() => toggle(o.v)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors ${on ? 'text-slate-800' : 'text-slate-700'} hover:bg-slate-100`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate">{o.l}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
