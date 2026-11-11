import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Landmark, MessageSquare, Settings2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import client from '../api/client';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import ClientStatusPill from '../components/ClientStatusPill';
import { useAuth } from '../context/AuthContext';
import { useDeepLink } from '../utils/deepLink';
import { renderWithLinks } from '../utils/linkify';

// ─── helpers ──────────────────────────────────────────────────────────────────
const rupiah = (n) => (n === null || n === undefined || n === '') ? null
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n));

// Postgres DATE arrives as "yyyy-MM-dd" (possibly with a time part); keep only the date so no timezone shift happens
const dateOnly = (d) => (d ? String(d).split('T')[0] : '');
const fmtDate = (d) => (d ? format(parseISO(dateOnly(d)), 'dd MMM yyyy') : null);

function ProductChip({ p }) {
  return (
    <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded border"
      style={{ color: p.color, borderColor: p.color + '55', backgroundColor: p.color + '15' }}>
      {p.code}
    </span>
  );
}

function Avatar({ name, color, size = 'w-6 h-6 text-[11px]' }) {
  return (
    <span className={`${size} rounded-full grid place-items-center text-white font-semibold shrink-0`}
      style={{ backgroundColor: color || '#4F46E5' }}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

// ─── Comments (riwayat catatan update) ────────────────────────────────────────
function ClientComments({ clientId, canWrite, onChanged }) {
  const { user } = useAuth();
  const [items, setItems]   = useState(null);
  const [text, setText]     = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await client.get(`/clients/${clientId}/comments`);
      setItems(data);
    } catch { setItems([]); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await client.post(`/clients/${clientId}/comments`, { content: text.trim() });
      setText('');
      await load();
      onChanged();
    } catch { /* the API client already toasted the error */ } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Hapus catatan ini?')) return;
    try {
      await client.delete(`/clients/comments/${id}`);
      await load();
      onChanged();
    } catch { /* toasted */ }
  };

  return (
    <div className="mt-6 pt-5 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-slate-500" />
        <h4 className="text-sm font-semibold text-slate-800">Catatan Update</h4>
        {items && <span className="text-xs text-slate-400">{items.length}</span>}
      </div>

      {canWrite && (
        <div className="mb-4">
          <textarea className="input h-20 resize-none" value={text} maxLength={5000}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') add(); }}
            placeholder="Tulis perkembangan terbaru, mis. meeting, negosiasi, perpanjangan kontrak… (Ctrl+Enter untuk kirim)" />
          <div className="flex justify-end mt-2">
            <button type="button" className="btn-primary btn-sm" disabled={saving || !text.trim()} onClick={add}>
              {saving ? 'Menyimpan...' : 'Tambah Catatan'}
            </button>
          </div>
        </div>
      )}

      {items === null ? (
        <p className="text-xs text-slate-400">Memuat catatan...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Belum ada catatan update.</p>
      ) : (
        <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {items.map(c => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar name={c.user_name} color={c.user_color} size="w-7 h-7 text-xs" />
              <div className="min-w-0 flex-1 bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-800">{c.user_name || 'User dihapus'}</span>
                  <span className="text-slate-400">{format(parseISO(c.created_at), 'dd MMM yyyy, HH:mm')}</span>
                  {(user?.id === c.user_id || user?.role === 'super_admin') && (
                    <button type="button" title="Hapus catatan" onClick={() => remove(c.id)}
                      className="ml-auto text-slate-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-slate-700 whitespace-pre-wrap break-words mt-0.5">{renderWithLinks(c.content, `cc${c.id}`)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────
function ClientForm({ item, options, readOnly, onSaved, onClose, onCommentsChanged }) {
  const { can } = useAuth();
  const isNew = !item?.id;
  const defaultStatus = options.statuses.find(s => s.code === 'approaching') || options.statuses[0];

  const [form, setForm] = useState({
    bank_name:      item?.bank_name || '',
    city:           item?.city || '',
    status_id:      item?.status_id || defaultStatus?.id || '',
    contract_no:    item?.contract_no || '',
    revenue:        item?.revenue === null || item?.revenue === undefined ? '' : String(item.revenue),
    contract_start: dateOnly(item?.contract_start),
    contract_end:   dateOnly(item?.contract_end),
    pic_id:         item?.pic_id || '',
    product_ids:    (item?.products || []).map(p => p.id),
  });
  // While the PIC has not been chosen by hand, it follows the Product Owner of the selected product
  const picTouched = useRef(!!item?.pic_id);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const ownerOf = (ids) => {
    for (const id of ids) {
      const p = options.products.find(x => x.id === id);
      if (p?.owner_id) return p;
    }
    return null;
  };

  const toggleProduct = (id) => setForm(f => {
    const ids = f.product_ids.includes(id) ? f.product_ids.filter(x => x !== id) : [...f.product_ids, id];
    return { ...f, product_ids: ids, pic_id: picTouched.current ? f.pic_id : (ownerOf(ids)?.owner_id || '') };
  });

  const autoOwner = !picTouched.current ? ownerOf(form.product_ids) : null;

  const picOptions = useMemo(() => {
    const list = options.users.map(u => ({
      value: u.id, label: u.name,
      badge: u.role_name === 'po' ? { text: 'PO', className: 'bg-slate-200 text-slate-700' } : undefined,
    }));
    // A PIC that is no longer a candidate (e.g. role changed) must stay visible so saving does not drop it silently
    if (item?.pic_id && !list.some(o => String(o.value) === String(item.pic_id))) {
      list.unshift({ value: item.pic_id, label: item.pic_name || `User #${item.pic_id}` });
    }
    return list;
  }, [options.users, item]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.bank_name.trim()) { toast.error('Nama bank wajib diisi'); return; }
    if (form.contract_start && form.contract_end && form.contract_end < form.contract_start) {
      toast.error('Tanggal akhir kontrak tidak boleh sebelum tanggal mulai'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        revenue:        form.revenue === '' ? null : form.revenue,
        contract_start: form.contract_start || null,
        contract_end:   form.contract_end || null,
        pic_id:         form.pic_id || null,
      };
      if (isNew) {
        await client.post('/clients', payload);
        toast.success(`Client ${form.bank_name.trim()} ditambahkan`);
      } else {
        await client.put(`/clients/${item.id}`, payload);
        toast.success('Client diperbarui');
      }
      onSaved();
    } catch { /* the API client already toasted the error */ } finally { setSaving(false); }
  };

  return (
    <div>
      <form onSubmit={save}>
        <fieldset disabled={readOnly} className="grid grid-cols-2 gap-4 min-w-0 border-0 p-0 m-0">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Nama Bank *</label>
            <input className="input" value={form.bank_name} onChange={e => set('bank_name', e.target.value)}
              placeholder="contoh: Bank Mandiri" maxLength={150} required autoFocus={isNew} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Kota</label>
            <input className="input" value={form.city} onChange={e => set('city', e.target.value)}
              placeholder="contoh: Jakarta" maxLength={100} />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="label">Status *</label>
            <select className="select" value={form.status_id} onChange={e => set('status_id', e.target.value)} required>
              {options.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">No Contract</label>
            <input className="input" value={form.contract_no} onChange={e => set('contract_no', e.target.value)}
              placeholder="Kosongkan jika belum ada" maxLength={100} />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="label">Start Contract</label>
            <input type="date" className="input" value={form.contract_start} max="9999-12-31" onChange={e => set('contract_start', e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">End of Contract</label>
            <input type="date" className="input" value={form.contract_end} min={form.contract_start || undefined} max="9999-12-31"
              onChange={e => set('contract_end', e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className="label">Revenue (per kontrak)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 pointer-events-none">Rp</span>
              <input type="number" min="0" step="any" className="input pl-8" value={form.revenue}
                onChange={e => set('revenue', e.target.value)} placeholder="0" />
            </div>
            {form.revenue !== '' && Number(form.revenue) >= 0 && (
              <p className="text-xs text-slate-400 mt-1">{rupiah(form.revenue)}</p>
            )}
          </div>

          <div className="col-span-2">
            <label className="label">Produk yang dipakai</label>
            {options.products.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada produk.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {options.products.map(p => {
                  const on = form.product_ids.includes(p.id);
                  return (
                    <button type="button" key={p.id} onClick={() => toggleProduct(p.id)} aria-pressed={on}
                      title={p.owner_name ? `Product Owner: ${p.owner_name}` : 'Belum ada Product Owner'}
                      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[12.5px] transition-colors
                        ${on ? 'border-slate-800 bg-slate-100 text-slate-800 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className="label">PIC (tim inhouse)</label>
            <SearchableSelect value={form.pic_id} options={picOptions} emptyOptionLabel="— Tanpa PIC —"
              placeholder="— Pilih PIC —" searchPlaceholder="Cari user..." disabled={readOnly}
              onChange={v => { picTouched.current = true; set('pic_id', v); }} />
            {autoOwner && (
              <p className="text-xs text-slate-400 mt-1">Otomatis dari Product Owner {autoOwner.name} — bisa diganti.</p>
            )}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-4 mt-5 border-t border-slate-200">
          <button type="button" className="btn-secondary" onClick={onClose}>{readOnly ? 'Tutup' : 'Batal'}</button>
          {!readOnly && (
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : (isNew ? 'Tambah Client' : 'Perbarui')}
            </button>
          )}
        </div>
      </form>

      {!isNew && (
        <ClientComments clientId={item.id} canWrite={can('clients', 'update')} onChanged={onCommentsChanged} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Clients() {
  const { can } = useAuth();
  const [rows, setRows]       = useState([]);
  const [options, setOptions] = useState({ products: [], users: [], statuses: [] });
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState({ open: false, item: null });
  const [q, setQ]                     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterPic, setFilterPic]     = useState('');

  // Reload without the full-page spinner, so an open modal (e.g. while adding a comment) is not unmounted
  const refresh = useCallback(async () => {
    const [cl, op] = await Promise.all([client.get('/clients'), client.get('/clients/options')]);
    setRows(cl.data);
    setOptions(op.data);
  }, []);

  useEffect(() => {
    refresh().catch(() => {}).finally(() => setLoading(false));
  }, [refresh]);

  // Ctrl K palette: ?client=<id> opens that client; ?new=1 opens an empty form (only when the role may create)
  useDeepLink(['client', 'new'], (p) => {
    if (p.new) {
      if (can('clients', 'create')) setModal({ open: true, item: null });
      return;
    }
    if (p.client) {
      client.get(`/clients/${p.client}`).then(r => setModal({ open: true, item: r.data })).catch(() => {});
    }
  });

  const closeModal = () => setModal(m => ({ ...m, open: false }));
  const afterSave = async () => { closeModal(); await refresh().catch(() => {}); };

  const remove = async (row) => {
    if (!confirm(`Hapus client "${row.bank_name}" beserta semua catatannya?`)) return;
    try {
      await client.delete(`/clients/${row.id}`);
      toast.success('Client dihapus');
      await refresh().catch(() => {});
    } catch { /* toasted */ }
  };

  // Everything except the status filter, so the status cards show how many clients each status would give
  const matchesBase = (r) => {
    if (filterProduct && !(r.products || []).some(p => String(p.id) === filterProduct)) return false;
    if (filterPic && String(r.pic_id || '') !== filterPic) return false;
    const term = q.trim().toLowerCase();
    if (term) {
      const hay = [r.bank_name, r.city, r.contract_no, r.pic_name, r.last_comment].filter(Boolean).join(' ').toLowerCase();
      if (!term.split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  };
  const baseRows = rows.filter(matchesBase);
  const visible  = baseRows.filter(r => !filterStatus || String(r.status_id) === filterStatus);

  const picChoices = useMemo(() => {
    const m = new Map();
    rows.forEach(r => { if (r.pic_id) m.set(String(r.pic_id), r.pic_name); });
    return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [rows]);

  const filtered = !!(q || filterStatus || filterProduct || filterPic);
  const clearFilters = () => { setQ(''); setFilterStatus(''); setFilterProduct(''); setFilterPic(''); };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const canEditRow = can('clients', 'update');

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64 max-md:w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="input pl-8" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Cari bank, kota, no contract, PIC…" />
        </div>
        <select className="select w-44" value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
          <option value="">Semua Produk</option>
          {options.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="select w-44" value={filterPic} onChange={e => setFilterPic(e.target.value)}>
          <option value="">Semua PIC</option>
          {picChoices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        {filtered && (
          <button type="button" className="chip" onClick={clearFilters}><X className="w-3.5 h-3.5" />Reset filter</button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {can('settings', 'update') && (
            <Link to="/settings/clients" className="btn-secondary">
              <Settings2 className="w-4 h-4" /> Atur Status
            </Link>
          )}
          {can('clients', 'create') && (
            <button className="btn-primary" onClick={() => setModal({ open: true, item: null })}>
              <Plus className="w-4 h-4" /> Tambah Client
            </button>
          )}
        </div>
      </div>

      {/* Status summary cards (click to filter) */}
      {options.statuses.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {options.statuses.map(s => {
            const count = baseRows.filter(r => r.status_id === s.id).length;
            const on = filterStatus === String(s.id);
            return (
              <button key={s.id} type="button" onClick={() => setFilterStatus(on ? '' : String(s.id))}
                className={`card p-3 text-left transition-all ${on ? 'ring-2 ring-slate-800' : 'hover:border-slate-300 hover:bg-slate-50'}`}>
                <p className="text-xl font-bold text-slate-800">{count}</p>
                <div className="mt-1"><ClientStatusPill name={s.name} color={s.color} /></div>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 text-xs text-slate-500">
          {visible.length} client{filtered ? ` dari ${rows.length}` : ''}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="text-left px-4 py-3">Bank</th>
                <th className="text-left px-2.5 py-3">Kota</th>
                <th className="text-left px-2.5 py-3">Status</th>
                <th className="text-left px-2.5 py-3">No Contract</th>
                <th className="text-left px-2.5 py-3">Produk</th>
                <th className="text-left px-2.5 py-3">PIC</th>
                <th className="text-right px-2.5 py-3">Revenue</th>
                <th className="text-left px-2.5 py-3 whitespace-nowrap">Start – End</th>
                <th className="text-left px-2.5 py-3">Update Terakhir</th>
                <th className="text-center px-2.5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    <Landmark className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>{rows.length === 0 ? 'Belum ada client' : 'Tidak ada client yang cocok dengan filter'}</p>
                  </td>
                </tr>
              )}
              {visible.map(r => (
                <tr key={r.id} className="table-row cursor-pointer" onClick={() => setModal({ open: true, item: r })}>
                  <td className="px-4 py-3 font-medium text-slate-800 min-w-[120px]">{r.bank_name}</td>
                  <td className="px-2.5 py-3 text-slate-600">{r.city || <span className="text-slate-300">—</span>}</td>
                  <td className="px-2.5 py-3"><ClientStatusPill name={r.status_name} color={r.status_color} /></td>
                  <td className="px-2.5 py-3 text-slate-600 break-words">{r.contract_no || <span className="text-slate-300">—</span>}</td>
                  <td className="px-2.5 py-3">
                    <div className="flex flex-wrap gap-1 min-w-[72px]">
                      {(r.products || []).length === 0
                        ? <span className="text-slate-300">—</span>
                        : r.products.map(p => <ProductChip key={p.id} p={p} />)}
                    </div>
                  </td>
                  <td className="px-2.5 py-3">
                    {r.pic_name ? (
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={r.pic_name} color={r.pic_color} />
                        <span className="text-slate-700">{r.pic_name}</span>
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2.5 py-3 text-right text-slate-700 whitespace-nowrap tabular-nums">
                    {rupiah(r.revenue) || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2.5 py-3 text-slate-600 whitespace-nowrap text-[13px] leading-5">
                    {r.contract_start || r.contract_end ? (
                      <>
                        <div>{fmtDate(r.contract_start) || <span className="text-slate-300">—</span>}</div>
                        <div className="text-slate-400">→ {fmtDate(r.contract_end) || <span className="text-slate-300">—</span>}</div>
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2.5 py-3 min-w-[150px] max-w-[200px]">
                    {r.last_comment ? (
                      <div className="flex items-start gap-1.5">
                        <p className="text-xs text-slate-600 line-clamp-2 break-words" title={r.last_comment}>{r.last_comment}</p>
                        {Number(r.comment_count) > 1 && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] text-slate-400">
                            <MessageSquare className="w-3 h-3" />{r.comment_count}
                          </span>
                        )}
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2.5 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-center">
                      {canEditRow && (
                        <button className="btn-ghost btn-sm p-1.5 rounded-lg" title="Edit"
                          onClick={() => setModal({ open: true, item: r })}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {can('clients', 'delete') && (
                        <button className="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Hapus"
                          onClick={() => remove(r)}>
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

      <Modal open={modal.open} onClose={closeModal} size="lg"
        title={modal.item ? modal.item.bank_name : 'Tambah Client'}>
        {modal.open && (
          <ClientForm
            key={modal.item?.id || 'new'}
            item={modal.item}
            options={options}
            readOnly={modal.item ? !can('clients', 'update') : !can('clients', 'create')}
            onSaved={afterSave}
            onClose={closeModal}
            onCommentsChanged={() => refresh().catch(() => {})}
          />
        )}
      </Modal>
    </div>
  );
}
