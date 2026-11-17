import { useState } from 'react';
import { FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { collectProductData, buildProductMarkdown, exportFileName, downloadMarkdown } from '../utils/exportMarkdown';

// "Export MD" on a product card: downloads that product's full data package as one
// Markdown file for any AI. Shown only with permission export.md (Users & Roles →
// Roles & Permissions); the data inside still follows the account's normal access.
export default function ExportMdButton({ product }) {
  const { user, can } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!can('export', 'md')) return null;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    const toastId = toast.loading(`Menyiapkan paket ${product.code}…`);
    try {
      const data = await collectProductData(product, {
        canBugs: can('bugs', 'access'),
        onProgress: (done, total) => {
          if (total) toast.loading(`Mengambil komentar & aktivitas ${done}/${total}…`, { id: toastId });
        },
      });
      const now = new Date();
      const text = buildProductMarkdown(data, { exportedAt: now, exportedBy: user, origin: window.location.origin });
      downloadMarkdown(exportFileName(product, now), text);
      toast.success(
        data.failedHistories
          ? `Paket ${product.code} diunduh — riwayat ${data.failedHistories} kartu gagal dimuat`
          : `Paket ${product.code} diunduh`,
        { id: toastId },
      );
    } catch {
      toast.error(`Gagal membuat paket ${product.code}`, { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="btn-secondary btn-sm" onClick={run} disabled={busy}
      title="Unduh semua data produk ini (backlog, bugs, QA, sprint, roadmap, komentar & riwayat) sebagai file Markdown untuk diolah AI">
      <FileDown className="w-4 h-4" />
      <span className="hidden sm:inline">{busy ? 'Menyiapkan…' : 'Export MD'}</span>
    </button>
  );
}
