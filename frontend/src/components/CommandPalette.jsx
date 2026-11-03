import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SECTIONS, EXTRA_PAGES, visibleItems } from './navConfig';
import { StatusIcon, STATUS_MAP } from './StatusBadge';
import { ACTIONS, PRODUCT_ACTIONS, SERVER_SOURCES, LIST_SOURCES, allowed, fetchList, matches } from './paletteConfig';

const PER_GROUP = 5;   // client-side lists show this many rows per group

// Ctrl/⌘ K palette: jump to any page, start a "new …" action, or find any record (backlog item, bug, test case,
// sprint, product, epic, feature, roadmap, leader task, user, role, department). Everything shown is filtered by
// the signed-in role's permissions (paletteConfig.js); records open through one-shot deep links on their page.
export default function CommandPalette({ open, onClose }) {
  const { can, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [serverHits, setServerHits] = useState({});   // source key -> rows returned by the server search
  const [lists, setLists] = useState({});             // source key -> full list, loaded once per palette session
  const [searching, setSearching] = useState(false);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const requested = useRef(new Set());                // list sources already requested this session
  const session = useRef(0);                          // bumped on every open; late list responses from an older one are dropped

  const pages = useMemo(() => [
    ...SECTIONS.flatMap(s => visibleItems(s, can).map(it => ({ ...it, section: s.label }))),
    ...Object.entries(EXTRA_PAGES).map(([to, p]) => ({ to, ...p, section: SECTIONS.find(s => s.key === p.section)?.label })),
  ], [can]);

  useEffect(() => {
    if (!open) return;
    setQ(''); setServerHits({}); setLists({}); setIdx(0);
    requested.current = new Set();   // lists are re-fetched each time the palette opens, so new records show up
    session.current += 1;
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Debounced lookups (2+ characters): server-side search for the big lists, one-time loads for the small ones.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setServerHits({}); setSearching(false); return; }
    let stale = false;
    setSearching(true);
    const t = setTimeout(() => {
      const serverJobs = SERVER_SOURCES.filter(s => allowed(s.gates, can)).map(s =>
        s.fetch(term).then(rows => [s.key, rows]).catch(() => [s.key, []]));
      // Lists load once per session and survive further keystrokes, so they're applied even if this run went stale
      const sid = session.current;
      const listJobs = LIST_SOURCES.filter(s => allowed(s.gates, can) && !requested.current.has(s.key)).map(s => {
        requested.current.add(s.key);
        return fetchList(s.url).then(rows => {
          if (session.current === sid) setLists(prev => ({ ...prev, [s.key]: Array.isArray(rows) ? rows : [] }));
        }).catch(() => {});
      });
      Promise.all([Promise.all(serverJobs), Promise.all(listJobs)]).then(([hits]) => {
        if (!stale) setServerHits(Object.fromEntries(hits));
      }).finally(() => { if (!stale) setSearching(false); });
    }, 200);
    return () => { stale = true; clearTimeout(t); };
  // `can` changes identity on every auth render; the permission set itself only changes with the user
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, user?.id]);

  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    const out = [];
    const add = (group, r) => out.push({ group, ...r });

    pages.filter(p => !query || matches(query, [p.label, p.section])).forEach(p =>
      add('Halaman', { key: `p${p.to}`, icon: p.icon, title: p.label, sub: p.section, to: p.to }));

    const wanted = (a) => allowed(a.gates, can) && (!query || matches(query, [a.label, a.words, 'baru buat tambah new create add']));
    ACTIONS.filter(wanted).forEach(a =>
      add('Aksi', { key: `a${a.id}`, icon: a.icon, action: true, title: a.label, to: a.to }));
    // Per-product actions only when the query asks for them, otherwise the empty palette would be a wall of rows
    if (query) {
      const products = lists.products || [];
      PRODUCT_ACTIONS.filter(a => allowed(a.gates, can)).forEach(a => products.forEach(p => {
        const label = a.label(p);
        if (matches(query, [label, a.words, 'baru buat tambah new create add'])) {
          add('Aksi', { key: `a${a.id}${p.id}`, icon: a.icon, action: true, title: label, to: a.to(p) });
        }
      }));
    }

    if (query.length >= 2) {
      const productName = (id) => (lists.products || []).find(p => p.id === id)?.name;
      const ctx = { productName };
      SERVER_SOURCES.forEach(s => (serverHits[s.key] || []).forEach(row =>
        add(s.label, { key: `${s.key}${row.id}`, icon: s.icon, ...s.row(row, ctx) })));
      LIST_SOURCES.forEach(s => {
        if (!allowed(s.gates, can)) return;
        (lists[s.key] || [])
          .filter(row => matches(query, s.text(row)))
          .slice(0, PER_GROUP)
          .forEach(row => add(s.label, { key: `${s.key}${row.id}`, icon: s.icon, ...s.row(row, ctx) }));
      });
    }
    return out;
  }, [query, pages, can, serverHits, lists]);

  useEffect(() => { setIdx(0); }, [q, results.length]);
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [idx]);

  if (!open) return null;

  // On the page that is already open, keep its other params (e.g. the sidebar's ?product=) when adding a deep link
  const go = (to) => {
    const [path, qs] = to.split('?');
    if (qs && path === location.pathname) {
      const next = new URLSearchParams(location.search);
      new URLSearchParams(qs).forEach((v, k) => next.set(k, v));
      navigate(`${path}?${next}`);
    } else {
      navigate(to);
    }
  };
  const run = (r) => { onClose(); go(r.to); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[idx]) run(results[idx]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const groupLabel = (text) => <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[.06em] text-slate-400">{text}</p>;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-start justify-center px-4 pt-[10vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Cari" onMouseDown={e => e.stopPropagation()}
        className="w-full max-w-[600px] bg-white text-slate-800 rounded-xl border border-slate-200 shadow-[0_24px_64px_rgb(15_15_17/.25)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-slate-200 text-slate-400">
          <Search className="w-[18px] h-[18px] shrink-0" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Cari halaman, tiket, atau aksi…" aria-label="Kata kunci"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none" />
          {searching && <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div ref={listRef} className="max-h-[min(420px,56vh)] overflow-y-auto p-1.5">
          {results.map((r, i) => (
            <div key={r.key}>
              {r.group !== results[i - 1]?.group && groupLabel(r.group)}
              <button type="button" data-active={i === idx} onMouseMove={() => setIdx(i)} onClick={() => run(r)}
                className={`w-full flex items-center gap-2.5 min-h-9 px-2 py-1.5 rounded-md text-left text-[13px] text-slate-800 ${i === idx ? 'bg-slate-100' : ''}`}>
                {r.action ? <Plus className="w-4 h-4 text-indigo-600 shrink-0" />
                  : r.status && STATUS_MAP[r.status] ? <StatusIcon status={r.status} />
                  : <r.icon className="w-4 h-4 text-slate-500 shrink-0" />}
                {r.code && <span className="font-mono text-[11.5px] text-slate-400 shrink-0">{r.code}</span>}
                <span className="truncate">{r.title}</span>
                {r.sub && <span className="text-xs text-slate-400 truncate">{r.sub}</span>}
                {i === idx && <CornerDownLeft className="w-3.5 h-3.5 ml-auto text-slate-400 shrink-0" />}
              </button>
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
