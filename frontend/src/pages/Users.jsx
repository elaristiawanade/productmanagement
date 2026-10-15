import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, UserX, UserCheck, Key, Shield, Package, Trash2, AlertTriangle, Building2 } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

const ROLE_COLORS = {
  super_admin:  'bg-purple-100 text-purple-700',
  manager:      'bg-blue-100 text-blue-700',
  po:           'bg-indigo-100 text-indigo-700',
  developer:    'bg-emerald-100 text-emerald-700',
  qa:           'bg-amber-100 text-amber-700',
  sme:          'bg-cyan-100 text-cyan-700',
  commissioner: 'bg-rose-100 text-rose-700',
};

const AVATAR_COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
const SWATCH_COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#64748B'];

// ─── UserForm ─────────────────────────────────────────────────────────────────
function UserForm({ user, roles, products, onSave, onClose }) {
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '',
    password: '', role_id: user?.role_id || '',
    avatar_color: user?.avatar_color || '#4F46E5',
    is_active: user?.is_active ?? true,
  });
  const [selectedProducts, setSelectedProducts] = useState(
    () => new Set((user?.products || []).map(p => p.id))
  );
  const [saving, setSaving] = useState(false);

  const toggleProduct = (id) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let userId = user?.id;
      if (userId) {
        const { password, ...rest } = form;
        await client.put(`/users/${userId}`, rest);
      } else {
        if (!form.password) { toast.error('Password wajib untuk user baru'); return; }
        const res = await client.post('/users', form);
        userId = res.data.id;
      }
      await client.put(`/users/${userId}/products`, { product_ids: [...selectedProducts] });
      toast.success(user?.id ? 'User diperbarui' : 'User dibuat');
      onSave();
    } catch {} finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4">
      <div>
        <label className="label">Nama Lengkap *</label>
        <input className="input" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      </div>
      <div>
        <label className="label">Email *</label>
        <input type="email" className="input" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
      </div>
      {!user?.id && (
        <div className="col-span-2">
          <label className="label">Password *</label>
          <input type="password" className="input" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Min. 6 karakter" required />
        </div>
      )}
      <div>
        <label className="label">Role</label>
        <select className="select" value={form.role_id}
          onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
          <option value="">— Pilih Role —</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Status</label>
        <select className="select" value={form.is_active}
          onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Warna Avatar</label>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_COLORS.map(c => (
            <button type="button" key={c} onClick={() => setForm(f => ({ ...f, avatar_color: c }))}
              className={`w-7 h-7 rounded-full border-2 transition-all ${form.avatar_color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <label className="label flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-slate-400" />
          Akses Produk
          <span className="text-xs font-normal text-slate-400 ml-1">(min. 1 produk)</span>
        </label>
        {products.length === 0 ? (
          <p className="text-xs text-slate-400">Belum ada produk.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 mt-1 border border-slate-200 rounded-lg p-3 bg-slate-50">
            {products.map(p => (
              <label key={p.id}
                className="flex items-center gap-3 cursor-pointer hover:bg-white rounded-md px-2 py-1.5 transition-colors">
                <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600"
                  checked={selectedProducts.has(p.id)} onChange={() => toggleProduct(p.id)} />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#4F46E5' }} />
                <span className="text-sm text-slate-700">
                  <span className="font-mono text-xs text-slate-400 mr-1">{p.code}</span>
                  {p.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : (user?.id ? 'Perbarui' : 'Buat User')}
        </button>
      </div>
    </form>
  );
}

// ─── ResetPasswordForm ────────────────────────────────────────────────────────
function ResetPasswordForm({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving]     = useState(false);
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await client.put(`/users/${user.id}/password`, { password });
      toast.success('Password direset');
      onClose();
    } catch {} finally { setSaving(false); }
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <p className="text-sm text-slate-500">Reset password untuk <strong>{user.name}</strong></p>
      <div>
        <label className="label">Password Baru *</label>
        <input type="password" className="input" value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Min. 6 karakter" required minLength={6} />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Mereset...' : 'Reset Password'}
        </button>
      </div>
    </form>
  );
}

// ─── Module x Action permission catalog ───────────────────────────────────────
// Satu baris per modul; tiap modul cuma menampilkan aksi yang benar-benar
// relevan untuknya (bukan grid kolom seragam) — lihat plan §2/§7.
const MODULE_CATALOG = [
  { module: 'backlog', label: 'Backlog', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' }, { key: 'delete', label: 'Hapus' },
    { key: 'update_assigned', label: 'Edit Item Ditugaskan' },
  ]},
  { module: 'epics', label: 'Epic', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' }, { key: 'delete', label: 'Hapus' },
  ]},
  { module: 'features', label: 'Features', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' }, { key: 'delete', label: 'Hapus' },
  ]},
  { module: 'products', label: 'Products', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' }, { key: 'delete', label: 'Hapus' },
  ]},
  { module: 'roadmap', label: 'Roadmap', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' }, { key: 'delete', label: 'Hapus' },
  ]},
  { module: 'sprints', label: 'Sprint', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' }, { key: 'delete', label: 'Hapus' },
  ]},
  { module: 'qa', label: 'QA', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' },
    { key: 'run', label: 'Jalankan Test' }, { key: 'delete', label: 'Hapus' },
  ]},
  { module: 'bugs', label: 'Bugs Incident', actions: [
    { key: 'access', label: 'Akses' },
  ]},
  { module: 'c_level', label: 'C-Level Dashboard', actions: [
    { key: 'access', label: 'Akses' },
  ]},
  { module: 'standup', label: 'Standup', actions: [
    { key: 'edit_any', label: 'Edit Milik Orang Lain' }, { key: 'import', label: 'Import Data' },
  ]},
  { module: 'import', label: 'Import Jira', actions: [
    { key: 'run', label: 'Jalankan Import' },
  ]},
  { module: 'users', label: 'Users', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' },
    { key: 'reset_password', label: 'Reset Password' }, { key: 'deactivate', label: 'Nonaktifkan' },
    { key: 'delete', label: 'Hapus' },
  ]},
  { module: 'roles', label: 'Roles', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' }, { key: 'delete', label: 'Hapus' },
  ]},
  { module: 'departments', label: 'Departemen', actions: [
    { key: 'create', label: 'Buat' }, { key: 'update', label: 'Ubah' }, { key: 'delete', label: 'Hapus' },
  ]},
  { module: 'settings', label: 'Pengaturan', actions: [
    { key: 'update', label: 'Ubah' },
  ]},
];

// Buang modul yang tidak punya aksi ter-centang sama sekali, supaya JSON yang
// disimpan bersih (konsisten dengan perilaku lama: key yang tidak dicentang
// tidak perlu ada di blob, bukan harus eksplisit false).
function compactPermissions(checked) {
  const out = {};
  for (const { module, actions } of MODULE_CATALOG) {
    const moduleChecked = {};
    for (const a of actions) {
      if (checked[module]?.[a.key]) moduleChecked[a.key] = true;
    }
    if (Object.keys(moduleChecked).length > 0) out[module] = moduleChecked;
  }
  return out;
}

// ─── RoleForm ─────────────────────────────────────────────────────────────────
function RoleForm({ role, onSave, onClose }) {
  const [displayName, setDisplayName] = useState(role?.display_name || '');
  const [name, setName]               = useState(role?.name || '');
  const isSuperAdmin                  = role?.name === 'super_admin';
  const [checked, setChecked]         = useState(() => role?.permissions || {});
  const [saving, setSaving]           = useState(false);

  const toggle = (module, action) => setChecked(prev => ({
    ...prev,
    [module]: { ...prev[module], [action]: !prev[module]?.[action] },
  }));

  const toggleModuleAll = (module, actions) => {
    const allChecked = actions.every(a => checked[module]?.[a.key]);
    setChecked(prev => ({
      ...prev,
      [module]: Object.fromEntries(actions.map(a => [a.key, !allChecked])),
    }));
  };

  const totalActive = MODULE_CATALOG.reduce(
    (sum, { module, actions }) => sum + actions.filter(a => checked[module]?.[a.key]).length, 0
  );

  const save = async () => {
    if (!displayName.trim()) { toast.error('Display name wajib'); return; }
    if (!role?.id && !name.trim()) { toast.error('Nama role wajib'); return; }
    setSaving(true);
    try {
      const permissions = compactPermissions(checked);
      if (role?.id) {
        await client.put(`/roles/${role.id}`, { display_name: displayName, permissions });
        toast.success('Role diperbarui');
      } else {
        await client.post('/roles', { name, display_name: displayName, permissions });
        toast.success('Role dibuat');
      }
      onSave();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Terjadi kesalahan');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {!role?.id && (
        <div>
          <label className="label">Nama (slug) *</label>
          <input className="input" value={name}
            onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            placeholder="contoh: senior_dev" />
          <p className="text-xs text-slate-400 mt-1">Hanya huruf kecil, angka, underscore. Tidak bisa diubah.</p>
        </div>
      )}
      <div>
        <label className="label">Display Name *</label>
        <input className="input" value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="contoh: Senior Developer" />
      </div>
      <div>
        <label className="label">Hak Akses per Modul</label>
        {isSuperAdmin ? (
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-700 font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0" />
            Akses Penuh — Super Admin selalu bisa semua operasi, tidak bisa diubah lewat form ini
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="text-left px-3 py-2 w-36">Modul</th>
                  <th className="text-left px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MODULE_CATALOG.map(({ module, label, actions }) => (
                  <tr key={module} className="align-top">
                    <td className="px-3 py-2.5 font-medium text-slate-700">
                      <button type="button" onClick={() => toggleModuleAll(module, actions)}
                        className="text-left hover:text-indigo-600 transition-colors" title="Pilih/hapus semua aksi modul ini">
                        {label}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {actions.map(a => (
                          <label key={a.key} className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" className="w-3.5 h-3.5 rounded accent-indigo-600"
                              checked={!!checked[module]?.[a.key]} onChange={() => toggle(module, a.key)} />
                            <span className="text-xs text-slate-600">{a.label}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isSuperAdmin && (
          <p className="text-xs text-slate-400 mt-1.5">{totalActive} aksi dipilih</p>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Menyimpan...' : (role?.id ? 'Perbarui Role' : 'Buat Role')}
        </button>
      </div>
    </div>
  );
}

// ─── DepartmentForm ───────────────────────────────────────────────────────────
function DepartmentForm({ department, users, onSave, onClose, onMembersChanged }) {
  const [code, setCode]             = useState(department?.code || '');
  const [name, setName]             = useState(department?.name || '');
  const [codePrefix, setCodePrefix] = useState(department?.code_prefix || '');
  const [color, setColor]           = useState(department?.color || SWATCH_COLORS[0]);
  const [sortOrder, setSortOrder]   = useState(department?.sort_order ?? 0);
  const [saving, setSaving]         = useState(false);
  const [pendingMembers, setPendingMembers] = useState(() => new Set());

  const toggleMember = async (u) => {
    const currentIds = (u.departments || []).map(d => d.id);
    const isMember = currentIds.includes(department.id);
    const nextIds = isMember ? currentIds.filter(id => id !== department.id) : [...currentIds, department.id];
    setPendingMembers(prev => new Set(prev).add(u.id));
    try {
      await client.put(`/users/${u.id}/departments`, { department_ids: nextIds });
      onMembersChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal memperbarui anggota');
    } finally {
      setPendingMembers(prev => { const next = new Set(prev); next.delete(u.id); return next; });
    }
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Nama wajib'); return; }
    if (!department?.id && !code.trim()) { toast.error('Kode wajib'); return; }
    setSaving(true);
    try {
      if (department?.id) {
        await client.put(`/departments/${department.id}`, {
          name, code_prefix: codePrefix, color, sort_order: +sortOrder,
        });
        toast.success('Departemen diperbarui');
      } else {
        await client.post('/departments', {
          code, name, code_prefix: codePrefix, color, sort_order: +sortOrder,
        });
        toast.success('Departemen dibuat');
      }
      onSave();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Terjadi kesalahan');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {!department?.id && (
        <div>
          <label className="label">Kode *</label>
          <input className="input" value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            placeholder="contoh: LEGAL" />
          <p className="text-xs text-slate-400 mt-1">Identifier unik, huruf besar/angka/underscore. Tidak bisa diubah setelah dibuat.</p>
        </div>
      )}
      <div>
        <label className="label">Nama *</label>
        <input className="input" value={name}
          onChange={e => setName(e.target.value)} placeholder="contoh: Legal" />
      </div>
      <div>
        <label className="label">
          Prefix Kode Task
          <span className="text-xs font-normal text-slate-400 ml-1 normal-case">— dipakai untuk auto-generate kode Leader Task, mis. LGL-001</span>
        </label>
        <input className="input" value={codePrefix}
          onChange={e => setCodePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="kosongkan untuk pakai kode departemen" maxLength={10} />
      </div>
      <div>
        <label className="label">Warna</label>
        <div className="flex gap-2 flex-wrap">
          {SWATCH_COLORS.map(c => (
            <button type="button" key={c} onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div>
        <label className="label">Urutan Tampil</label>
        <input type="number" className="input" value={sortOrder}
          onChange={e => setSortOrder(e.target.value)} />
      </div>
      <div>
        <label className="label">
          Anggota Departemen
          <span className="text-xs font-normal text-slate-400 ml-1 normal-case">— menentukan scope Leader Notes/Task yang bisa dilihat user; bisa lebih dari satu departemen</span>
        </label>
        {!department?.id ? (
          <p className="text-xs text-slate-400">Simpan departemen dulu untuk mengatur anggota.</p>
        ) : (users || []).length === 0 ? (
          <p className="text-xs text-slate-400">Belum ada user.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 mt-1 border border-slate-200 rounded-lg p-3 bg-slate-50 max-h-56 overflow-y-auto">
            {users.map(u => (
              <label key={u.id}
                className="flex items-center gap-3 cursor-pointer hover:bg-white rounded-md px-2 py-1.5 transition-colors">
                <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600"
                  checked={(u.departments || []).some(d => d.id === department.id)}
                  disabled={pendingMembers.has(u.id)}
                  onChange={() => toggleMember(u)} />
                <span className="text-sm text-slate-700 truncate">{u.name}</span>
                <span className="text-xs text-slate-400 ml-auto shrink-0">{u.email}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Menyimpan...' : (department?.id ? 'Perbarui Departemen' : 'Buat Departemen')}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Users() {
  const { can, user: currentUser } = useAuth();
  const [users,    setUsers]    = useState([]);
  const [roles,    setRoles]    = useState([]);
  const [products, setProducts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [modal,    setModal]    = useState({ open: false, type: '', data: null });
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('users');
  const [perPage,  setPerPage]  = useState(10);
  const [page,     setPage]     = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // user object to delete

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [us, rl, pr, dp] = await Promise.all([
        client.get('/users'),
        client.get('/users/roles'),
        client.get('/products'),
        client.get('/departments'),
      ]);
      setUsers(us.data);
      setRoles(rl.data);
      setProducts(pr.data);
      setDepartments(dp.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (user) => {
    await client.put(`/users/${user.id}`, { ...user, is_active: !user.is_active, role_id: user.role_id });
    toast.success(user.is_active ? 'User dinonaktifkan' : 'User diaktifkan');
    load();
  };

  const deleteUserPermanent = async (user) => {
    try {
      await client.delete(`/users/${user.id}/permanent`);
      toast.success(`User "${user.name}" berhasil dihapus`);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menghapus user');
    }
  };

  const deleteRole = async (role) => {
    if (!confirm(`Hapus role "${role.display_name}"?`)) return;
    try {
      await client.delete(`/roles/${role.id}`);
      toast.success('Role dihapus');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menghapus role');
    }
  };

  const deleteDepartment = async (dept) => {
    if (!confirm(`Hapus departemen "${dept.name}"?`)) return;
    try {
      await client.delete(`/departments/${dept.id}`);
      toast.success('Departemen dihapus');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menghapus departemen');
    }
  };

  const totalPages  = Math.max(1, Math.ceil(users.length / perPage));
  const pagedUsers  = users.slice((page - 1) * perPage, page * perPage);

  const handlePerPage = (val) => { setPerPage(val); setPage(1); };

  const closeModal = () => setModal(m => ({ ...m, open: false }));

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[['users','Users'], ['roles','Roles & Permissions'], ['departments','Departemen']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <>
          <div className="flex justify-end">
            {can('users', 'create') && (
              <button className="btn-primary"
                onClick={() => setModal({ open: true, type: 'user', data: null })}>
                <Plus className="w-4 h-4" /> Tambah User
              </button>
            )}
          </div>
          <div className="card overflow-hidden">
            {/* Per-page toolbar */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500">{users.length} user</span>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                Tampilkan
                <select className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs"
                  value={perPage} onChange={e => handlePerPage(+e.target.value)}>
                  {[10, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                baris
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="text-left px-5 py-3">User</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-center px-4 py-3">Role</th>
                    <th className="text-left px-4 py-3">Produk</th>
                    <th className="text-center px-4 py-3">Departemen</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Items Aktif</th>
                    <th className="text-left px-4 py-3">Bergabung</th>
                    <th className="text-center px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map(u => (
                    <tr key={u.id} className="table-row">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ backgroundColor: u.avatar_color || '#4F46E5' }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-800">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[u.role_name] || 'bg-slate-100 text-slate-600'}`}>
                          {u.role_display || u.role_name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(u.products || []).length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Tidak ada</span>
                          ) : (
                            (u.products || []).map(p => (
                              <span key={p.id}
                                className="text-xs font-mono font-medium px-1.5 py-0.5 rounded border"
                                style={{ color: p.color, borderColor: p.color + '55', backgroundColor: p.color + '15' }}>
                                {p.code}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {(u.departments || []).length === 0 ? (
                            <span className="text-xs text-slate-300">—</span>
                          ) : (
                            (u.departments || []).map(d => (
                              <span key={d.id}
                                className="text-xs font-semibold px-2 py-0.5 rounded border"
                                style={{ color: d.color, borderColor: d.color + '55', backgroundColor: d.color + '15' }}>
                                {d.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {u.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 font-medium">{u.assigned_items}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {u.created_at ? format(parseISO(u.created_at), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          {can('users', 'update') && (
                            <button className="btn-ghost btn-sm p-1.5 rounded-lg" title="Edit"
                              onClick={() => setModal({ open: true, type: 'user', data: u })}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can('users', 'reset_password') && (
                            <button className="btn-ghost btn-sm p-1.5 rounded-lg" title="Reset Password"
                              onClick={() => setModal({ open: true, type: 'reset', data: u })}>
                              <Key className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can('users', 'deactivate') && (
                            <button
                              className={`btn-ghost btn-sm p-1.5 rounded-lg ${u.is_active ? 'text-orange-500 hover:bg-orange-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                              title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              onClick={() => toggleActive(u)}>
                              {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {can('users', 'delete') && u.role_name !== 'super_admin' && u.id !== currentUser?.id && (
                            <button
                              className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                              title="Hapus Permanen"
                              onClick={() => setDeleteConfirm(u)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
                <span>{(page-1)*perPage+1}–{Math.min(page*perPage, users.length)} dari {users.length}</span>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                    className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">‹ Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`btn-ghost btn-sm px-2.5 py-1 ${p === page ? 'bg-indigo-50 text-indigo-600 font-medium' : ''}`}>
                        {p}
                      </button>
                    );
                  })}
                  <button disabled={page === totalPages} onClick={() => setPage(p => p+1)}
                    className="btn-ghost btn-sm px-2.5 py-1 disabled:opacity-40">Next ›</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ROLES TAB ── */}
      {tab === 'roles' && (
        <div className="space-y-4">
          {can('roles', 'create') && (
            <div className="flex justify-end">
              <button className="btn-primary"
                onClick={() => setModal({ open: true, type: 'role', data: null })}>
                <Plus className="w-4 h-4" /> Tambah Role
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {roles.map(role => {
              const perms = role.permissions || {};
              const userCount = users.filter(u => u.role_name === role.name).length;
              const totalActive = MODULE_CATALOG.reduce(
                (sum, { module, actions }) => sum + actions.filter(a => perms[module]?.[a.key]).length, 0
              );
              return (
                <div key={role.id} className="card p-5 flex flex-col">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{role.display_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{role.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{totalActive} permission aktif · {userCount} user</p>
                    </div>
                    {(can('roles', 'update') || can('roles', 'delete')) && (
                      <div className="flex gap-1 shrink-0">
                        {can('roles', 'update') && (
                          <button className="btn-ghost btn-sm p-1.5 rounded-lg" title="Edit role"
                            onClick={() => setModal({ open: true, type: 'role', data: role })}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can('roles', 'delete') && role.name !== 'super_admin' && (
                          <button className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                            title="Hapus role" onClick={() => deleteRole(role)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {role.name === 'super_admin' ? (
                    <div className="flex-1 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-700 font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4 shrink-0" />
                      Akses Penuh — semua operasi diizinkan
                    </div>
                  ) : (
                    <div className="flex-1 space-y-2">
                      {MODULE_CATALOG.filter(({ module, actions }) => actions.some(a => perms[module]?.[a.key])).map(({ module, label, actions }) => (
                        <div key={module}>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                          <div className="flex flex-wrap gap-1">
                            {actions.filter(a => perms[module]?.[a.key]).map(a => (
                              <span key={a.key}
                                className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                                {a.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {totalActive === 0 && (
                        <p className="text-xs text-slate-400 italic">Tidak ada permission — role ini hanya bisa melihat data yang di-assign</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DEPARTEMEN TAB ── */}
      {tab === 'departments' && (
        <div className="space-y-4">
          {can('departments', 'create') && (
            <div className="flex justify-end">
              <button className="btn-primary"
                onClick={() => setModal({ open: true, type: 'department', data: null })}>
                <Plus className="w-4 h-4" /> Tambah Departemen
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {departments.map(dept => {
              const userCount = users.filter(u => (u.departments || []).some(d => d.id === dept.id)).length;
              return (
                <div key={dept.id} className="card p-5 flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (dept.color || '#64748B') + '20' }}>
                      <Building2 className="w-4 h-4" style={{ color: dept.color || '#64748B' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{dept.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{dept.code} · prefix {dept.code_prefix}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{userCount} user</p>
                    </div>
                    {(can('departments', 'update') || can('departments', 'delete')) && (
                      <div className="flex gap-1 shrink-0">
                        {can('departments', 'update') && (
                          <button className="btn-ghost btn-sm p-1.5 rounded-lg" title="Edit departemen"
                            onClick={() => setModal({ open: true, type: 'department', data: dept })}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can('departments', 'delete') && (
                          <button className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                            title="Hapus departemen" onClick={() => deleteDepartment(dept)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {departments.length === 0 && (
              <p className="text-sm text-slate-400 italic col-span-full">Belum ada departemen.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <Modal open={modal.open && modal.type === 'user'} onClose={closeModal}
        title={modal.data ? 'Edit User' : 'Tambah User'} size="md">
        <UserForm user={modal.data} roles={roles} products={products}
          onSave={() => { closeModal(); load(); }} onClose={closeModal} />
      </Modal>

      <Modal open={modal.open && modal.type === 'reset'} onClose={closeModal}
        title="Reset Password" size="sm">
        {modal.data && (
          <ResetPasswordForm user={modal.data} onClose={closeModal} />
        )}
      </Modal>

      <Modal open={modal.open && modal.type === 'role'} onClose={closeModal}
        title={modal.data ? 'Edit Role' : 'Tambah Role'} size="md">
        <RoleForm role={modal.data} onSave={() => { closeModal(); load(); }} onClose={closeModal} />
      </Modal>

      <Modal open={modal.open && modal.type === 'department'} onClose={closeModal}
        title={modal.data ? 'Edit Departemen' : 'Tambah Departemen'} size="sm">
        <DepartmentForm department={modal.data} users={users} onMembersChanged={load}
          onSave={() => { closeModal(); load(); }} onClose={closeModal} />
      </Modal>

      {/* ── Delete User Permanent Confirm ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Hapus User Permanen</p>
                <p className="text-sm text-slate-500">Tindakan ini tidak bisa dibatalkan</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 space-y-1">
              <p>Menghapus <strong>{deleteConfirm.name}</strong> ({deleteConfirm.email}) akan:</p>
              <ul className="list-disc list-inside space-y-0.5 mt-1 text-xs">
                <li>Menghapus akun user secara permanen</li>
                <li>Menghapus semua standup dan notifikasi user</li>
                <li>Menghapus akses produk user</li>
                <li>Menghapus semua komentar yang dibuat user</li>
                <li>Backlog item yang di-assign akan menjadi <em>Unassigned</em></li>
              </ul>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Batal</button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                onClick={() => deleteUserPermanent(deleteConfirm)}>
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
