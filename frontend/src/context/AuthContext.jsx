import { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('pt_user');
    const token  = localStorage.getItem('pt_token');
    if (stored && token) {
      setUser(JSON.parse(stored));
      // Verify token is still valid
      client.get('/auth/me').then(r => {
        setUser(r.data);
        localStorage.setItem('pt_user', JSON.stringify(r.data));
      }).catch(() => logout()).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    localStorage.setItem('pt_token', data.token);
    localStorage.setItem('pt_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('pt_token');
    localStorage.removeItem('pt_user');
    setUser(null);
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    if (user.permissions?.all) return true;
    return roles.includes(user.role);
  };

  const hasPermission = (permKey) => {
    if (!user) return false;
    if (user.permissions?.all) return true;
    return !!user.permissions?.[permKey];
  };

  const refreshUser = async () => {
    const r = await client.get('/auth/me');
    setUser(r.data);
    localStorage.setItem('pt_user', JSON.stringify(r.data));
    return r.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
