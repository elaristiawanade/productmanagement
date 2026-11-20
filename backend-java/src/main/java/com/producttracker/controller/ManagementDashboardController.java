package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import com.producttracker.service.FeatureRoadmapSync;
import com.producttracker.service.ProgressSupport;
import com.producttracker.service.WeeklySnapshotService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Home -> Management: a per-product dashboard. Item edits (status) go through the normal module endpoints; the
 * dashboard's own data is the PO Remarks column and the weekly notes.
 * Every endpoint needs `management_dashboard.view` plus access to the product: Super Admin, Manager and Commissioner
 * see every product, anyone else the products assigned to them (user_products) and the products they own.
 * PO Remarks and weekly notes are written by the product's Owner (products.owner_id), a Manager or a Super Admin.
 *
 *   GET /api/management/products                 products for the picker (by the rule above)
 *   GET /api/management/sprints?product_id=      sprints for the picker, active one marked, with progress
 *   GET /api/management/features?product_id=     Products -> Features with Target date and Progress % (from the status)
 *   GET /api/management/weeks?product_id=        the current week plus every frozen week, newest first, and
 *                                                tracking_start (first tracked week; earlier weeks stay empty)
 *   GET /api/management/open-items?product_id=&week=yyyy-MM-dd
 *                                                Open Item of one week (any day of it; default this week):
 *                                                only work still open (WeeklySnapshotService#stillOpen).
 *                                                This week is live, a past week comes from its frozen copy.
 *                                                Each item carries its PO remark; the week carries its note.
 *   PUT /api/management/remarks                  {product_id, item_source, item_id, expected_date?, remark?}
 *                                                PO remark of an item for the RUNNING week (both empty = clear)
 *   PUT /api/management/notes                    {product_id, week, content}: weekly note of this or a past week
 */
@RestController
@RequestMapping("/api/management")
public class ManagementDashboardController {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private ProgressSupport progressSupport;
    @Autowired private WeeklySnapshotService weekly;

    // ── Products (the picker) ────────────────────────────────────────────────

    @GetMapping("/products")
    public ResponseEntity<?> products(@AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "management_dashboard", "view")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke Management Dashboard"));
        }
        String select = "SELECT p.id, p.code, p.name, p.color, p.status FROM products p ";
        if (seesAllProducts(principal)) return ResponseEntity.ok(jdbc.queryForList(select + "ORDER BY p.name"));
        Long me = PermissionHelper.getUserId(principal);
        return ResponseEntity.ok(jdbc.queryForList(
            select + "WHERE p.owner_id = ? " +
            "   OR EXISTS (SELECT 1 FROM user_products up WHERE up.product_id = p.id AND up.user_id = ?) " +
            "ORDER BY p.name", me, me));
    }

    // ── Sprints ──────────────────────────────────────────────────────────────

    @GetMapping("/sprints")
    public ResponseEntity<?> sprints(@AuthenticationPrincipal Object principal,
                                     @RequestParam("product_id") Long productId) {
        ResponseEntity<?> denied = check(principal, productId);
        if (denied != null) return denied;

        List<Map<String, Object>> sprints = jdbc.queryForList(
            "SELECT id, name, status, goal, start_date, end_date FROM sprints WHERE product_id = ? " +
            "ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, start_date DESC NULLS LAST, id DESC",
            productId);
        // Progress per sprint: the work below the items planned in it, weighted like product progress.
        ProgressSupport.Snapshot snap = progressSupport.snapshot(List.of(productId));
        Map<Long, List<Long>> itemsBySprint = new HashMap<>();
        Map<Long, String> statusById = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT id, sprint_id, status FROM backlog_items WHERE product_id = ? AND sprint_id IS NOT NULL", productId)) {
            itemsBySprint.computeIfAbsent(num(r.get("sprint_id")), k -> new ArrayList<>()).add(num(r.get("id")));
            statusById.put(num(r.get("id")), String.valueOf(r.get("status")));
        }
        Long activeId = null;
        for (Map<String, Object> s : sprints) {
            List<Long> items = itemsBySprint.getOrDefault(num(s.get("id")), List.of());
            int work = 0, done = 0;
            for (Long id : items) {
                if (!snap.isWorkItem(id)) continue;
                work++;
                if ("done".equals(statusById.get(id))) done++;
            }
            s.put("progress", snap.averageOfSubtrees(items));
            s.put("work_items", work);
            s.put("done_items", done);
            if (activeId == null && "active".equals(s.get("status"))) activeId = num(s.get("id"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("active_sprint_id", activeId);
        out.put("sprints", sprints);
        return ResponseEntity.ok(out);
    }

    // ── Features ─────────────────────────────────────────────────────────────

    /**
     * Progress % of a feature: set by hand through its status, the same number as Products and Roadmap show
     * (FeatureRoadmapSync: Planned 20 … Active/Offline 100, On Hold keeps the last stage). Not from the Backlog:
     * linked_items (Backlog items that reference the feature's roadmap row, as Feature or Impacted Feature) is
     * shown as information only.
     */
    @GetMapping("/features")
    public ResponseEntity<?> features(@AuthenticationPrincipal Object principal,
                                      @RequestParam("product_id") Long productId) {
        ResponseEntity<?> denied = check(principal, productId);
        if (denied != null) return denied;

        List<Map<String, Object>> features = jdbc.queryForList(
            "SELECT f.id, f.code, f.name, f.status, f.priority, f.target_date, f.target_release, f.is_roadmap_item, " +
            "       f.owner_id, u.name AS owner_name, rm.status AS roadmap_status " +
            "FROM features f LEFT JOIN users u ON u.id = f.owner_id " +
            "LEFT JOIN product_roadmap rm ON rm.source_feature_id = f.id " +
            "WHERE f.product_id = ? ORDER BY f.target_date NULLS LAST, f.code", productId);
        Map<Long, Set<Long>> linked = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT r.source_feature_id AS feature_id, bi.id AS item_id " +
                "FROM product_roadmap r JOIN backlog_items bi ON bi.feature_id = r.id " +
                "WHERE r.product_id = ? AND r.source_feature_id IS NOT NULL " +
                "UNION " +
                "SELECT r.source_feature_id, bif.backlog_item_id " +
                "FROM product_roadmap r JOIN backlog_item_features bif ON bif.roadmap_id = r.id " +
                "WHERE r.product_id = ? AND r.source_feature_id IS NOT NULL", productId, productId)) {
            linked.computeIfAbsent(num(r.get("feature_id")), k -> new LinkedHashSet<>()).add(num(r.get("item_id")));
        }
        for (Map<String, Object> f : features) {
            f.put("linked_items", linked.getOrDefault(num(f.get("id")), Set.of()).size());
            f.put("progress", FeatureRoadmapSync.featureProgress(f.get("status"), f.get("roadmap_status")));
        }
        return ResponseEntity.ok(features);
    }

    // ── Weeks ────────────────────────────────────────────────────────────────

    @GetMapping("/weeks")
    public ResponseEntity<?> weeks(@AuthenticationPrincipal Object principal,
                                   @RequestParam("product_id") Long productId) {
        ResponseEntity<?> denied = check(principal, productId);
        if (denied != null) return denied;
        LocalDate current = weekly.currentWeekStart();
        LocalDate start = weekly.trackingStart();
        List<Map<String, Object>> weeks = new ArrayList<>();
        weeks.add(week(current, "live", null));
        for (Map<String, Object> w : weekly.frozenWeeks(productId)) {
            LocalDate ws = LocalDate.parse(w.get("week_start").toString());
            if (ws.isBefore(start)) continue;   // weeks before tracking began are not part of the dashboard
            weeks.add(week(ws, w.get("source").toString(), w.get("captured_at")));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("current_week_start", current.toString());
        out.put("tracking_start", start.toString());   // first tracked week; earlier weeks stay empty
        out.put("weeks", weeks);
        return ResponseEntity.ok(out);
    }

    private static Map<String, Object> week(LocalDate start, String source, Object capturedAt) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("week_start", start.toString());
        m.put("week_end", start.plusDays(6).toString());   // Sunday, for display
        m.put("source", source);                            // live | scheduled | manual | backfill (= estimasi)
        m.put("captured_at", capturedAt);
        return m;
    }

    // ── Open Item ────────────────────────────────────────────────────────────

    @GetMapping("/open-items")
    public ResponseEntity<?> openItems(@AuthenticationPrincipal Object principal,
                                       @RequestParam("product_id") Long productId,
                                       @RequestParam(value = "week", required = false) String weekParam) {
        ResponseEntity<?> denied = check(principal, productId);
        if (denied != null) return denied;

        LocalDate current = weekly.currentWeekStart();
        LocalDate weekStart;
        try {
            weekStart = weekParam == null || weekParam.isBlank() ? current
                : WeeklySnapshotService.weekStartOf(LocalDate.parse(weekParam.trim()));
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Format week tidak valid (YYYY-MM-DD)"));
        }
        if (weekStart.isAfter(current)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Minggu tersebut belum dimulai"));
        }
        if (weekStart.isBefore(weekly.trackingStart())) {
            return ResponseEntity.status(404).body(Map.of("error", "Minggu tersebut sebelum pencatatan mingguan dimulai"));
        }

        Map<String, Object> header;
        List<Map<String, Object>> items;
        if (weekStart.equals(current)) {
            header = week(current, "live", null);
            items = weekly.buildItems(productId, current);
        } else {
            Map<String, Object> frozen = weekly.frozenWeek(productId, weekStart);
            if (frozen == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Minggu tersebut tidak tersimpan"));
            }
            header = week(weekStart, frozen.get("source").toString(), frozen.get("captured_at"));
            items = weekly.frozenItems(num(frozen.get("id")));
        }
        // Only work still being worked on (no In Review / Done / Ready to Test / Pass / Skip ...), for both kinds of week.
        items = weekly.stillOpen(items);
        attachRemarks(productId, weekStart, items);
        boolean editor = canEdit(principal, productId);
        Map<String, Object> out = new LinkedHashMap<>(header);
        out.put("live", weekStart.equals(current));
        out.put("items", items);
        out.put("note", note(productId, weekStart));
        out.put("can_edit_remarks", editor && weekStart.equals(current));   // past weeks keep the expectation of then
        out.put("can_edit_note", editor);                                    // a note may be written after the week
        // Stage names/colors for the Bug rows: a dashboard viewer may not have access to Bugs Incident itself.
        out.put("bug_stages", jdbc.queryForList(
            "SELECT code, name, color, is_closed, not_late FROM bug_stages ORDER BY sort_order, name"));
        return ResponseEntity.ok(out);
    }

    // ── PO Remarks ───────────────────────────────────────────────────────────

    private static final int MAX_REMARK = 300;
    private static final int MAX_NOTE = 5000;

    /** Where each Open Item source keeps its product, to check that a remark's item belongs to the product. */
    private static final Map<String, String> ITEM_PRODUCT_SQL = Map.of(
        "backlog", "SELECT product_id FROM backlog_items WHERE id = ?",
        "mytask",  "SELECT product_id FROM personal_tasks WHERE id = ?",
        "qa",      "SELECT product_id FROM qa_test_cases WHERE id = ?",
        "bug",     "SELECT product_id FROM bugs WHERE id = ?");

    /**
     * Sets (or clears) the PO remark of an item for the running week. Only the running week: a past week keeps the
     * expectation that was written then. The remark stays in force for later weeks until it is changed again.
     */
    @PutMapping("/remarks")
    public ResponseEntity<?> saveRemark(@AuthenticationPrincipal Object principal, @RequestBody Map<String, Object> body) {
        Long productId = toLong(body.get("product_id"));
        ResponseEntity<?> denied = check(principal, productId);
        if (denied != null) return denied;
        if (!canEdit(principal, productId)) return notEditor();

        String source = body.get("item_source") == null ? "" : body.get("item_source").toString();
        Long itemId = toLong(body.get("item_id"));
        String sql = ITEM_PRODUCT_SQL.get(source);
        if (sql == null || itemId == null) return ResponseEntity.badRequest().body(Map.of("error", "Item tidak valid"));
        List<Map<String, Object>> owner = jdbc.queryForList(sql, itemId);
        if (owner.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));
        if (!productId.equals(toLong(owner.get(0).get("product_id")))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Item bukan milik produk ini"));
        }

        java.sql.Date expected;
        try { expected = toSqlDate(body.get("expected_date")); }
        catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Format tanggal ekspektasi tidak valid (YYYY-MM-DD)"));
        }
        String remark = body.get("remark") == null ? null : body.get("remark").toString().trim();
        if (remark != null && remark.isEmpty()) remark = null;
        if (remark != null && remark.length() > MAX_REMARK) {
            return ResponseEntity.badRequest().body(Map.of("error", "Remark maksimal " + MAX_REMARK + " karakter"));
        }

        LocalDate week = weekly.currentWeekStart();
        jdbc.update(
            "INSERT INTO open_item_remarks (product_id, week_start, item_source, item_id, expected_date, remark, updated_by, updated_at) " +
            "VALUES (?,?,?,?,?,?,?,NOW()) " +
            "ON CONFLICT (week_start, item_source, item_id) DO UPDATE SET product_id = EXCLUDED.product_id, " +
            "  expected_date = EXCLUDED.expected_date, remark = EXCLUDED.remark, " +
            "  updated_by = EXCLUDED.updated_by, updated_at = NOW()",
            productId, java.sql.Date.valueOf(week), source, itemId, expected, remark, PermissionHelper.getUserId(principal));

        List<Map<String, Object>> one = new ArrayList<>();
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("source", source);
        item.put("id", itemId);
        one.add(item);
        attachRemarks(productId, week, one);
        return ResponseEntity.ok(Collections.singletonMap("remark", item.get("remark")));
    }

    /**
     * Puts each item's PO remark in force for the week (the latest one written in or before it) on the item as
     * `remark`: {expected_date, text, week_start (the week it was written), carried (written in an earlier week),
     * updated_by_name, updated_at}, or null. A cleared remark (both empty) shows as null.
     */
    private void attachRemarks(long productId, LocalDate weekStart, List<Map<String, Object>> items) {
        Map<String, Map<String, Object>> byItem = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT DISTINCT ON (r.item_source, r.item_id) r.item_source, r.item_id, r.week_start, r.expected_date, " +
                "       r.remark, r.updated_at, u.name AS updated_by_name " +
                "FROM open_item_remarks r LEFT JOIN users u ON u.id = r.updated_by " +
                "WHERE r.product_id = ? AND r.week_start <= ? " +
                "ORDER BY r.item_source, r.item_id, r.week_start DESC",
                productId, java.sql.Date.valueOf(weekStart))) {
            if (r.get("expected_date") == null && r.get("remark") == null) continue;
            String from = r.get("week_start").toString().substring(0, 10);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("expected_date", r.get("expected_date") == null ? null : r.get("expected_date").toString().substring(0, 10));
            m.put("text", r.get("remark"));
            m.put("week_start", from);
            m.put("carried", !from.equals(weekStart.toString()));
            m.put("updated_by_name", r.get("updated_by_name"));
            m.put("updated_at", r.get("updated_at"));
            byItem.put(r.get("item_source") + ":" + num(r.get("item_id")), m);
        }
        for (Map<String, Object> item : items) item.put("remark", byItem.get(item.get("source") + ":" + num(item.get("id"))));
    }

    // ── Weekly notes ─────────────────────────────────────────────────────────

    /** Saves the weekly note of this week or a past one (a review is often written after the week). Empty = remove. */
    @PutMapping("/notes")
    public ResponseEntity<?> saveNote(@AuthenticationPrincipal Object principal, @RequestBody Map<String, Object> body) {
        Long productId = toLong(body.get("product_id"));
        ResponseEntity<?> denied = check(principal, productId);
        if (denied != null) return denied;
        if (!canEdit(principal, productId)) return notEditor();

        LocalDate weekStart;
        try {
            weekStart = WeeklySnapshotService.weekStartOf(LocalDate.parse(String.valueOf(body.get("week")).trim()));
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Format week tidak valid (YYYY-MM-DD)"));
        }
        if (weekStart.isAfter(weekly.currentWeekStart())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Minggu tersebut belum dimulai"));
        }
        if (weekStart.isBefore(weekly.trackingStart())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Minggu tersebut sebelum pencatatan mingguan dimulai"));
        }
        String content = body.get("content") == null ? "" : body.get("content").toString().trim();
        if (content.length() > MAX_NOTE) {
            return ResponseEntity.badRequest().body(Map.of("error", "Catatan maksimal " + MAX_NOTE + " karakter"));
        }
        java.sql.Date week = java.sql.Date.valueOf(weekStart);
        if (content.isEmpty()) {
            jdbc.update("DELETE FROM weekly_notes WHERE product_id = ? AND week_start = ?", productId, week);
        } else {
            jdbc.update(
                "INSERT INTO weekly_notes (product_id, week_start, content, updated_by, updated_at) VALUES (?,?,?,?,NOW()) " +
                "ON CONFLICT (product_id, week_start) DO UPDATE SET content = EXCLUDED.content, " +
                "  updated_by = EXCLUDED.updated_by, updated_at = NOW()",
                productId, week, content, PermissionHelper.getUserId(principal));
        }
        return ResponseEntity.ok(Collections.singletonMap("note", note(productId, weekStart)));
    }

    /** {content, updated_by_name, updated_at} of the week, or null when there is none. */
    private Map<String, Object> note(long productId, LocalDate weekStart) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT n.content, n.updated_at, u.name AS updated_by_name " +
            "FROM weekly_notes n LEFT JOIN users u ON u.id = n.updated_by WHERE n.product_id = ? AND n.week_start = ?",
            productId, java.sql.Date.valueOf(weekStart));
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ── Access ───────────────────────────────────────────────────────────────

    /** null when allowed; otherwise the 403/404 response to return. */
    private ResponseEntity<?> check(Object principal, Long productId) {
        if (!PermissionHelper.can(principal, "management_dashboard", "view")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke Management Dashboard"));
        }
        if (productId == null) return ResponseEntity.badRequest().body(Map.of("error", "product_id wajib"));
        Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE id = ?", Integer.class, productId);
        if (exists == null || exists == 0) return ResponseEntity.status(404).body(Map.of("error", "Produk tidak ditemukan"));
        if (!seesAllProducts(principal)) {
            Long me = PermissionHelper.getUserId(principal);
            Integer allowed = jdbc.queryForObject(
                "SELECT COUNT(*) FROM products p WHERE p.id = ? AND (p.owner_id = ? " +
                "  OR EXISTS (SELECT 1 FROM user_products up WHERE up.product_id = p.id AND up.user_id = ?))",
                Integer.class, productId, me, me);
            if (allowed == null || allowed == 0) {
                return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke produk ini"));
            }
        }
        return null;
    }

    /** PO Remarks and weekly notes: the product's Owner (Products -> Owner), a Manager, or a Super Admin. */
    @SuppressWarnings("unchecked")
    private boolean canEdit(Object principal, Long productId) {
        if (PermissionHelper.isSuperAdmin(principal)) return true;
        Object role = principal instanceof Map ? ((Map<String, Object>) principal).get("role_name") : null;
        if ("manager".equals(role)) return true;
        Long me = PermissionHelper.getUserId(principal);
        if (me == null || productId == null) return false;
        Integer owns = jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE id = ? AND owner_id = ?",
            Integer.class, productId, me);
        return owns != null && owns > 0;
    }

    private static ResponseEntity<?> notEditor() {
        return ResponseEntity.status(403).body(Map.of("error",
            "Hanya Owner produk ini, Manager, atau Super Admin yang bisa mengisi PO Remarks dan catatan mingguan"));
    }

    private static Long toLong(Object v) {
        if (v == null || v.toString().isBlank()) return null;
        try { return Long.valueOf(v.toString().trim()); } catch (NumberFormatException e) { return null; }
    }

    private static java.sql.Date toSqlDate(Object v) {
        String s = v == null ? "" : v.toString().trim();
        if (s.isEmpty()) return null;
        try { return java.sql.Date.valueOf(LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s)); }
        catch (DateTimeParseException e) { throw new IllegalArgumentException(e); }
    }

    /**
     * Super Admin, Manager and Commissioner see every product on this dashboard (it is a management view).
     * Wider than GET /api/products, which keeps Commissioner to their assigned products everywhere else.
     */
    @SuppressWarnings("unchecked")
    private static boolean seesAllProducts(Object principal) {
        if (!(principal instanceof Map)) return false;
        Object role = ((Map<String, Object>) principal).get("role_name");
        return "super_admin".equals(role) || "manager".equals(role) || "commissioner".equals(role);
    }

    private static long num(Object o) { return ((Number) o).longValue(); }
}
