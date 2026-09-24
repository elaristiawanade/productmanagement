import { useEffect, useRef, useState } from 'react';
import { Bug as BugIcon, Upload, Image as ImageIcon, X, CheckCircle2 } from 'lucide-react';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function ReportBug() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    product_id: '', title: '', description: '', steps_to_reproduce: '',
    severity: 'medium', reporter_name: '', reporter_email: '',
  });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submittedCode, setSubmittedCode] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    client.get('/public/products')
      .then(res => setProducts(res.data || []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (!previewImage) return;
    const handler = (e) => { if (e.key === 'Escape') setPreviewImage(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [previewImage]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Hanya file gambar yang diizinkan'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Ukuran file maks 10MB'); return; }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPendingFiles(pf => [...pf, { file, url: URL.createObjectURL(file), name: file.name }]);
  };

  const removePendingFile = (idx) => {
    setPendingFiles(pf => {
      URL.revokeObjectURL(pf[idx].url);
      return pf.filter((_, i) => i !== idx);
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await client.post('/public/bugs', form);
      for (const p of pendingFiles) {
        try {
          const fd = new FormData();
          fd.append('file', p.file);
          await client.post(`/public/bugs/${res.data.id}/attachments`, fd);
        } catch {
          toast.error(`Gagal mengunggah ${p.name}`);
        } finally {
          URL.revokeObjectURL(p.url);
        }
      }
      setSubmittedCode(res.data.code);
    } catch {
      // toast already shown by axios interceptor
    } finally {
      setSaving(false);
    }
  };

  if (submittedCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white/90 backdrop-blur-md border border-white/60 rounded-2xl p-8 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">Laporan Terkirim</h1>
            <p className="text-slate-500 text-sm mt-2">
              Terima kasih, laporanmu sudah tercatat dengan kode <strong className="text-slate-700">{submittedCode}</strong>.
              Tim terkait akan menindaklanjuti secepatnya.
            </p>
            <button
              type="button"
              className="btn-primary w-full justify-center py-2.5 mt-6"
              onClick={() => {
                setForm({ product_id: '', title: '', description: '', steps_to_reproduce: '', severity: 'medium', reporter_name: '', reporter_email: '' });
                setPendingFiles([]);
                setSubmittedCode(null);
              }}
            >
              Lapor Bug Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-xl">
        <div className="flex flex-col items-center mb-6 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/20">
            <BugIcon className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">Lapor Bug / Insiden</h1>
            <p className="text-slate-500 text-sm mt-1">Temukan masalah di salah satu aplikasi kantor? Laporkan di sini.</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Aplikasi / Produk *</label>
              <select className="select" value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} required>
                <option value="">Pilih aplikasi</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nama Kamu *</label>
                <input className="input" value={form.reporter_name}
                  onChange={e => setForm(f => ({ ...f, reporter_name: e.target.value }))}
                  placeholder="Nama lengkap" maxLength={150} required />
              </div>
              <div>
                <label className="label">Email Kamu *</label>
                <input type="email" className="input" value={form.reporter_email}
                  onChange={e => setForm(f => ({ ...f, reporter_email: e.target.value }))}
                  placeholder="nama@perusahaan.com" maxLength={150} required />
              </div>
            </div>

            <div>
              <label className="label">Judul Bug *</label>
              <input className="input" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ringkasan singkat masalahnya" maxLength={200} required />
            </div>

            <div>
              <label className="label">Deskripsi</label>
              <textarea className="input h-20 resize-none" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Jelaskan apa yang terjadi" />
            </div>

            <div>
              <label className="label">Langkah Reproduksi</label>
              <textarea className="input h-24 resize-none font-mono text-xs" value={form.steps_to_reproduce}
                onChange={e => setForm(f => ({ ...f, steps_to_reproduce: e.target.value }))}
                placeholder={'1. Buka halaman...\n2. Klik tombol...\n3. Bug muncul...'} />
            </div>

            <div>
              <label className="label">Tingkat Keparahan</label>
              <select className="select" value={form.severity}
                onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">
                  Lampiran Screenshot (opsional)
                  {pendingFiles.length > 0 && (
                    <span className="text-xs font-normal text-slate-400 ml-1">({pendingFiles.length})</span>
                  )}
                </label>
                <button type="button"
                  className="btn-secondary text-xs py-1 px-2 flex items-center gap-1.5"
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" />
                  Unggah Gambar
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </div>
              {pendingFiles.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Klik untuk unggah gambar</p>
                  <p className="text-xs text-slate-300 mt-0.5">JPG, PNG, GIF, WEBP • Maks 10MB</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {pendingFiles.map((p, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-video cursor-pointer"
                      onClick={() => setPreviewImage({ url: p.url, name: p.name })}>
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <button type="button" onClick={(e) => { e.stopPropagation(); removePendingFile(idx); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="aspect-video rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors flex flex-col items-center justify-center gap-1">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">Tambah</span>
                  </button>
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={saving}>
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Kirim Laporan'}
            </button>
          </form>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewImage(null)}>
          <button type="button" onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2">
            <X className="w-5 h-5" />
          </button>
          <img src={previewImage.url} alt={previewImage.name}
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
