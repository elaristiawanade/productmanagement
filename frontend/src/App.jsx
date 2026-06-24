import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout     from './components/Layout';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Backlog    from './pages/Backlog';
import Sprints    from './pages/Sprints';
import Products   from './pages/Products';
import Users      from './pages/Users';
import QA         from './pages/QA';
import JiraImport from './pages/JiraImport';
import Standup    from './pages/Standup';
import EpicBoard  from './pages/EpicBoard';
import MyTask     from './pages/MyTask';
import Profile    from './pages/Profile';

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

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index       element={<Dashboard />} />
        <Route path="backlog"      element={<Backlog />} />
        <Route path="sprints"      element={<Sprints />} />
        <Route path="products"     element={<Products />} />
        <Route path="users"        element={<Users />} />
        <Route path="qa"           element={<QA />} />
        <Route path="standup"       element={<Standup />} />
        <Route path="epic-board"    element={<EpicBoard />} />
        <Route path="my-tasks"      element={<MyTask />} />
        <Route path="import/jira"  element={<JiraImport />} />
        <Route path="profile"      element={<Profile />} />
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
