import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import loginBackground from '../assets/login_background.png';

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const { login }             = useAuth();
  const navigate              = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Login berhasil!');
      navigate('/', { replace: true });
    } catch {
      // toast already shown by axios interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50 bg-cover bg-center p-4"
      style={{ backgroundImage: `url(${loginBackground})` }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/20">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">Product Tracker</h1>
            <p className="text-slate-500 text-sm mt-1">Internal Development System</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label text-slate-600">Email</label>
              <input
                type="email"
                className="input bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-red-500"
                placeholder="nama@perusahaan.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label text-slate-600">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10 bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-red-500"
                  placeholder="Password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPw(v => !v)}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-danger w-full justify-center py-2.5" disabled={loading}>
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
