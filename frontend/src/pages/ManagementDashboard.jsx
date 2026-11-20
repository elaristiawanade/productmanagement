import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, parseISO } from 'date-fns';
import client from '../api/client';
import DashboardHeader from '../components/management/DashboardHeader';
import SprintSection from '../components/management/SprintSection';
import FeaturesSection from '../components/management/FeaturesSection';
import OpenItemTable from '../components/management/OpenItemTable';
import WeekNotes from '../components/management/WeekNotes';
import WeekPicker, { RecentWeekChips, weekNo, weekRangeLabel, ymd } from '../components/management/WeekPicker';
import Section, { SectionNote } from '../components/management/Section';

const SOURCE_NOTE = {
  scheduled: 'Dibekukan otomatis saat minggu berganti',
  manual: 'Dibekukan manual oleh Super Admin',
  backfill: 'Estimasi: dibekukan terlambat (server tidak berjalan saat minggu berakhir). Status dan progress per akhir minggu itu; PIC, deadline, dan judul seperti saat dibekukan',
};

function EstimateBadge({ source }) {
  if (source !== 'backfill') return null;
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title={SOURCE_NOTE.backfill}>
      Estimasi
    </span>
  );
}

// How often the running week's Open Item refreshes itself while the tab is visible (same pace as the notification bell).
const LIVE_REFRESH_MS = 30000;

// Put the saved remark on its row without reloading the whole week.
const withRemark = (data, item, remark) => data && ({
  ...data,
  items: data.items.map(i => (i.source === item.source && i.id === item.id ? { ...i, remark } : i)),
});

/**
 * Home -> Management. One product at a time (picked in the sidebar's Products list or the header), top to bottom:
 *   Sprint Aktif   the product's running sprint (or another one picked), with progress
 *   Features       Products -> Features with Target and Progress %
 *   Minggu Ini     Open Item of the running week (work still open only), live, refreshing itself every 30 s, and
 *                  editable, with PO Remarks and the PO's weekly note
 *   Minggu Lalu    a frozen week (last week by default; chips for the last four, a week-number calendar for older
 *                  ones), read-only except its weekly note
 * Picks live in the URL (?product=&sprint=&week=) so a view can be shared as a link.
 */
