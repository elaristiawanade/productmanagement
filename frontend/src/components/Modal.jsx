import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-5xl' };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-start justify-center px-4 pt-[6vh] pb-20">
        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
        <div className={`relative w-full ${widths[size] || widths.md} bg-white text-slate-800 rounded-xl shadow-[0_24px_64px_rgb(15_15_17/.25)] border border-slate-200`}>
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-800 min-w-0">{title}</h3>
            <button onClick={onClose} aria-label="Tutup"
              className="w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
