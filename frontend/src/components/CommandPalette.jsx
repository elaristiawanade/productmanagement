import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SECTIONS, visibleItems } from './navConfig';
import { StatusIcon } from './StatusBadge';

// Ctrl/⌘ K palette: jump to any page the user may open, or find a backlog item by code/title.
// Items open through /backlog?item=<id>, the same deep link notifications use.
export default function CommandPalette({ open, onClose }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [searching, setSearching] = useState(false);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const pages = useMemo(() => SECTIONS.flatMap(s => visibleItems(s, can).map(it => ({ ...it, section: s.label }))), [can]);

  useEffect(() => {
    if (!open) return;
    setQ(''); setItems([]); setIdx(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Debounced item search (2+ characters)
  useEffect(() => {
    if (!open || q.trim().length < 2) { setItems([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      client.get('/backlog', { params: { search: q.trim(), limit: 8 } })
        .then(r => setItems(r.data.items || []))
        .catch(() => setItems([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const query = q.trim().toLowerCase();
  const pageHits = pages.filter(p => !query || p.label.toLowerCase().includes(query) || p.section.toLowerCase().includes(query));
  const results = [
    ...pageHits.map(p => ({ key: `p${p.to}`, kind: 'page', p, go: () => navigate(p.to) })),
    ...items.map(it => ({ key: `i${it.id}`, kind: 'item', it, go: () => navigate(`/backlog?item=${it.id}`) })),
  ];

  useEffect(() => { setIdx(0); }, [q, items.length]);
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [idx]);

  if (!open) return null;

  const run = (r) => { onClose(); r.go(); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[idx]) run(results[idx]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const groupLabel = (text) => <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[.06em] text-slate-400">{text}</p>;
  const row = (r, i, children) => (
    <button key={r.key} type="button" data-active={i === idx} onMouseMove={() => setIdx(i)} onClick={() => run(r)}
      className={`w-full flex items-center gap-2.5 min-h-9 px-2 py-1.5 rounded-md text-left text-[13px] text-slate-800 ${i === idx ? 'bg-slate-100' : ''}`}>
      {children}
      {i === idx && <CornerDownLeft className="w-3.5 h-3.5 ml-auto text-slate-400 shrink-0" />}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-start justify-center px-4 pt-[10vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Cari" onMouseDown={e => e.stopPropagation()}
        className="w-full max-w-[600px] bg-white text-slate-800 rounded-xl border border-slate-200 shadow-[0_24px_64px_rgb(15_15_17/.25)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-slate-200 text-slate-400">
          <Search className="w-[18px] h-[18px] shrink-0" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Cari halaman atau backlog item (kode / judul)…" aria-label="Kata kunci"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none" />
          {searching && <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div ref={listRef} className="max-h-[min(420px,56vh)] overflow-y-auto p-1.5">
          {pageHits.length > 0 && groupLabel('Halaman')}
          {results.map((r, i) => r.kind === 'page' ? row(r, i, (
            <>
              <r.p.icon className="w-4 h-4 text-slate-500 shrink-0" />
              <span>{r.p.label}</span>
              <span className="text-xs text-slate-400">{r.p.section}</span>
            </>
          )) : (
            <div key={r.key}>
              {i === pageHits.length && groupLabel('Backlog item')}
              {row(r, i, (
                <>
                  <StatusIcon status={r.it.status} />
                  <span className="font-mono text-[11.5px] text-slate-400 shrink-0">{r.it.code}</span>
                  <span className="truncate">{r.it.title}</span>
                </>
              ))}
            </div>
          ))}
          {results.length === 0 && !searching && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">Tidak ada hasil untuk “{q}”</p>
          )}
        </div>
        <div className="flex flex-wrap gap-4 px-4 py-2 border-t border-slate-200 text-[11.5px] text-slate-400">
          <span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> pilih</span>
          <span><kbd className="kbd">Enter</kbd> buka</span>
          <span><kbd className="kbd">Esc</kbd> tutup</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
