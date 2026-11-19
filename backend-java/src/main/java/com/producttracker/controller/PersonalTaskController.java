package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import com.producttracker.service.ProgressSupport;
import com.producttracker.service.WeeklySnapshotService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

/**
 * Personal tasks: work someone adds for THEMSELVES from My Task ("Add Task"). Not a Backlog item: no code, no
 * sprint, no story points, and it never counts towards sprint, velocity or product progress. It may RELATE to a
 * Backlog item (backlog_item_id), which is only a reference, not a conversion. It belongs to a product (required),
 * which must be one of the owner's products; with a related item it is always that item's product.
 *
 * Anyone signed in may keep their own list (My Task has no permission gate). Only the owner, or a Super Admin,
 * may change or delete a task. The Management Dashboard lists them under the "My Task" source.
 *
 *   GET    /api/personal-tasks              own tasks
 *   GET    /api/personal-tasks/by-item/{id} tasks (of anyone) that relate to a Backlog item: info panel, no notes
 *   POST   /api/personal-tasks              {title, product_id, backlog_item_id?, status?, deadline?, notes?}
 *   PUT    /api/personal-tasks/{id}         same fields
 *   PATCH  /api/personal-tasks/{id}/status  {status}
 *   DELETE /api/personal-tasks/{id}
 */
@RestController
@RequestMapping("/api/personal-tasks")
public class PersonalTaskController {

    private static final Set<String> STATUSES = Set.of("todo", "in_progress", "in_review", "done", "blocked");
    private static final int MAX_TITLE = 300;

    @Autowired private JdbcTemplate jdbc;
    @Autowired private WeeklySnapshotService weekly;

