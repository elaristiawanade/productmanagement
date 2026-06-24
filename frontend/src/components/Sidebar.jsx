import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ListTodo, Zap, Package, Users, TestTube2, FileDown, ClipboardList, Layers, CheckSquare, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_MAIN = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/my-tasks',    icon: CheckSquare,  label: 'My Tasks'     },
  { to: '/backlog',     icon: ListTodo,     label: 'Backlog'      },
  { to: '/epic-board',  icon: Layers,       label: 'Epic Board'   },
  { to: '/sprints',     icon: Zap,          label: 'Sprints'      },
  { to: '/products', icon: Package,         label: 'Products'     },
  { to: '/standup',  icon: ClipboardList,   label: 'Standup'      },
  { to: '/qa',       icon: TestTube2,       label: 'QA Module'    },
  { to: '/users',    icon: Users,           label: 'Users & Roles', roles: ['super_admin','manager'] },
];

const NAV_BOTTOM = [
  { to: '/import/jira', icon: FileDown, label: 'Import Jira', roles: ['super_admin','manager','po'] },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, hasRole } = useAuth();

  return (
    <aside
      className={`flex flex-col bg-slate-900 text-slate-100 transition-all duration-300 overflow-hidden shrink-0
        ${collapsed ? 'w-0' : 'w-60'}`}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-slate-800 gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="overflow-hidden whitespace-nowrap">
          <p className="font-bold text-sm text-white truncate leading-tight">Product Tracker</p>
          <p className="text-xs text-slate-400 truncate">Internal Dev</p>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto overflow-x-hidden">
        {NAV_MAIN.map(({ to, icon: Icon, label, roles }) => {
          if (roles && !hasRole(...roles)) return null;
          return (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                 ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`
              }>
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom nav (Import, etc.) */}
      <div className="px-2 pb-2 space-y-0.5 border-t border-slate-800 pt-2">
        {NAV_BOTTOM.map(({ to, icon: Icon, label, roles }) => {
          if (roles && !hasRole(...roles)) return null;
          return (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                 ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`
              }>
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* User info — links to profile */}
      <div className="border-t border-slate-800 px-2 py-3">
        <NavLink to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg overflow-hidden transition-colors group
             ${isActive ? 'bg-indigo-600/30' : 'hover:bg-slate-800'}`
          }>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: user?.avatarColor || '#4F46E5' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <Settings className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0 transition-colors" />
        </NavLink>
      </div>
    </aside>
  );
}
