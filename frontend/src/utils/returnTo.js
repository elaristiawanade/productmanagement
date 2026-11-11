// Where to go after login. A shared link (/backlog?item=12) opened while logged out — or with an expired
// token — must land on that record after signing in, not on the dashboard.
const KEY = 'pt_return_to';

// Only same-origin app paths; never "//host" or "/login" (open-redirect / loop guard).
const safe = (p) => typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/login') ? p : null;

// For full-page redirects (axios 401 interceptor), where router state is lost.
export function saveReturnTo(path) {
  const p = safe(path);
  try { if (p) sessionStorage.setItem(KEY, p); } catch { /* storage blocked: fall back to the dashboard */ }
}

// `fromState` is the router-state path set by PrivateRoute; falls back to the saved one. Clears the saved one.
export function takeReturnTo(fromState) {
  let saved = null;
  try { saved = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  return safe(fromState) || safe(saved) || '/';
}
