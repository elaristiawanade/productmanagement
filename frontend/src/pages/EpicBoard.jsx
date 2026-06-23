import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Search, ExternalLink, AlertCircle, Plus, Layers, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['backlog','todo','in_progress','in_review','done','blocked'];

const TYPE_CLS = {
  task:  'text-slate-600 bg-slate-100',
  bug:   'text-red-600 bg-red-50',
  story: 'text-blue-600 bg-blue-50',
  epic:  'text-purple-600 bg-purple-50',
};

function Avatar({ name, color }) {
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
      style={{ backgroundColor: color || '#6366f1' }}>
      {name?.charAt(0)}
    </div>
  );
}

// ─── Task / Bug row (leaf level) ─────────────────────────────────────────────

function TaskRow({ item }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white transition-colors group
      ${item.type === 'bug' ? 'border-l-2 border-red-200' : 'border-l-2 border-slate-200'}`}>
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${TYPE_CLS[item.type]}`}>
        {item.type}
      </span>
      <span className="font-mono text-[11px] text-slate-400 shrink-0">{item.code}</span>
      <span className="text-sm text-slate-700 truncate flex-1">{item.title}</span>
      {item.story_points > 0 && (
        <span className="text-[10px] text-slate-400 shrink-0">{item.story_points}pt</span>
      )}
      <StatusBadge status={item.status} />
      {item.assignee_name && <Avatar name={item.assignee_name} color={item.assignee_color} />}
      {item.deadline && (
        <span className={`text-[11px] shrink-0 ${item.is_delayed ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
          {format(parseISO(item.deadline), 'dd MMM')}
        </span>
      )}
      {item.is_delayed && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
      <Link
        to={`/backlog?item=${item.id}`}
        onClick={e => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 shrink-0"
        title="Buka di Backlog">
        <ExternalLink className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// ─── Story row (mid level) ────────────────────────────────────────────────────

function StoryRow({ story }) {
  const [open,     setOpen]    = useState(false);
  const [children, setChildren] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [loaded,   setLoaded]   = useState(false);

  const toggle = async () => {
    if (!loaded && !open) {
      setLoading(true);
      try {
        const res = await client.get('/backlog', { params: { parent_id: story.id, limit: 200 } });
        setChildren(res.data.items || []);
      } catch { setChildren([]); }
      finally { setLoading(false); setLoaded(true); }
    }
    setOpen(v => !v);
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${open ? 'border-indigo-200' : 'border-slate-100'}`}>
      {/* Story header */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-indigo-50/40 transition-colors group
          ${open ? 'bg-indigo-50/30 border-b border-indigo-100' : ''}`}
        onClick={toggle}>
        <div className="w-4 h-4 flex items-center justify-center shrink-0 text-indigo-400">
          {loading
            ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            : open
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
        <span className="font-mono text-xs text-indigo-500 shrink-0 font-medium">{story.code}</span>
        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{story.title}</span>
        {loaded && (
          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
            {children.length} task{children.length !== 1 ? 's' : ''}
          </span>
        )}
        {story.story_points > 0 && (
          <span className="text-xs text-slate-400 shrink-0">{story.story_points}pt</span>
        )}
        <PriorityBadge priority={story.priority} />
        <StatusBadge status={story.status} />
        {story.assignee_name && (
          <div className="flex items-center gap-1 shrink-0">
            <Avatar name={story.assignee_name} color={story.assignee_color} />
            <span className="text-xs text-slate-500 max-w-[70px] truncate hidden sm:block">{story.assignee_name}</span>
          </div>
        )}
        {story.deadline && (
          <span className={`text-xs shrink-0 ${story.is_delayed ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
            {format(parseISO(story.deadline), 'dd MMM')}
          </span>
        )}
        {story.is_delayed && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
        <Link
          to={`/backlog?item=${story.id}`}
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 shrink-0"
          title="Buka di Backlog">
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Story expanded body */}
      {open && (
        <div className="px-4 py-3 bg-slate-50/40">
          {/* Details */}
          {(story.acceptance_criteria || story.notes) && (
            <div className="mb-3 p-3 bg-white rounded-lg border border-slate-100 text-xs grid grid-cols-2 gap-3">
              {story.acceptance_criteria && (
                <div>
                  <p className="font-semibold text-slate-500 mb-1">Acceptance Criteria</p>
                  <p className="text-slate-600 whitespace-pre-line leading-relaxed">{story.acceptance_criteria}</p>
                </div>
              )}
              {story.notes && (
                <div>
                  <p className="font-semibold text-slate-500 mb-1">Notes</p>
                  <p className="text-slate-600 whitespace-pre-line leading-relaxed">{story.notes}</p>
                </div>
              )}
            </div>
          )}
          {/* Tasks & Bugs */}
          {children.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">Belum ada task atau bug</p>
          ) : (
            <div className="space-y-1">
              {children.map(t => <TaskRow key={t.id} item={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Epic row (top level) ─────────────────────────────────────────────────────

function EpicRow({ epic }) {
  const [open,    setOpen]   = useState(false);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const toggle = async () => {
    if (!loaded && !open) {
      setLoading(true);
      try {
        const res = await client.get('/backlog', { params: { parent_id: epic.id, limit: 200 } });
        setStories(res.data.items || []);
      } catch { setStories([]); }
      finally { setLoading(false); setLoaded(true); }
    }
    setOpen(v => !v);
  };

  return (
    <div className="card overflow-hidden border-l-4 border-purple-400 shadow-sm">
      {/* Epic header */}
      <div
        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-purple-50/40 transition-colors group
          ${open ? 'bg-purple-50/20 border-b border-purple-100' : ''}`}
        onClick={toggle}>
        <div className="w-5 h-5 flex items-center justify-center shrink-0 text-purple-500">
          {loading
            ? <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            : open
              ? <ChevronDown className="w-4 h-4" />
              : <ChevronRight className="w-4 h-4" />}
        </div>
        <Layers className="w-4 h-4 text-purple-400 shrink-0" />
        <span className="font-mono text-xs text-purple-500 shrink-0 font-semibold">{epic.code}</span>
        <span className="text-base font-bold text-purple-900 flex-1 truncate">{epic.title}</span>

        {/* product badge */}
        {epic.product_name && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: (epic.product_color || '#6366f1') + '20', color: epic.product_color || '#6366f1' }}>
            {epic.product_name}
          </span>
        )}
        {loaded && (
          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full shrink-0 font-medium">
            {stories.length} stor{stories.length !== 1 ? 'ies' : 'y'}
          </span>
        )}
        {epic.story_points > 0 && (
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">{epic.story_points} pts</span>
        )}
        <PriorityBadge priority={epic.priority} />
        <StatusBadge status={epic.status} />
        {epic.assignee_name && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Avatar name={epic.assignee_name} color={epic.assignee_color} />
            <span className="text-xs text-slate-600 max-w-[90px] truncate">{epic.assignee_name}</span>
          </div>
        )}
        {epic.deadline && (
          <span className={`text-sm shrink-0 ${epic.is_delayed ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
            {format(parseISO(epic.deadline), 'dd MMM yyyy')}
          </span>
        )}
        {epic.is_delayed && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
        <Link
          to={`/backlog?item=${epic.id}`}
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-purple-600 shrink-0"
          title="Buka di Backlog">
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      {/* Epic expanded body */}
      {open && (
        <div className="px-5 py-4">
          {/* Epic details block */}
          {(epic.acceptance_criteria || epic.notes) && (
            <div className="mb-4 p-4 bg-purple-50/40 rounded-xl border border-purple-100 text-xs grid grid-cols-2 gap-4">
              {epic.acceptance_criteria && (
                <div>
                  <p className="font-semibold text-purple-700 mb-1.5">Acceptance Criteria</p>
                  <p className="text-slate-600 whitespace-pre-line leading-relaxed">{epic.acceptance_criteria}</p>
                </div>
              )}
              {epic.notes && (
                <div>
                  <p className="font-semibold text-purple-700 mb-1.5">Notes</p>
                  <p className="text-slate-600 whitespace-pre-line leading-relaxed">{epic.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Stories */}
          {stories.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
              <p className="text-sm text-slate-400">Belum ada story dalam epic ini</p>
              <p className="text-xs text-slate-300 mt-1">Tambah story di Backlog dan pilih epic ini sebagai parent</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Stories <span className="font-normal normal-case text-slate-400">({stories.length})</span>
              </p>
              {stories.map(s => <StoryRow key={s.id} story={s} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Epic Modal ───────────────────────────────────────────────────────────

const EMPTY_FORM = { product_id: '', title: '', priority: 'medium' };

function AddEpicModal({ products, onClose, onSaved }) {
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_id) { setError('Pilih produk terlebih dahulu'); return; }
    if (!form.title.trim()) { setError('Judul epic wajib diisi'); return; }
    setSaving(true);
    setError('');
    try {
      await client.post('/backlog', { ...form, type: 'epic' });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan epic');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" /> Tambah Epic
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Produk <span className="text-red-500">*</span></label>
            <select className="select w-full" value={form.product_id} onChange={e => set('product_id', e.target.value)} required>
              <option value="">Pilih produk...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Judul Epic <span className="text-red-500">*</span></label>
            <input
              className="input w-full" placeholder="Nama epic..."
              value={form.title} onChange={e => set('title', e.target.value)} required autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prioritas</label>
            <select className="select w-full" value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Simpan Epic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EpicBoard() {
  const { hasRole } = useAuth();
  const [products,       setProducts]       = useState([]);
  const [epics,          setEpics]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [filterProduct,  setFilterProduct]  = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [search,         setSearch]         = useState('');
  const [showAddModal,   setShowAddModal]   = useState(false);

  useEffect(() => {
    client.get('/products').then(r => setProducts(r.data || [])).catch(() => {});
  }, []);

  const loadEpics = useCallback(async () => {
    setLoading(true);
    try {
      const params = { type: 'epic', limit: 200 };
      if (filterProduct) params.product_id = filterProduct;
      if (filterStatus)  params.status     = filterStatus;
      if (search.trim()) params.search     = search.trim();
      const res = await client.get('/backlog', { params });
      setEpics(res.data.items || []);
    } catch { setEpics([]); }
    finally { setLoading(false); }
  }, [filterProduct, filterStatus, search]);

  useEffect(() => { loadEpics(); }, [loadEpics]);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-500" />
            Epic Board
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Hierarki Epic → Story → Task &amp; Bug</p>
        </div>
        {hasRole('super_admin', 'manager', 'po', 'developer') && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Tambah Epic
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="card px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9" placeholder="Cari epic..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select w-auto min-w-[140px]"
          value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
          <option value="">Semua Produk</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="select w-auto min-w-[130px]"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{epics.length} epic</span>
      </div>

      {/* Epic list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : epics.length === 0 ? (
        <div className="card py-16 text-center">
          <Layers className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Tidak ada epic ditemukan</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-sm text-indigo-600 hover:underline">
            + Tambah epic baru
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {epics.map(epic => <EpicRow key={epic.id} epic={epic} />)}
        </div>
      )}

      {showAddModal && (
        <AddEpicModal
          products={products}
          onClose={() => setShowAddModal(false)}
          onSaved={loadEpics}
        />
      )}
    </div>
  );
}
