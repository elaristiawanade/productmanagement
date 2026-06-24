import { useState } from 'react';
import { User, Lock, Check, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import toast from 'react-hot-toast';

const AVATAR_COLORS = [
  '#4F46E5', '#7C3AED', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#64748B',
  '#0D9488', '#D97706', '#DC2626', '#9333EA', '#0EA5E9',
];

export default function Profile() {
  const { user, refreshUser } = useAuth();

  const [profile, setProfile] = useState({
    name:         user?.name         || '',
    email:        user?.email        || '',
    avatar_color: user?.avatarColor  || '#4F46E5',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' });
  const [savingPwd, setSavingPwd]   = useState(false);
  const [pwdVisible, setPwdVisible] = useState({ cur: false, nw: false, cf: false });

  // ── Profile save ──────────────────────────────────────────────────────────
  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!profile.name.trim())  { toast.error('Nama tidak boleh kosong');  return; }
    if (!profile.email.trim()) { toast.error('Email tidak boleh kosong'); return; }
    setSavingProfile(true);
    try {
      await client.put('/users/me', profile);
      await refreshUser();
      toast.success('Profil berhasil diperbarui');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal memperbarui profil');
    } finally { setSavingProfile(false); }
  };

  // ── Password save ─────────────────────────────────────────────────────────
  const handlePwdSave = async (e) => {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    if (pwd.new_password.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    setSavingPwd(true);
    try {
      await client.put('/users/me/password', {
        current_password: pwd.current_password,
        new_password:     pwd.new_password,
      });
      toast.success('Password berhasil diperbarui');
      setPwd({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal memperbarui password');
    } finally { setSavingPwd(false); }
  };

  const toggleVis = (key) => setPwdVisible(v => ({ ...v, [key]: !v[key] }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-lg transition-colors duration-200"
          style={{ backgroundColor: profile.avatar_color }}>
          {profile.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{user?.name}</h1>
          <span className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
            <ShieldCheck className="w-3 h-3" />
            {user?.roleDisplay || user?.role?.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <User className="w-4 h-4 text-indigo-600" />
          </div>
          <h2 className="font-semibold text-slate-700">Informasi Profil</h2>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="label">Nama Lengkap</label>
            <input
              className="input"
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              required
              placeholder="Nama lengkap"
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={profile.email}
              onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
              required
              placeholder="email@domain.com"
            />
          </div>

          <div>
            <label className="label">Warna Avatar</label>
            <div className="flex items-center gap-4 mt-2">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shadow transition-colors duration-200"
                style={{ backgroundColor: profile.avatar_color }}>
                {profile.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex gap-2 flex-wrap">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setProfile(p => ({ ...p, avatar_color: c }))}
                    className="w-7 h-7 rounded-full transition-all flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: c,
                      outline: profile.avatar_color === c ? `3px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                    title={c}>
                    {profile.avatar_color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 mt-5">
            <button type="submit" disabled={savingProfile} className="btn-primary">
              {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Password card ─────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <h2 className="font-semibold text-slate-700">Ubah Password</h2>
        </div>

        <form onSubmit={handlePwdSave} className="space-y-4">
          <PwdField
            label="Password Saat Ini"
            value={pwd.current_password}
            visible={pwdVisible.cur}
            onToggle={() => toggleVis('cur')}
            onChange={v => setPwd(p => ({ ...p, current_password: v }))}
          />

          <PwdField
            label="Password Baru"
            value={pwd.new_password}
            visible={pwdVisible.nw}
            onToggle={() => toggleVis('nw')}
            onChange={v => setPwd(p => ({ ...p, new_password: v }))}
            hint="Minimal 6 karakter"
          />

          <PwdField
            label="Konfirmasi Password Baru"
            value={pwd.confirm}
            visible={pwdVisible.cf}
            onToggle={() => toggleVis('cf')}
            onChange={v => setPwd(p => ({ ...p, confirm: v }))}
            error={pwd.confirm && pwd.new_password !== pwd.confirm ? 'Password tidak cocok' : null}
          />

          <div className="flex justify-end pt-2 border-t border-slate-100 mt-5">
            <button type="submit" disabled={savingPwd} className="btn-primary">
              {savingPwd ? 'Menyimpan...' : 'Ubah Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PwdField({ label, value, visible, onToggle, onChange, hint, error }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          className={`input pr-10 ${error ? 'border-red-300 focus:border-red-500' : ''}`}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium">
          {visible ? 'Semb.' : 'Lihat'}
        </button>
      </div>
      {hint  && !error && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
