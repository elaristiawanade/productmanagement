import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { LogOut, Menu, ChevronsRight, User } from 'lucide-react';
import Sidebar, { IconRail } from './Sidebar';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import { pageMeta } from './navConfig';
import { useAuth } from '../context/AuthContext';

const readCollapsed = () => {
  try { return localStorage.getItem('pt_sidebar_collapsed') === '1'; } catch { return false; }
};

function UserMenu() {
  const { logout, user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} aria-label="Menu akun" aria-expanded={open}
        title={`${user?.name} — Menu akun`}
        className="w-8 h-8 ml-1 rounded-full grid place-items-center hover:ring-2 hover:ring-frame-3 transition-shadow">
        <span className="w-7 h-7 rounded-full grid place-items-center text-white text-xs font-semibold"
          style={{ backgroundColor: user?.avatarColor || '#4F46E5' }}>
          {user?.name?.charAt(0).toUpperCase()}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white text-slate-800 rounded-xl shadow-pop border border-slate-200 z-50 p-1.5">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-semibold shrink-0"
              style={{ backgroundColor: user?.avatarColor || '#4F46E5' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize truncate">{user?.roleDisplay || user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div className="h-px bg-slate-200 my-1.5" />
          <Link to="/profile" onClick={() => setOpen(false)}
            className="flex items-center gap-2 h-8 px-2 rounded-md text-[13px] hover:bg-slate-100">
            <User className="w-4 h-4 text-slate-500" />Profile
          </Link>
          <button onClick={logout}
            className="w-full flex items-center gap-2 h-8 px-2 rounded-md text-[13px] hover:bg-slate-100">
            <LogOut className="w-4 h-4 text-slate-500" />Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);   // desktop: secondary sidebar hidden
  const [drawer, setDrawer] = useState(false);                 // mobile: rail + sidebar slide in
  const location = useLocation();
  const { section, item } = pageMeta(location.pathname);
  const PageIcon = item.icon;
  const SectionIcon = section.icon;

  useEffect(() => { setDrawer(false); }, [location.pathname]);

  const setCollapsedSaved = (v) => {
    setCollapsed(v);
    try { localStorage.setItem('pt_sidebar_collapsed', v ? '1' : '0'); } catch { /* not persisted */ }
  };
  const toggleMenu = () => {
    if (window.matchMedia('(max-width: 767px)').matches) setDrawer(v => !v);
    else setCollapsedSaved(!collapsed);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-frame">
      {/* Top bar */}
      <header className="h-12 shrink-0 flex items-center gap-3 pl-3.5 pr-3 text-frame-ink">
        <button onClick={toggleMenu} aria-label="Buka/tutup menu"
          title={collapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
          className="w-8 h-8 grid place-items-center rounded-md text-frame-ink-2 hover:bg-frame-2 hover:text-[#fff]">
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src="/logo-mark.png" alt="PT Abhimata Persada" className="w-7 h-7 rounded-[7px] bg-[#fff] p-0.5 shrink-0" />
          <span className="hidden sm:block font-semibold text-[13.5px] whitespace-nowrap">
            PTAP <span className="text-frame-ink-2 font-medium">· Product Tracker</span>
          </span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-1 shrink-0">
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {/* Rail + secondary sidebar: inline on desktop, a drawer under the top bar on mobile */}
        <div className={`flex shrink-0 max-md:fixed max-md:top-12 max-md:bottom-0 max-md:left-0 max-md:z-40 max-md:bg-frame
          max-md:transition-transform max-md:duration-200 ${drawer ? '' : 'max-md:-translate-x-full'}`}>
          <IconRail activeKey={section.key} />
          <div className={`w-[264px] max-md:w-[min(264px,calc(100vw-104px))] rounded-tl-xl max-md:rounded-none overflow-hidden
            ${collapsed ? 'md:hidden' : ''}`}>
            <Sidebar section={section} onCollapse={() => setCollapsedSaved(true)} />
          </div>
        </div>
        {drawer && <div className="md:hidden fixed inset-0 top-12 bg-black/45 z-30" onClick={() => setDrawer(false)} />}

        {/* Work panel */}
        <main className={`flex-1 min-w-0 overflow-y-auto bg-panel ${collapsed ? 'md:rounded-tl-xl' : ''}`}>
          <div className="sticky top-0 z-20 bg-panel border-b border-slate-200 px-6 max-md:px-4 h-12 flex items-center gap-2">
            {collapsed && (
              <button onClick={() => setCollapsedSaved(false)} title="Tampilkan sidebar" aria-label="Tampilkan sidebar"
                className="hidden md:grid w-7 h-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <ChevronsRight className="w-4 h-4" />
              </button>
            )}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0 text-[13.5px] text-slate-500">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-1.5 whitespace-nowrap">
                <SectionIcon className="w-3.5 h-3.5" />{section.label}
              </span>
              <span className="hidden sm:inline text-slate-400">/</span>
              <h1 className="inline-flex items-center gap-1.5 px-1.5 font-semibold text-slate-800 truncate">
                <PageIcon className="w-3.5 h-3.5 shrink-0" />{item.label}
              </h1>
            </nav>
          </div>
          <div className="p-6 max-md:p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
