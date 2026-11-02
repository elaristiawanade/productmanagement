import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Popover anchored to an element, rendered into <body> with fixed positioning so it is never
// clipped by a scrolling table/board. Opens below the anchor (or above when there's no room)
// and closes on outside click, Escape, scroll or resize.
export default function FloatingMenu({ anchorRef, open, onClose, children, width, className = '' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) { setPos(null); return; }
    const r = anchorRef.current.getBoundingClientRect();
    const h = ref.current?.offsetHeight || 240, w = ref.current?.offsetWidth || width || 220;
    const below = r.bottom + 4 + h <= window.innerHeight - 8;
    setPos({
      top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - h),
      left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
    });
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onScroll = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div ref={ref} onClick={e => e.stopPropagation()}
      style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, zIndex: 70 }}
      className={`bg-white text-slate-800 border border-slate-200 rounded-lg shadow-pop p-1 max-h-[min(440px,calc(100vh-24px))] overflow-y-auto ${className}`}>
      {children}
    </div>,
    document.body,
  );
}
