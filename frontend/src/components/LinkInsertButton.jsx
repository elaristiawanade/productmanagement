import { useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { formatLinkSnippet } from '../utils/linkify';

// Small popover button that lets the user paste a URL (+ optional label) and
// inserts the resulting snippet into a comment/notes field via onInsert.
export default function LinkInsertButton({ onInsert }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const ref = useRef(null);
  const urlRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => urlRef.current?.focus(), 0);
  }, [open]);

  const insert = () => {
    if (!url.trim()) return;
    onInsert(formatLinkSnippet(url, label));
    setUrl('');
    setLabel('');
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Sisipkan tautan"
        className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 shrink-0"
        onClick={() => setOpen(o => !o)}
      >
        <Link2 className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3 space-y-2">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Sisipkan Tautan</p>
          <input
            ref={urlRef}
            className="input text-xs py-1.5"
            placeholder="URL (https://...)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insert(); } if (e.key === 'Escape') setOpen(false); }}
          />
          <input
            className="input text-xs py-1.5"
            placeholder="Teks tampilan (opsional)"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insert(); } if (e.key === 'Escape') setOpen(false); }}
          />
          <button type="button" className="btn-primary text-xs py-1 px-2 w-full" onClick={insert} disabled={!url.trim()}>
            Sisipkan
          </button>
        </div>
      )}
    </div>
  );
}
