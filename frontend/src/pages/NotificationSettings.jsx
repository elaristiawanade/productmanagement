import { useEffect, useState } from 'react';
import { Mail, Send, CheckCircle2, XCircle } from 'lucide-react';
import client from '../api/client';
import toast from 'react-hot-toast';

const EMPTY = {
  enabled: false, host: '', port: '587', username: '', password: '',
  from: '', smtp_auth: true, smtp_starttls: true, password_set: false,
};

export default function NotificationSettings() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, error } | null

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/settings/mail');
      setForm({ ...EMPTY, ...data, port: String(data.port ?? '587'), password: '' });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal memuat pengaturan email');
    } finally { setLoading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await client.put('/settings/mail', form);
      toast.success('Konfigurasi email disimpan');
      setForm(f => ({ ...f, password: '' }));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan konfigurasi');
    } finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testTo.trim()) { toast.error('Isi alamat tujuan dulu'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await client.post('/settings/mail/test', { to: testTo.trim() });
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err?.response?.data?.error || 'Gagal mengirim email tes' });
    } finally { setTesting(false); }
  };

  if (loading) return <div className="text-sm text-slate-400">Memuat...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Notification Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Atur pengiriman email notifikasi (assignment, status/stage berubah, mention) — hanya Super Admin.
        </p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Mail className="w-4 h-4 text-indigo-600" />
          </div>
          <h2 className="font-semibold text-slate-700">Konfigurasi SMTP</h2>
        </div>

        <form onSubmit={save} className="space-y-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-700">Aktifkan notifikasi email</span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SMTP Host</label>
              <input className="input" value={form.host}
                onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                placeholder="smtp.office365.com" />
            </div>
            <div>
              <label className="label">Port</label>
              <input className="input" value={form.port}
                onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                placeholder="587" />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input" value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="notify@domain.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={form.password_set ? '•••• (tidak diubah)' : 'Password/app password'} />
            </div>
            <div className="col-span-2">
              <label className="label">From Address</label>
              <input className="input" value={form.from}
                onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
                placeholder="Biasanya sama dengan Username" />
            </div>
          </div>

          <div className="flex gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
              <input type="checkbox" checked={form.smtp_auth}
                onChange={e => setForm(f => ({ ...f, smtp_auth: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              SMTP Auth
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
              <input type="checkbox" checked={form.smtp_starttls}
                onChange={e => setForm(f => ({ ...f, smtp_starttls: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              STARTTLS
            </label>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 mt-5">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Send className="w-4 h-4 text-emerald-600" />
          </div>
          <h2 className="font-semibold text-slate-700">Kirim Email Tes</h2>
        </div>

        <div className="flex gap-2">
          <input className="input flex-1" value={testTo}
            onChange={e => setTestTo(e.target.value)}
            placeholder="alamat-tujuan@domain.com" />
          <button type="button" onClick={sendTest} disabled={testing} className="btn-primary shrink-0">
            {testing ? 'Mengirim...' : 'Kirim Tes'}
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 flex items-start gap-2 text-sm rounded-lg p-3 ${
            testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {testResult.success
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{testResult.success ? 'Email tes berhasil dikirim.' : (testResult.error || 'Gagal mengirim email tes.')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