export default function ManagementDashboard() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState(null);
  const [sprints, setSprints] = useState(null);
  const [features, setFeatures] = useState(null);
  const [weeks, setWeeks] = useState(null);
  const [live, setLive] = useState(null);
  const [past, setPast] = useState(null);
  const [pastError, setPastError] = useState('');
  const [loading, setLoading] = useState(false);
  const [asOf, setAsOf] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const productParam = params.get('product') || '';
  const productId = products?.some(p => String(p.id) === productParam) ? productParam : (products?.[0] ? String(products[0].id) : '');
  const sprintParam = params.get('sprint');
  const sprintId = sprintParam !== null ? sprintParam : (sprints?.active_sprint_id ? String(sprints.active_sprint_id) : '');
  const frozenWeeks = useMemo(() => (weeks?.weeks || []).filter(w => w.source !== 'live'), [weeks]);
  const savedWeeks = useMemo(() => new Map(frozenWeeks.map(w => [w.week_start, w])), [frozenWeeks]);
  const weekParam = params.get('week') || '';
  const pastWeek = savedWeeks.get(weekParam) || frozenWeeks[0] || null;
  const currentWeekStart = weeks?.current_week_start || null;
  const trackingStart = weeks?.tracking_start || null;
  const today = ymd(new Date());

  const setParam = useCallback((changes) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([k, v]) => (v === null || v === undefined ? next.delete(k) : next.set(k, v)));
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    client.get('/management/products').then(r => setProducts(r.data || [])).catch(() => setProducts([]));
  }, []);

  // Keep the shown product in the URL, so the sidebar's Products list marks it (also when it is the default one).
  useEffect(() => {
    if (productId && productParam !== productId) setParam({ product: productId, sprint: null, week: null });
  }, [productId, productParam, setParam]);

  // Everything of the running week, for the chosen product. A refresh (or a status change) reloads it all,
  // since one change moves progress in the sprint, the features and the open items.
  const loadLive = useCallback(async (silent = false) => {
    if (!productId) return;
    if (!silent) setLoading(true);
    const q = { params: { product_id: productId } };
    try {
      const [s, f, w, o] = await Promise.all([
        client.get('/management/sprints', q),
        client.get('/management/features', q),
        client.get('/management/weeks', q),
        client.get('/management/open-items', q),
      ]);
      setSprints(s.data); setFeatures(f.data); setWeeks(w.data); setLive(o.data);
      setAsOf(new Date());
    } catch { /* toast from the API client */ } finally { setLoading(false); }
  }, [productId]);

  useEffect(() => {
    setSprints(null); setFeatures(null); setWeeks(null); setLive(null); setPast(null);
  }, [productId]);
  useEffect(() => { loadLive(); }, [loadLive, reloadKey]);

  // The running week's Open Item keeps itself current: every 30 s while the tab is visible, and right away when the
  // tab comes back, so a status changed elsewhere (Backlog, Bugs, My Task, another user) drops out of the list or
  // shows up again without a click. Only that list is fetched, silently (no spinner, no error toast). Remarks and the
  // weekly note being typed keep their own state, so a refresh does not wipe them. When the week has rolled over
  // (Monday 00:00 WIB) everything is reloaded, since last week then moves to the past-week card.
  const liveWeekRef = useRef(null);
  useEffect(() => { liveWeekRef.current = live?.week_start ?? null; }, [live?.week_start]);
  useEffect(() => {
    if (!productId) return undefined;
    let alive = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      client.get('/management/open-items', { params: { product_id: productId }, silent: true })
        .then(r => {
          if (!alive) return;
          if (liveWeekRef.current && r.data.week_start !== liveWeekRef.current) loadLive(true);
          else setLive(r.data);
        })
        .catch(() => { /* silent: the next tick tries again */ });
    };
    const timer = setInterval(refresh, LIVE_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [productId, loadLive]);

  useEffect(() => {
    if (!productId || !pastWeek) { setPast(null); return; }
    let alive = true;
    setPastError('');
    // The previous week stays on screen (dimmed) until the new one arrives, so the page does not jump.
    client.get('/management/open-items', { params: { product_id: productId, week: pastWeek.week_start }, silent: true })
      .then(r => { if (alive) setPast(r.data); })
      .catch(err => { if (alive) { setPast(null); setPastError(err.response?.data?.error || 'Gagal memuat minggu ini'); } });
    return () => { alive = false; };
  }, [productId, pastWeek?.week_start, reloadKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pickWeek = (ws) => setParam({ week: ws });

  if (products && products.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardHeader products={[]} productId="" onProduct={() => {}} onRefresh={() => {}} />
        <div className="card"><SectionNote>Belum ada produk yang bisa Anda lihat di dashboard ini.</SectionNote></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader products={products || []} productId={productId} asOf={asOf} loading={loading}
        onProduct={v => setParam({ product: v, sprint: null, week: null })}
        onRefresh={() => setReloadKey(k => k + 1)} />

      <SprintSection data={sprints} sprintId={sprintId} onSprint={v => setParam({ sprint: v })} />

      <FeaturesSection features={features} />

      <Section title="Open Item · Minggu Ini" bodyClassName=""
        hint="Pekerjaan yang masih dikerjakan minggu ini, dari Backlog, My Task, QA Module, dan Bug (In Review, Done, Ready to Test, Pass, Skip, dan sejenisnya tidak ditampilkan). Status bisa diubah langsung di sini; daftar diperbarui otomatis tiap 30 detik"
        actions={currentWeekStart && (
          <span className="text-xs text-slate-500 whitespace-nowrap">
            <strong className="font-semibold text-slate-700 tabular-nums">W{weekNo(currentWeekStart)}</strong> · {weekRangeLabel(currentWeekStart)}
            <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Live</span>
          </span>
        )}>
        <OpenItemTable items={live?.items ?? null} bugStages={live?.bug_stages} editable
          onChanged={() => loadLive(true)} emptyText="Tidak ada pekerjaan terbuka minggu ini."
          productId={productId} remarksEditable={!!live?.can_edit_remarks} asOf={today}
          onRemarkSaved={(item, remark) => setLive(d => withRemark(d, item, remark))} />
        {live && currentWeekStart && (
          <WeekNotes productId={productId} weekStart={currentWeekStart} note={live.note} canEdit={!!live.can_edit_note} live
            onSaved={note => setLive(d => d && ({ ...d, note }))} />
        )}
      </Section>

      <Section title="Minggu Lalu" bodyClassName=""
        hint={pastWeek ? SOURCE_NOTE[pastWeek.source] || 'Isi minggu ini sudah dibekukan dan tidak berubah lagi' : 'Isi minggu yang sudah lewat, dibekukan otomatis saat minggu berganti'}
        actions={<>
          {pastWeek && <EstimateBadge source={pastWeek.source} />}
          {frozenWeeks.length > 0 && (
            <WeekPicker weeks={frozenWeeks} value={pastWeek?.week_start} currentWeekStart={currentWeekStart}
              trackingStart={trackingStart} onChange={pickWeek} />
          )}
        </>}>
        {!weeks ? <SectionNote>Memuat...</SectionNote>
          : !pastWeek ? (
            <SectionNote>
              {trackingStart ? <>Pencatatan mingguan dimulai <strong className="font-semibold text-slate-600">W{weekNo(trackingStart)}</strong> ({weekRangeLabel(trackingStart)}); minggu sebelumnya tidak dicatat.<br /></> : null}
              Belum ada minggu yang selesai. Minggu ini tersimpan otomatis begitu minggu berganti (Senin 00:00 WIB) dan akan tampil di sini.
            </SectionNote>
          )
          : pastError ? <SectionNote>{pastError}</SectionNote>
          : (
            // Table and note always describe the week the server answered for (past.week_start), even while the
            // next pick is still loading, so a note is never saved under the wrong week.
            <div className={past && past.week_start !== pastWeek.week_start ? 'opacity-60 transition-opacity' : ''}>
              <OpenItemTable items={past?.items ?? null} bugStages={past?.bug_stages}
                emptyText="Tidak ada pekerjaan terbuka di minggu itu."
                productId={productId} asOf={past ? ymd(addDays(parseISO(past.week_start), 7)) : undefined}
                toolbar={<RecentWeekChips currentWeekStart={currentWeekStart} trackingStart={trackingStart} saved={savedWeeks}
                  value={pastWeek.week_start} onChange={pickWeek} />} />
              {past && (
                <WeekNotes productId={productId} weekStart={past.week_start} note={past.note} canEdit={!!past.can_edit_note}
                  onSaved={note => setPast(d => d && ({ ...d, note }))} />
              )}
            </div>
          )}
      </Section>
    </div>
  );
}
