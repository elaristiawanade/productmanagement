import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout     from './components/Layout';
import Login      from './pages/Login';
import ReportBug  from './pages/ReportBug';
import Dashboard  from './pages/Dashboard';
import Backlog    from './pages/Backlog';
import Sprints    from './pages/Sprints';
import Products   from './pages/Products';
import Users      from './pages/Users';
import QA         from './pages/QA';
import BugsIncident from './pages/BugsIncident';
import JiraImport from './pages/JiraImport';
import Standup    from './pages/Standup';
import EpicBoard  from './pages/EpicBoard';
import MyTask     from './pages/MyTask';
import Profile    from './pages/Profile';
import CLevel     from './pages/CLevel';
import NotificationSettings from './pages/NotificationSettings';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Memuat...</span>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

// Route-level gate for fully-private modules (Users, Bugs, C-Level, Settings, Import Jira).
// Other modules stay open-read for any logged-in user — see plan §2/§6.
function RequirePermission({ module, action, children }) {
  const { can } = useAuth();
  if (!can(module, action)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400 text-sm">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/report-bug" element={<ReportBug />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index       element={<Dashboard />} />
        <Route path="backlog"      element={<Backlog />} />
        <Route path="sprints"      element={<Sprints />} />
        <Route path="products"     element={<Products />} />
        <Route path="users"        element={<RequirePermission module="users" action="update"><Users /></RequirePermission>} />
        <Route path="qa"           element={<QA />} />
        <Route path="bugs"         element={<RequirePermission module="bugs" action="access"><BugsIncident /></RequirePermission>} />
        <Route path="standup"       element={<Standup />} />
        <Route path="epic-board"    element={<EpicBoard />} />
        <Route path="my-tasks"      element={<MyTask />} />
        <Route path="c-level"      element={<RequirePermission module="c_level" action="access"><CLevel /></RequirePermission>} />
        <Route path="import/jira"  element={<RequirePermission module="import" action="run"><JiraImport /></RequirePermission>} />
        <Route path="profile"      element={<Profile />} />
        <Route path="settings/notifications" element={<RequirePermission module="settings" action="update"><NotificationSettings /></RequirePermission>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
