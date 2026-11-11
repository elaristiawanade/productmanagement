import { Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { copyText, shareUrl } from '../utils/shareLink';

// Copies a share link for a record. `path` is its deep link (e.g. `/backlog?item=12`).
// Used in modal headers (via <Modal shareLink>) and as a small icon button on rows/cards.
export default function CopyLinkButton({ path, label = 'Salin link', className = '' }) {
  if (!path) return null;
  const onClick = async (e) => {
    e.stopPropagation();   // sits inside clickable rows/cards
    e.preventDefault();
    const url = shareUrl(path);
    if (await copyText(url)) toast.success('Link disalin');
    else window.prompt('Salin link ini (Ctrl+C):', url);   // last resort when the browser blocks copying
  };
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={`w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 shrink-0 ${className}`}>
      <LinkIcon className="w-3.5 h-3.5" />
    </button>
  );
}
