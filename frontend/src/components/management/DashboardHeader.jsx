import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import SearchableSelect from '../SearchableSelect';

// Top bar of the Management Dashboard: which product (the dashboard is per product), and when the data was fetched.
// The product can also be picked from the sidebar's Products list; this picker stays for a hidden sidebar and phones.
export default function DashboardHeader({ products, productId, asOf, loading, onProduct, onRefresh }) {
  const options = useMemo(() => products.map(p => ({ value: String(p.id), label: p.name })), [products]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Management Dashboard</h1>
        <p className="text-sm text-slate-500">Sprint, fitur, dan pekerjaan terbuka per produk, minggu demi minggu</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="w-60" data-picker="produk">
          <SearchableSelect value={productId} onChange={onProduct} options={options} disabled={products.length === 0}
            placeholder={products.length === 0 ? 'Tidak ada produk' : 'Pilih produk...'}
            searchPlaceholder="Cari produk..." emptyMessage="Produk tidak ditemukan" />
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {asOf ? `Data per ${format(asOf, 'd MMM yyyy, HH:mm', { locale: localeId })}` : ''}
        </span>
        <button type="button" className="btn-ghost btn-sm" onClick={onRefresh} disabled={loading || !productId} title="Muat ulang">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