    private static final String SELECT =
        "SELECT pt.id, pt.owner_id, pt.product_id, pt.backlog_item_id, pt.title, pt.notes, pt.status, pt.deadline, " +
        "       pt.completed_at, pt.created_at, pt.updated_at, " +
        "       p.name AS product_name, p.color AS product_color, " +
        "       bi.code AS related_code, bi.title AS related_title, bi.type AS related_type " +
        "FROM personal_tasks pt " +
        "JOIN products p ON p.id = pt.product_id " +
        "LEFT JOIN backlog_items bi ON bi.id = pt.backlog_item_id ";

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal) {
        Long me = PermissionHelper.getUserId(principal);
        if (me == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + "WHERE pt.owner_id = ? ORDER BY pt.id DESC", me);
        rows.forEach(this::decorate);
        return ResponseEntity.ok(rows);
    }

    /**
     * Info panel in a Backlog item's detail: who keeps a personal task that points at this item. Read-only and
     * informational (it changes nothing on the item). Like GET /api/backlog/{id}, any signed-in user may ask.
     * Only the title, status, deadline and owner are returned. The owner's private notes are not.
     */
    @GetMapping("/by-item/{itemId}")
    public ResponseEntity<?> byItem(@PathVariable Long itemId, @AuthenticationPrincipal Object principal) {
        if (PermissionHelper.getUserId(principal) == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT pt.id, pt.owner_id, u.name AS owner_name, pt.title, pt.status, pt.deadline " +
            "FROM personal_tasks pt JOIN users u ON u.id = pt.owner_id " +
            "WHERE pt.backlog_item_id = ? ORDER BY pt.id", itemId);
        rows.forEach(this::decorate);
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal, @RequestBody Map<String, Object> body) {
        Long me = PermissionHelper.getUserId(principal);
        if (me == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        Fields f = new Fields();
        ResponseEntity<?> bad = f.read(principal, body, "todo");
        if (bad != null) return bad;
        Long id = jdbc.queryForObject(
            "INSERT INTO personal_tasks (owner_id, product_id, backlog_item_id, title, notes, status, deadline) " +
            "VALUES (?,?,?,?,?,?,?) RETURNING id",
            Long.class, me, f.productId, f.backlogItemId, f.title, f.notes, f.status, f.deadline);
        return ResponseEntity.status(201).body(detail(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        Map<String, Object> current = detail(id);
        ResponseEntity<?> denied = ownerCheck(principal, current);
        if (denied != null) return denied;
        Fields f = new Fields();
        ResponseEntity<?> bad = f.read(principal, body, String.valueOf(current.get("status")));
        if (bad != null) return bad;
        jdbc.update(
            "UPDATE personal_tasks SET product_id=?, backlog_item_id=?, title=?, notes=?, status=?, deadline=? WHERE id=?",
            f.productId, f.backlogItemId, f.title, f.notes, f.status, f.deadline, id);
        return ResponseEntity.ok(detail(id));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> status(@PathVariable Long id, @AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        Map<String, Object> current = detail(id);
        ResponseEntity<?> denied = ownerCheck(principal, current);
        if (denied != null) return denied;
        String status = body.get("status") == null ? "" : body.get("status").toString().trim();
        if (!STATUSES.contains(status)) return ResponseEntity.badRequest().body(Map.of("error", "Status tidak valid"));
        jdbc.update("UPDATE personal_tasks SET status=? WHERE id=?", status, id);
        return ResponseEntity.ok(detail(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        ResponseEntity<?> denied = ownerCheck(principal, detail(id));
        if (denied != null) return denied;
        jdbc.update("DELETE FROM personal_tasks WHERE id=?", id);
        return ResponseEntity.ok(Map.of("message", "Task dihapus"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Parsed + validated body of a create/update. */
    private final class Fields {
        Long productId, backlogItemId;
        String title, notes, status;
        java.sql.Date deadline;

        /** null when valid; otherwise the 400/403 response. */
        ResponseEntity<?> read(Object principal, Map<String, Object> body, String defaultStatus) {
            title = body.get("title") == null ? "" : body.get("title").toString().trim();
            if (title.isEmpty()) return badRequest("Judul task wajib diisi");
            if (title.length() > MAX_TITLE) return badRequest("Judul task maksimal " + MAX_TITLE + " karakter");
            Object rawNotes = body.get("notes");
            notes = rawNotes == null || rawNotes.toString().isBlank() ? null : rawNotes.toString();
            status = body.get("status") == null || body.get("status").toString().isBlank()
                ? defaultStatus : body.get("status").toString().trim();
            if (!STATUSES.contains(status)) return badRequest("Status tidak valid");
            try { deadline = toSqlDate(body.get("deadline")); }
            catch (IllegalArgumentException e) { return badRequest("Format deadline tidak valid (YYYY-MM-DD)"); }

            productId = toLong(body.get("product_id"));
            backlogItemId = toLong(body.get("backlog_item_id"));
            if (backlogItemId != null) {
                List<Map<String, Object>> item = jdbc.queryForList(
                    "SELECT product_id FROM backlog_items WHERE id = ?", backlogItemId);
                if (item.isEmpty()) return badRequest("Item Backlog terkait tidak ditemukan");
                Long itemProduct = toLong(item.get(0).get("product_id"));
                if (productId != null && !productId.equals(itemProduct)) {
                    return badRequest("Item Backlog terkait bukan milik produk yang dipilih");
                }
                productId = itemProduct;
            }
            if (productId == null) return badRequest("Produk wajib dipilih");
            if (!canUseProduct(principal, productId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke produk ini"));
            }
            return null;
        }
    }

    /** Same rule as GET /api/products: Super Admin and Manager use any product, others their assigned ones. */
    @SuppressWarnings("unchecked")
    private boolean canUseProduct(Object principal, Long productId) {
        Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE id = ?", Integer.class, productId);
        if (exists == null || exists == 0) return false;
        Object role = principal instanceof Map ? ((Map<String, Object>) principal).get("role_name") : null;
        if ("super_admin".equals(role) || "manager".equals(role)) return true;
        Integer assigned = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_products WHERE user_id = ? AND product_id = ?",
            Integer.class, PermissionHelper.getUserId(principal), productId);
        return assigned != null && assigned > 0;
    }

    /** null when the caller owns the task (or is Super Admin); otherwise 404/403. */
    private ResponseEntity<?> ownerCheck(Object principal, Map<String, Object> task) {
        if (task == null) return ResponseEntity.status(404).body(Map.of("error", "Task tidak ditemukan"));
        Long me = PermissionHelper.getUserId(principal);
        if (PermissionHelper.isSuperAdmin(principal) || (me != null && me.equals(toLong(task.get("owner_id"))))) return null;
        return ResponseEntity.status(403).body(Map.of("error", "Hanya pemilik task yang bisa mengubahnya"));
    }

    private Map<String, Object> detail(Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + "WHERE pt.id = ?", id);
        if (rows.isEmpty()) return null;
        Map<String, Object> row = rows.get(0);
        decorate(row);
        return row;
    }

    /** Derived fields, the same way a Backlog item shows them: progress from the status, late after the deadline day. */
    private void decorate(Map<String, Object> row) {
        String status = String.valueOf(row.get("status"));
        row.put("progress", ProgressSupport.statusPct(status));
        Object deadline = row.get("deadline");
        boolean late = deadline != null && !"done".equals(status) && !"in_review".equals(status)
            && LocalDate.parse(deadline.toString().substring(0, 10)).isBefore(weekly.today());
        row.put("is_delayed", late);
    }

    private static java.sql.Date toSqlDate(Object v) {
        if (v == null) return null;
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        return java.sql.Date.valueOf(s.length() > 10 ? s.substring(0, 10) : s);
    }

    private static ResponseEntity<?> badRequest(String msg) {
        return ResponseEntity.badRequest().body(Map.of("error", msg));
    }

    private static Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString().trim()); } catch (Exception e) { return null; }
    }
}
