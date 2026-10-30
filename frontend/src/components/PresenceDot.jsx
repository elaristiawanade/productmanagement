import { formatDistanceToNow, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { usePresence } from '../context/PresenceContext';

const STYLE = {
  online:  { cls: 'bg-[#22C55E]', label: 'Online' },
  away:    { cls: 'bg-[#F59E0B]', label: 'Away (tab tidak aktif / diam)' },
  offline: { cls: 'bg-[#9CA3AF]', label: 'Offline' },
};

// Status dot for an avatar. The avatar wrapper must be `relative`.
// `ring` is the border colour separating the dot from the avatar's background.
export default function PresenceDot({ userId, size = 'md', ring = 'border-panel', className = '' }) {
  const { statusOf } = usePresence();
  const p = statusOf(userId);
  const s = STYLE[p.status] || STYLE.offline;
  const seen = p.status !== 'online' && (p.last_active_at || p.last_seen_at);
  let title = s.label;
  if (seen) {
    try { title += ` · terakhir aktif ${formatDistanceToNow(parseISO(String(seen)), { addSuffix: true, locale: localeId })}`; } catch { /* unparsable date: label only */ }
  }
  const sz = size === 'sm' ? 'w-2 h-2 border-[1.5px]' : 'w-2.5 h-2.5 border-2';
  return (
    <span title={title} aria-label={s.label} role="img"
      className={`absolute -right-0.5 -bottom-0.5 rounded-full ${sz} ${ring} ${s.cls} ${className}`} />
  );
}
