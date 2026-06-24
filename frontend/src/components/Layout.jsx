import { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';

const PAGE_TITLES = {
  '/':             'Dashboard',
  '/backlog':      'Backlog Management',
  '/sprints':      'Sprint Management',
  '/products':     'Product Management',
  '/users':        'Users & Roles',
  '/qa':           'QA Module',
  '/standup':      'Daily Standup',
  '/import/jira':  'Import dari Jira',
  '/profile':      'Profile Saya',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { logout, user } = useAuth();
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Product Tracker';

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-3 px-4 shrink-0">
          {/* Hamburger — always visible */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="btn-ghost btn-sm rounded-lg p-2 shrink-0"
            title={sidebarOpen ? 'Sembunyikan sidebar' : 'Tampilkan sidebar'}>
            <Menu className="w-5 h-5 text-slate-500" />
          </button>
          <h1 className="text-lg font-semibold text-slate-800 flex-1 truncate">{title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <Link
              to="/profile"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1 transition-all"
              style={{ backgroundColor: user?.avatarColor || '#4F46E5' }}
              title={`${user?.name} — Edit Profil`}>
              {user?.name?.charAt(0).toUpperCase()}
            </Link>
            <button onClick={logout} className="btn-ghost btn-sm rounded-lg p-2" title="Logout">
              <LogOut className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
