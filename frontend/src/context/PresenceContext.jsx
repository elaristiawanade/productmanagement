import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

// Online / away / offline for avatar dots (backend: /api/presence, table user_presence).
//   online  = this tab is visible and the user did something in the last IDLE_MS
//   away    = a tab is open but hidden or idle
//   offline = no tab open (heartbeats stopped) or logged out
// Uses fetch instead of api/client on purpose: presence is best-effort, so a failed beat must not
// pop the global error toast or trigger the 401 redirect every 30 seconds.
const API = import.meta.env.VITE_API_URL || '/api';
const BEAT_MS = 30000;
const POLL_MS = 30000;
const IDLE_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];

const PresenceContext = createContext({ statusOf: () => ({ status: 'offline' }), goOffline: () => {} });

function presenceFetch(path, options = {}) {
  const token = localStorage.getItem('pt_token');
  if (!token) return Promise.resolve(null);
  return fetch(`${API}/presence${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);
}

export function PresenceProvider({ children }) {
  const { user } = useAuth();
  const [byUser, setByUser] = useState({});
  const [selfStatus, setSelfStatus] = useState('online');
  const lastActivity = useRef(Date.now());

  const refresh = useCallback(() => presenceFetch('').then(rows => {
    if (Array.isArray(rows)) setByUser(Object.fromEntries(rows.map(r => [String(r.user_id), r])));
  }), []);

  const beat = useCallback(() => {
    const state = document.visibilityState === 'visible' && Date.now() - lastActivity.current < IDLE_MS ? 'online' : 'away';
    setSelfStatus(state);
    return presenceFetch('/heartbeat', { method: 'POST', body: JSON.stringify({ state }) });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    beat().then(refresh);
    const beatTimer = setInterval(beat, BEAT_MS);
    const pollTimer = setInterval(refresh, POLL_MS);
    const onVisibility = () => beat().then(refresh);
    // Coming back from idle should flip to online right away, not at the next beat
    const onActivity = () => {
      const wasIdle = Date.now() - lastActivity.current >= IDLE_MS;
      lastActivity.current = Date.now();
      if (wasIdle) beat();
    };
    document.addEventListener('visibilitychange', onVisibility);
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      clearInterval(beatTimer);
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, [user?.id, beat, refresh]);

  // The signed-in user's own dot comes from this tab, so it never lags behind the poll.
  const statusOf = useCallback((userId) => {
    if (userId == null) return { status: 'offline' };
    if (user?.id != null && String(userId) === String(user.id)) return { ...byUser[String(userId)], status: selfStatus };
    return byUser[String(userId)] || { status: 'offline' };
  }, [byUser, selfStatus, user?.id]);

  // Called before logout (while the token still exists); keepalive lets it finish during navigation.
  const goOffline = useCallback(() => presenceFetch('/offline', { method: 'POST', keepalive: true }), []);

  return (
    <PresenceContext.Provider value={{ statusOf, goOffline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export const usePresence = () => useContext(PresenceContext);
