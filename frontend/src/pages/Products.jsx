import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Package, ExternalLink, ChevronDown, ChevronUp, Map } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import client from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#64748B'];

// ─── Roadmap status config ────────────────────────────────────────────────────
const ROADMAP_STATUSES = [
  { key: 'active',      label: 'Active',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'on_progress', label: 'On Progress',  cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'planned',     label: 'Planned',      cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  { key: 'research',    label: 'Research',     cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'offline',     label: 'Offline',      cls: 'bg-red-100 text-red-700 border-red-200' },
];

const ROADMAP_STATUS_MAP = Object.fromEntries(ROADMAP_STATUSES.map(s => [s.key, s]));

function RoadmapStatusBadge({ status }) {
  const cfg = ROADMAP_STATUS_MAP[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── RoadmapForm ──────────────────────────────────────────────────────────────
function RoadmapForm({ item, products, defaultProductId, onSave, onClose }) {
  const [form, setForm] = useState({
    product_id:            item?.product_id            || defaultProductId || '',
    feature_name:          item?.feature_name          || '',
    description:           item?.description           || '',
    status:                item?.status                || 'planned',
    product_version:       item?.product_version        || '',
    sort_order:            item?.sort_order            || 0,
    month_release_target:  item?.month_release_target  ? item.month_release_target.split('T')[0].slice(0, 7) : '',
  });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!form.feature_name.trim()) { toast.error('Nama fitur wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = { ...form, month_release_target: form.month_release_target ? `${form.month_release_target}-01` : null };
      if (item?.id) {
        await client.put(`/roadmap/${item.id}`, payload);
        toast.success('Feature diperbarui');
      } else {
        await client.post('/roadmap', payload);
        toast.success('Feature ditambahkan ke roadmap');
      }
      onSave();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Terjadi kesalahan');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="label">Produk *</label>
        <select className="select" value={form.product_id}
          onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} required>
          <option value="">— Pilih Produk —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Nama Fitur *</label>
        <input className="input" value={form.feature_name}
          onChange={e => setForm(f => ({ ...f, feature_name: e.target.value }))}
          placeholder="contoh: Single Sign-On" required />
      </div>
      <div>
        <label className="label">Deskripsi</label>
        <textarea className="input h-20 resize-none" value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Penjelasan singkat fitur ini..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Status</label>
          <select className="select" value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {ROADMAP_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Versi Produk</label>
          <input className="input" value={form.product_version}
            onChange={e => setForm(f => ({ ...f, product_version: e.target.value }))}
            placeholder="contoh: v1.0, v2.3" />
        </div>
      </div>
      <div>
        <label className="label">Month Release Target</label>
        <input type="month" className="input" value={form.month_release_target}
          onChange={e => setForm(f => ({ ...f, month_release_target: e.target.value }))} />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : (item?.id ? 'Perbarui' : 'Tambahkan')}
        </button>
      </div>
    </form>
  );
}

// ─── ProductForm ──────────────────────────────────────────────────────────────
function ProductForm({ product, users, onSave, onClose }) {
  const [form, setForm] = useState({
    code: product?.code || '', name: product?.name || '',
    description: product?.description || '', status: product?.status || 'active',
    owner_id: product?.owner_id || '', repository_url: product?.repository_url || '',
    color: product?.color || '#4F46E5',
  });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (product?.id) {
        await client.put(`/products/${product.id}`, form);
        toast.success('Produk diperbarui');
      } else {
        await client.post('/products', form);
        toast.success('Produk dibuat');
      }
      onSave();
    } catch {} finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4">
      <div>
        <label className="label">Kode Produk *</label>
        <input className="input uppercase" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="MYAPP" required disabled={!!product?.id} />
      </div>
      <div>
        <label className="label">Nama Produk *</label>
        <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nama sistem/aplikasi" required />
      </div>
      <div className="col-span-2">
        <label className="label">Deskripsi</label>
        <textarea className="input h-20 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Deskripsi singkat produk..." />
      </div>
      <div>
        <label className="label">Product Owner</label>
        <select className="select" value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}>
          <option value="">— Pilih Owner —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Status</label>
        <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          {['active','on_hold','archived'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Repository URL</label>
        <input className="input" type="url" value={form.repository_url} onChange={e => setForm(f => ({ ...f, repository_url: e.target.value }))} placeholder="https://github.com/..." />
      </div>
      <div className="col-span-2">
        <label className="label">Warna Label</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button type="button" key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
              className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : (product?.id ? 'Perbarui' : 'Buat Produk')}</button>
      </div>
    </form>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Products() {
  const { hasRole } = useAuth();
  const [tab,      setTab]      = useState('products');
  const [products, setProducts] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [features, setFeatures] = useState([]);
  const [epics,    setEpics]    = useState([]);
  const [roadmap,  setRoadmap]  = useState([]);
  const [expanded, setExpanded] = useState({});
  const [modal,    setModal]    = useState({ open: false, type: '', data: null, productId: null });
  const [loading,  setLoading]  = useState(true);
  const [filterRoadmapProduct, setFilterRoadmapProduct] = useState('');
  const [filterRoadmapStatus,  setFilterRoadmapStatus]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, us, ft, ep, rm] = await Promise.all([
        client.get('/products'), client.get('/users'),
        client.get('/features'), client.get('/epics'),
        client.get('/roadmap'),
      ]);
      setProducts(pr.data); setUsers(us.data);
      setFeatures(ft.data); setEpics(ep.data);
      setRoadmap(rm.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteProduct = async (id) => {
    if (!confirm('Hapus produk ini dan semua datanya?')) return;
    await client.delete(`/products/${id}`);
    toast.success('Produk dihapus'); load();
  };

  const deleteFeature = async (id) => {
    if (!confirm('Hapus feature ini?')) return;
    await client.delete(`/features/${id}`);
    toast.success('Feature dihapus'); load();
  };

  const deleteEpic = async (id) => {
    if (!confirm('Hapus epic ini?')) return;
    await client.delete(`/epics/${id}`);
    toast.success('Epic dihapus'); load();
  };

  const deleteRoadmapItem = async (id) => {
    if (!confirm('Hapus item roadmap ini?')) return;
    try {
      await client.delete(`/roadmap/${id}`);
      toast.success('Item roadmap dihapus'); load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menghapus');
    }
  };

  const closeModal = () => setModal(m => ({ ...m, open: false }));

  const filteredRoadmap = roadmap.filter(r => {
    if (filterRoadmapProduct && String(r.product_id) !== filterRoadmapProduct) return false;
    if (filterRoadmapStatus  && r.status !== filterRoadmapStatus) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[
          ['products', 'Produk & Features'],
          ['roadmap',  'Roadmap'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PRODUCTS TAB ── */}
      {tab === 'products' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            {hasRole('super_admin','manager') && (
              <button className="btn-primary" onClick={() => setModal({ open: true, type: 'product', data: null, productId: null })}>
                <Plus className="w-4 h-4" /> Tambah Produk
              </button>
            )}
          </div>

          {products.map(product => {
            const pFeatures = features.filter(f => f.product_id === product.id);
            const pEpics    = epics.filter(e => e.product_id === product.id);
            const pct = product.total_items > 0 ? Math.round((product.done_items / product.total_items) * 100) : 0;
            const isExpanded = expanded[product.id];

            return (
              <div key={product.id} className="card overflow-hidden">
                {/* Product Header */}
                <div className="flex items-start gap-4 p-5" style={{ borderLeft: `4px solid ${product.color}` }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: product.color }}>
                    {product.code.slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-base font-bold text-slate-800">{product.name}</h2>
                      <StatusBadge status={product.status} />
                      <span className="text-xs text-slate-400 font-mono">{product.code}</span>
                    </div>
                    {product.description && <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{product.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                      <span>Owner: <strong className="text-slate-600">{product.owner_name || '—'}</strong></span>
                      <span>Items: <strong className="text-slate-600">{product.total_items}</strong></span>
                      <span>Done: <strong className="text-emerald-600">{product.done_items}</strong></span>
                      <span>Active Sprints: <strong className="text-blue-600">{product.active_sprints}</strong></span>
                      {product.repository_url && (
                        <a href={product.repository_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700">
                          <ExternalLink className="w-3 h-3" /> Repo
                        </a>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 max-w-[200px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{pct}% selesai</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasRole('super_admin','manager','po') && (
                      <>
                        <button className="btn-ghost btn-sm p-1.5 rounded-lg" onClick={() => setModal({ open: true, type: 'product', data: product, productId: product.id })}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        {hasRole('super_admin') && (
                          <button className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50" onClick={() => deleteProduct(product.id)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                    <button className="btn-ghost btn-sm p-1.5 rounded-lg" onClick={() => setExpanded(e => ({ ...e, [product.id]: !e[product.id] }))}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* Epics */}
                    <div className="px-5 py-3 border-b border-slate-50">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-600">Epics</h3>
                        {hasRole('super_admin','manager','po') && (
                          <button className="btn-secondary btn-sm" onClick={() => setModal({ open: true, type: 'epic', data: null, productId: product.id })}>
                            <Plus className="w-3 h-3" /> Epic
                          </button>
                        )}
                      </div>
                      {pEpics.length === 0
                        ? <p className="text-sm text-slate-400">Belum ada epic</p>
                        : <div className="space-y-1">
                            {pEpics.map(epic => (
                              <div key={epic.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg text-sm">
                                <span className="font-mono text-xs text-slate-400 w-14">{epic.code}</span>
                                <span className="flex-1 font-medium text-slate-700">{epic.name}</span>
                                <StatusBadge status={epic.status} size="xs" />
                                <PriorityBadge priority={epic.priority} />
                                <span className="text-xs text-slate-400">{epic.item_count} items · {epic.done_points}/{epic.total_points}pts</span>
                                <div className="flex gap-1">
                                  <button className="btn-ghost btn-sm p-1 rounded" onClick={() => setModal({ open: true, type: 'epic', data: epic, productId: product.id })}><Pencil className="w-3 h-3" /></button>
                                  <button className="btn-ghost btn-sm p-1 rounded text-red-500 hover:bg-red-50" onClick={() => deleteEpic(epic.id)}><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                      }
                    </div>

                    {/* Features */}
                    <div className="px-5 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-600">Features</h3>
                        {hasRole('super_admin','manager','po') && (
                          <button className="btn-secondary btn-sm" onClick={() => setModal({ open: true, type: 'feature', data: null, productId: product.id })}>
                            <Plus className="w-3 h-3" /> Feature
                          </button>
                        )}
                      </div>
                      {pFeatures.length === 0
                        ? <p className="text-sm text-slate-400">Belum ada feature</p>
                        : <div className="space-y-0.5">
                            {pFeatures.map(f => {
                              const pct2 = f.total_points > 0 ? Math.round((f.done_points / f.total_points) * 100) : 0;
                              return (
                                <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 rounded-lg text-sm">
                                  <span className="font-mono text-xs text-slate-400 w-14 shrink-0">{f.code}</span>
                                  <span className="flex-1 font-medium text-slate-700 truncate">{f.name}</span>
                                  {f.is_roadmap_item && (
                                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-200" title="Tampil di Roadmap">
                                      <Map className="w-3 h-3" /> Roadmap
                                    </span>
                                  )}
                                  <StatusBadge status={f.status} size="xs" />
                                  <PriorityBadge priority={f.priority} />
                                  <span className="text-xs text-slate-400">{f.target_release || '—'}</span>
                                  <div className="flex items-center gap-1.5 w-24 shrink-0">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct2}%` }} />
                                    </div>
                                    <span className="text-xs text-slate-400">{pct2}%</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button className="btn-ghost btn-sm p-1 rounded" onClick={() => setModal({ open: true, type: 'feature', data: f, productId: product.id })}><Pencil className="w-3 h-3" /></button>
                                    <button className="btn-ghost btn-sm p-1 rounded text-red-500 hover:bg-red-50" onClick={() => deleteFeature(f.id)}><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                      }
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── FEATURES & ROADMAP TAB ── */}
      {tab === 'roadmap' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
            <strong>Roadmap</strong> adalah perencanaan fitur produk secara umum. Untuk membuat <strong>Feature</strong> yang dapat dihubungkan ke Backlog Item, buka tab <strong>"Produk & Features"</strong> → expand produk → klik tombol "+ Feature".
          </div>
          {/* Filter + action bar */}
          <div className="flex flex-wrap items-center gap-3">
            <select className="select w-48" value={filterRoadmapProduct}
              onChange={e => setFilterRoadmapProduct(e.target.value)}>
              <option value="">Semua Produk</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="select w-40" value={filterRoadmapStatus}
              onChange={e => setFilterRoadmapStatus(e.target.value)}>
              <option value="">Semua Status</option>
              {ROADMAP_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            {hasRole('super_admin','manager','po') && (
              <button className="btn-primary ml-auto"
                onClick={() => setModal({ open: true, type: 'roadmap', data: null, productId: null })}>
                <Plus className="w-4 h-4" /> Tambah Item Roadmap
              </button>
            )}
          </div>

          {/* Status summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {ROADMAP_STATUSES.map(s => {
              const count = roadmap.filter(r =>
                r.status === s.key &&
                (!filterRoadmapProduct || String(r.product_id) === filterRoadmapProduct)
              ).length;
              return (
                <button key={s.key}
                  onClick={() => setFilterRoadmapStatus(filterRoadmapStatus === s.key ? '' : s.key)}
                  className={`card p-3 text-left transition-all ${filterRoadmapStatus === s.key ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'}`}>
                  <p className="text-xl font-bold text-slate-800">{count}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border mt-1 inline-block ${s.cls}`}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Roadmap table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="text-left px-5 py-3">Fitur</th>
                    <th className="text-left px-4 py-3">Produk</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Versi</th>
                    <th className="text-center px-4 py-3">Target Rilis</th>
                    <th className="text-left px-4 py-3">Deskripsi</th>
                    <th className="text-center px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoadmap.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <Map className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p>Belum ada feature di roadmap</p>
                      </td>
                    </tr>
                  )}
                  {filteredRoadmap.map(item => (
                    <tr key={item.id} className="table-row">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{item.feature_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded border font-mono"
                          style={{
                            color: item.product_color,
                            borderColor: item.product_color + '55',
                            backgroundColor: item.product_color + '15',
                          }}>
                          {item.product_code}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">{item.product_name}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RoadmapStatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.product_version
                          ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{item.product_version}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.month_release_target
                          ? <span className="text-xs text-slate-600">{format(parseISO(item.month_release_target), 'MMMM yyyy')}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[260px] truncate">
                        {item.description || <span className="text-slate-300 italic">Tidak ada deskripsi</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          {hasRole('super_admin','manager','po') && (
                            <button className="btn-ghost btn-sm p-1.5 rounded-lg"
                              onClick={() => setModal({ open: true, type: 'roadmap', data: item, productId: item.product_id })}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {hasRole('super_admin','manager') && (
                            <button className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                              onClick={() => deleteRoadmapItem(item.id)}>
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
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <Modal open={modal.open && modal.type === 'product'} onClose={closeModal}
        title={modal.data ? 'Edit Produk' : 'Tambah Produk'} size="md">
        <ProductForm product={modal.data} users={users}
          onSave={() => { closeModal(); load(); }} onClose={closeModal} />
      </Modal>

      <Modal open={modal.open && modal.type === 'epic'} onClose={closeModal}
        title={modal.data ? 'Edit Epic' : 'Tambah Epic'} size="sm">
        <EpicForm epic={modal.data} productId={modal.productId}
          onSave={() => { closeModal(); load(); }} onClose={closeModal} />
      </Modal>

      <Modal open={modal.open && modal.type === 'feature'} onClose={closeModal}
        title={modal.data ? 'Edit Feature' : 'Tambah Feature'} size="md">
        <FeatureForm feature={modal.data} productId={modal.productId} users={users}
          epics={epics.filter(e => e.product_id === modal.productId)}
          onSave={() => { closeModal(); load(); }} onClose={closeModal} />
      </Modal>

      <Modal open={modal.open && modal.type === 'roadmap'} onClose={closeModal}
        title={modal.data ? 'Edit Item Roadmap' : 'Tambah Item ke Roadmap'} size="md">
        <RoadmapForm item={modal.data} products={products}
          defaultProductId={modal.productId}
          onSave={() => { closeModal(); load(); }} onClose={closeModal} />
      </Modal>
    </div>
  );
}

// ─── EpicForm ─────────────────────────────────────────────────────────────────
function EpicForm({ epic, productId, onSave, onClose }) {
  const [form, setForm] = useState({ product_id: epic?.product_id || productId, code: epic?.code || '', name: epic?.name || '', description: epic?.description || '', status: epic?.status || 'open', priority: epic?.priority || 'medium' });
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (epic?.id) { await client.put(`/epics/${epic.id}`, form); toast.success('Epic diperbarui'); }
      else { await client.post('/epics', form); toast.success('Epic dibuat'); }
      onSave();
    } catch {} finally { setSaving(false); }
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Kode *</label><input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="EP-01" required disabled={!!epic?.id} /></div>
        <div><label className="label">Status</label><select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{['open','in_progress','closed'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      <div><label className="label">Nama Epic *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
      <div><label className="label">Deskripsi</label><textarea className="input h-16 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
      <div><label className="label">Prioritas</label><select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>{['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100"><button type="button" className="btn-secondary" onClick={onClose}>Batal</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : (epic?.id ? 'Perbarui' : 'Buat')}</button></div>
    </form>
  );
}

// ─── FeatureForm ──────────────────────────────────────────────────────────────
function FeatureForm({ feature, productId, users, epics, onSave, onClose }) {
  const [form, setForm] = useState({ product_id: feature?.product_id || productId, epic_id: feature?.epic_id || '', code: feature?.code || '', name: feature?.name || '', owner_id: feature?.owner_id || '', status: feature?.status || 'not_started', priority: feature?.priority || 'medium', target_release: feature?.target_release || '', is_roadmap_item: feature?.is_roadmap_item || false });
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (feature?.id) { await client.put(`/features/${feature.id}`, form); toast.success('Feature diperbarui'); }
      else { await client.post('/features', form); toast.success('Feature dibuat'); }
      onSave();
    } catch {} finally { setSaving(false); }
  };
  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4">
      <div><label className="label">Kode *</label><input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="FT-01" required disabled={!!feature?.id} /></div>
      <div><label className="label">Epic</label><select className="select" value={form.epic_id} onChange={e => setForm(f => ({ ...f, epic_id: e.target.value }))}><option value="">—</option>{epics.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
      <div className="col-span-2"><label className="label">Nama Feature *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
      <div><label className="label">Owner</label><select className="select" value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}><option value="">—</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      <div><label className="label">Status</label><select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{['not_started','in_development','testing','released','on_hold'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></div>
      <div><label className="label">Prioritas</label><select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>{['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
      <div><label className="label">Target Release</label><input className="input" value={form.target_release} onChange={e => setForm(f => ({ ...f, target_release: e.target.value }))} placeholder="v1.0" /></div>
      <div className="col-span-2 flex items-center gap-2 pt-1">
        <input id="is_roadmap_item" type="checkbox" className="w-4 h-4 rounded accent-indigo-600" checked={form.is_roadmap_item}
          onChange={e => setForm(f => ({ ...f, is_roadmap_item: e.target.checked }))} />
        <label htmlFor="is_roadmap_item" className="text-sm text-slate-600 cursor-pointer">Tampilkan feature ini di Roadmap</label>
      </div>
      <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100"><button type="button" className="btn-secondary" onClick={onClose}>Batal</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : (feature?.id ? 'Perbarui' : 'Buat')}</button></div>
    </form>
  );
}
