import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';

// Single-select dropdown with a client-side search box, styled to match the
// plain `.select` it replaces. `options` is filtered locally by `label`, so
// it's meant for lists already loaded in full (no server round-trip).
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  emptyOptionLabel,
  emptyMessage = 'Tidak ada opsi',
  disabled = false,
  className = '',
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

  const selected = options.find(o => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const pick = (v) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`select w-full flex items-center justify-between gap-2 text-left ${!selected ? 'text-slate-400' : 'text-slate-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="relative border-b border-slate-100">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); setQuery(''); } }}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-2 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {emptyOptionLabel && (
              <button type="button" onClick={() => pick('')}
                className={`w-full text-left px-3 py-1.5 text-sm truncate transition-colors ${!value ? 'text-indigo-700 bg-indigo-50/50 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}>
                {emptyOptionLabel}
              </button>
            )}
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">{emptyMessage}</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">Tidak ada hasil untuk "{query}"</p>
            ) : (
              filtered.map(o => (
                <button key={o.value} type="button" onClick={() => pick(o.value)}
                  className={`w-full text-left px-3 py-1.5 text-sm truncate transition-colors ${String(o.value) === String(value) ? 'text-indigo-700 bg-indigo-50/50 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
