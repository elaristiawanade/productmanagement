import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, ChevronLeft, Info } from 'lucide-react';
import client from '../api/client';
import toast from 'react-hot-toast';

const JIRA_COLUMNS = ['Issue key','Summary','Issue Type','Status','Priority','Assignee','Due Date','Sprint','Epic Link','Story Points','Description'];

export default function JiraImport() {
  const navigate = useNavigate();
  const fileInputRef  = useRef(null);
  const [products,    setProducts]   = useState([]);
  const [productId,   setProductId]  = useState('');
  const [file,        setFile]       = useState(null);
  const [preview,     setPreview]    = useState(null);  // { headers, rows }
  const [importing,   setImporting]  = useState(false);
  const [result,      setResult]     = useState(null);  // { created, skipped, errors }

  useEffect(() => {
    client.get('/products').then(r => {
      setProducts(r.data || []);
      if (r.data.length === 1) setProductId(String(r.data[0].id));
    }).catch(() => {});
  }, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) { toast.error('Hanya file .csv yang diterima'); return; }
    setFile(f);
    setResult(null);

    // Parse preview (first 5 data rows)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return;
      const headers = parseCSVLine(lines[0]);
      const rows    = lines.slice(1, 6).map(l => parseCSVLine(l));
      setPreview({ headers, rows });
    };
    reader.readAsText(f, 'utf-8');
  };

  const doImport = async () => {
    if (!file) { toast.error('Pilih file CSV terlebih dahulu'); return; }
    if (!productId) { toast.error('Pilih produk tujuan'); return; }
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('product_id', productId);
      const res = await client.post('/import/jira', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      toast.success(`Import selesai: ${res.data.created} item dibuat`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengimport');
    } finally { setImporting(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => navigate('/backlog')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Kembali ke Backlog
      </button>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Import dari Jira</h2>
            <p className="text-sm text-slate-500 mt-1">
              Unggah file CSV hasil export Jira. Items yang sudah memiliki kode yang sama akan di-skip.
            </p>
          </div>
        </div>

        {/* Info: columns expected */}
        <div className="mt-5 bg-blue-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 mb-2">
            <Info className="w-3.5 h-3.5" /> Kolom CSV yang dikenali
          </p>
          <div className="flex flex-wrap gap-1.5">
            {JIRA_COLUMNS.map(c => (
              <span key={c} className="text-xs font-mono bg-white text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">
                {c}
              </span>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Kolom lain diabaikan. Ekspor dari Jira: <em>Issues → Export → CSV (current fields)</em>
          </p>
        </div>
      </div>

      {/* Config */}
      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Produk Tujuan *</label>
          <select className="select" value={productId} onChange={e => setProductId(e.target.value)}>
            <option value="">— Pilih produk —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        </div>

        {/* File upload */}
        <div>
          <label className="label">File CSV Jira *</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${file ? 'border-slate-300 bg-slate-50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`}>
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            {file ? (
              <>
                <p className="text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB — klik untuk ganti</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">Klik untuk pilih file CSV</p>
                <p className="text-xs text-slate-400 mt-1">Format: .csv (UTF-8)</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>

        <button onClick={doImport} disabled={!file || !productId || importing}
          className="btn-primary w-full py-2.5 justify-center">
          {importing
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Mengimport...</>
            : <><Upload className="w-4 h-4 mr-2" />Mulai Import</>}
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="card p-6">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            Preview (5 baris pertama)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  {preview.headers.map((h, i) => (
                    <th key={i} className="text-left px-2 py-1.5 text-slate-500 font-medium whitespace-nowrap border-b border-slate-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-100">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1.5 text-slate-600 max-w-[150px] truncate" title={cell}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card p-6 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Hasil Import</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-50 p-4 text-center">
              <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
              <p className="text-xs text-emerald-600">Item dibuat</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
              <p className="text-xs text-amber-600">Di-skip</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700">{result.errors?.length || 0}</p>
              <p className="text-xs text-red-600">Error</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700">Detail Error:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">• {e}</p>
              ))}
            </div>
          )}
          {result.created > 0 && (
            <button onClick={() => navigate('/backlog')} className="btn-primary w-full justify-center">
              Lihat di Backlog
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Minimal CSV line parser (handles quoted fields)
function parseCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}
