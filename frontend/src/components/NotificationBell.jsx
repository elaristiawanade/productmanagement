import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const TYPE_ICON = {
  assignment:    '🎯',
  status_change: '🔄',
  mention:       '💬',
};

export default function NotificationBell() {
  const [open,        setOpen]        = useState(false);
  const [unread,      setUnread]      = useState(0);
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Poll unread count every 30 s
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchCount = async () => {
    try {
      const res = await client.get('/notifications/unread-count');
      setUnread(res.data.count || 0);
    } catch { /* silent */ }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await client.get('/notifications');
      setItems(res.data || []);
    } finally { setLoading(false); }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchItems();
  };

  const markRead = async (notif) => {
    if (!notif.is_read) {
      await client.patch(`/notifications/${notif.id}/read`).catch(() => {});
      setItems(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    }
    if (notif.link) {
      setOpen(false);
      // Extract item param and navigate
      const url = new URL(notif.link, window.location.origin);
      navigate(url.pathname + url.search);
    }
  };

  const markAllRead = async () => {
    await client.patch('/notifications/read-all').catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleOpen}
        className="relative w-8 h-8 grid place-items-center rounded-md text-frame-ink-2 hover:bg-frame-2 hover:text-[#fff] transition-colors"
        title="Notifikasi">
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none border-2 border-frame">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-24px)] bg-white text-slate-800 rounded-xl shadow-pop border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">
              Notifikasi {unread > 0 && <span className="ml-1 text-xs font-normal text-indigo-600">({unread} baru)</span>}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead}
                className="text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md px-2 py-1 -mr-2 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" />
                Tandai semua
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Tidak ada notifikasi
              </div>
            ) : (
              items.map(n => (
                <button key={n.id} onClick={() => markRead(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex gap-3 ${!n.is_read ? 'bg-indigo-50/50' : ''}`}>
                  <span className="text-lg shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] || '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!n.is_read ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {n.created_at ? formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: localeId }) : ''}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
