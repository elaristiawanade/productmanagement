package com.producttracker.controller;

import com.producttracker.config.BugHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bugs")
public class BugController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private BugHelper bugHelper;

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke modul Bugs Incident"));
    }

    // ── BUGS ─────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> listBugs(
            @AuthenticationPrincipal Object principal,
            @RequestParam(required = false) Long product_id,
            @RequestParam(required = false) Long backlog_item_id,
            @RequestParam(required = false) String stage) {
        if (!bugHelper.canAccess(principal)) return forbidden();

        List<String> filters = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (product_id != null)      { filters.add("b.product_id = ?");      params.add(product_id); }
        if (backlog_item_id != null) { filters.add("b.backlog_item_id = ?"); params.add(backlog_item_id); }
        if (stage != null)           { filters.add("b.stage = ?");           params.add(stage); }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT b.*, " +
            "  bi.code AS item_code, bi.title AS item_title, " +
            "  p.name AS product_name, p.code AS product_code, " +
            "  ru.name AS reported_by_name, au.name AS assigned_to_name, " +
            "  COUNT(bp.id)          AS update_count, " +
            "  MAX(bp.created_at)    AS last_update " +
            "FROM bugs b " +
            "LEFT JOIN backlog_items bi ON bi.id = b.backlog_item_id " +
            "LEFT JOIN products      p  ON p.id  = b.product_id " +
            "LEFT JOIN users         ru ON ru.id = b.reported_by " +
            "LEFT JOIN users         au ON au.id = b.assigned_to " +
            "LEFT JOIN bug_progress_updates bp ON bp.bug_id = b.id " +
            where +
            "GROUP BY b.id, bi.code, bi.title, p.name, p.code, ru.name, au.name " +
            "ORDER BY b.product_id, b.code",
            params.toArray());
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> createBug(@AuthenticationPrincipal Object principal,
                                        @RequestBody Map<String, Object> body) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        if (body.get("product_id") == null || body.get("title") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id dan title wajib"));
        }

        Long productId = toLong(body.get("product_id"));
        String bugCode = (String) body.get("code");
        if (bugCode == null || bugCode.isBlank()) {
            List<Map<String, Object>> last = jdbc.queryForList(
                "SELECT code FROM bugs WHERE product_id=? ORDER BY id DESC LIMIT 1", productId
            );
            int lastNum = 0;
            if (!last.isEmpty()) {
                String lastCode = (String) last.get(0).get("code");
                if (lastCode != null) {
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+$").matcher(lastCode);
                    if (m.find()) lastNum = Integer.parseInt(m.group());
                }
            }
            bugCode = "BUG-" + String.format("%03d", lastNum + 1);
        }

        Map<String, Object> user = toMap(principal);
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO bugs " +
                "(backlog_item_id, product_id, code, title, description, steps_to_reproduce, severity, priority, stage, reported_by, assigned_to) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *",
                toLong(body.get("backlog_item_id")), productId, bugCode,
                body.get("title"), body.get("description"), body.get("steps_to_reproduce"),
                orDefault(body.get("severity"), "medium"),
                orDefault(body.get("priority"), "medium"),
                "open",
                user != null ? user.get("id") : null,
                toLong(body.get("assigned_to"))
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateBug(@AuthenticationPrincipal Object principal,
                                        @PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        int updated = jdbc.update(
            "UPDATE bugs SET title=?,description=?,steps_to_reproduce=?,severity=?,priority=?,assigned_to=?,backlog_item_id=? WHERE id=?",
            body.get("title"), body.get("description"), body.get("steps_to_reproduce"),
            body.get("severity"), body.get("priority"),
            toLong(body.get("assigned_to")), toLong(body.get("backlog_item_id")), id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Bug tidak ditemukan"));
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM bugs WHERE id=?", id);
        return ResponseEntity.ok(row);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBug(@AuthenticationPrincipal Object principal, @PathVariable Long id) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        int deleted = jdbc.update("DELETE FROM bugs WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Bug tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Bug dihapus"));
    }

    // ── PROGRESS UPDATES ─────────────────────────────────────────────────────

    @GetMapping("/progress")
    public ResponseEntity<?> listProgress(
            @AuthenticationPrincipal Object principal,
            @RequestParam(required = false) Long bug_id,
            @RequestParam(required = false) Long product_id) {
        if (!bugHelper.canAccess(principal)) return forbidden();

        List<String> filters = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (bug_id != null)     { filters.add("bp.bug_id = ?");     params.add(bug_id); }
        if (product_id != null) { filters.add("b.product_id = ?"); params.add(product_id); }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT bp.*, b.code AS bug_code, b.title AS bug_title, " +
            "  bi.code AS item_code, bi.title AS item_title, " +
            "  p.name AS product_name, u.name AS updated_by_name " +
            "FROM bug_progress_updates bp " +
            "JOIN bugs            b  ON b.id  = bp.bug_id " +
            "LEFT JOIN backlog_items bi ON bi.id = b.backlog_item_id " +
            "LEFT JOIN products      p  ON p.id  = b.product_id " +
            "LEFT JOIN users         u  ON u.id  = bp.updated_by " +
            where +
            "ORDER BY bp.created_at DESC",
            params.toArray());
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/progress")
    public ResponseEntity<?> createProgress(@AuthenticationPrincipal Object principal,
                                             @RequestBody Map<String, Object> body) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        if (body.get("bug_id") == null || body.get("stage") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "bug_id dan stage wajib"));
        }
        Long bugId = toLong(body.get("bug_id"));
        String stage = (String) body.get("stage");
        Map<String, Object> user = toMap(principal);
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO bug_progress_updates (bug_id, stage, note, updated_by) VALUES (?,?,?,?) RETURNING *",
                bugId, stage, body.get("note"), user != null ? user.get("id") : null
            );
            jdbc.update("UPDATE bugs SET stage=? WHERE id=?", stage, bugId);
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    // ── DASHBOARD ────────────────────────────────────────────────────────────

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard(@AuthenticationPrincipal Object principal,
                                        @RequestParam(required = false) Long product_id) {
        if (!bugHelper.canAccess(principal)) return forbidden();

        String productFilter = product_id != null ? "AND b.product_id = ?" : "";
        Object[] params = product_id != null ? new Object[]{product_id} : new Object[]{};

        Map<String, Object> summary = jdbc.queryForMap(
            "SELECT " +
            "  COUNT(*)                                                        AS total_bugs, " +
            "  COUNT(CASE WHEN stage IN ('open','in_progress') THEN 1 END)     AS open_count, " +
            "  COUNT(CASE WHEN stage = 'fixed'    THEN 1 END)                  AS fixed_count, " +
            "  COUNT(CASE WHEN stage = 'verified' THEN 1 END)                  AS verified_count, " +
            "  COUNT(CASE WHEN stage = 'closed'   THEN 1 END)                  AS closed_count, " +
            "  ROUND(100.0 * COUNT(CASE WHEN stage = 'closed' THEN 1 END) / NULLIF(COUNT(*), 0), 1) AS resolution_rate " +
            "FROM bugs b WHERE 1=1 " + productFilter,
            params
        );

        List<Map<String, Object>> byProduct = jdbc.queryForList(
            "SELECT p.name AS product, p.color, " +
            "  COUNT(b.id)                                                 AS total_bugs, " +
            "  COUNT(CASE WHEN b.stage IN ('open','in_progress') THEN 1 END) AS open_count, " +
            "  COUNT(CASE WHEN b.stage = 'closed' THEN 1 END)              AS closed_count " +
            "FROM products p " +
            "LEFT JOIN bugs b ON b.product_id = p.id " +
            "GROUP BY p.id, p.name, p.color " +
            "ORDER BY p.id");

        List<Map<String, Object>> byStage = jdbc.queryForList(
            "SELECT stage, COUNT(*) AS count FROM bugs b WHERE 1=1 " + productFilter + " GROUP BY stage",
            params);

        List<Map<String, Object>> recentActivity = jdbc.queryForList(
            "SELECT bp.id, bp.stage, bp.note, bp.created_at, " +
            "  b.code AS bug_code, b.title AS bug_title, " +
            "  p.name AS product, u.name AS updated_by_name " +
            "FROM bug_progress_updates bp " +
            "JOIN bugs     b ON b.id = bp.bug_id " +
            "JOIN products p ON p.id = b.product_id " +
            "LEFT JOIN users u ON u.id = bp.updated_by " +
            "ORDER BY bp.created_at DESC NULLS LAST " +
            "LIMIT 10");

        return ResponseEntity.ok(Map.of(
            "summary", summary,
            "byProduct", byProduct,
            "byStage", byStage,
            "recentActivity", recentActivity
        ));
    }

    // ── ACTIVITIES / COMMENTS ────────────────────────────────────────────────

    @GetMapping("/{id}/activities")
    public ResponseEntity<?> listActivities(@AuthenticationPrincipal Object principal, @PathVariable Long id) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT a.id, a.type, a.content, a.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_avatar_color, u.id AS user_id " +
            "FROM bug_activities a " +
            "LEFT JOIN users u ON u.id = a.user_id " +
            "WHERE a.bug_id = ? ORDER BY a.created_at ASC",
            id
        );
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/{id}/activities")
    public ResponseEntity<?> addActivity(@AuthenticationPrincipal Object principal,
                                          @PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        String content = (String) body.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Komentar tidak boleh kosong"));
        }
        Map<String, Object> user = toMap(principal);

        List<Map<String, Object>> exists = jdbc.queryForList("SELECT id FROM bugs WHERE id = ?", id);
        if (exists.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Bug tidak ditemukan"));

        Map<String, Object> row = jdbc.queryForMap(
            "INSERT INTO bug_activities (bug_id, user_id, type, content) VALUES (?,?,'comment',?) RETURNING id",
            id, user != null ? toLong(user.get("id")) : null, content.trim()
        );
        List<Map<String, Object>> full = jdbc.queryForList(
            "SELECT a.id, a.type, a.content, a.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_avatar_color, u.id AS user_id " +
            "FROM bug_activities a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?",
            row.get("id")
        );
        return ResponseEntity.status(201).body(full.get(0));
    }

    @DeleteMapping("/activities/{id}")
    public ResponseEntity<?> deleteActivity(@AuthenticationPrincipal Object principal, @PathVariable Long id) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        Map<String, Object> user = toMap(principal);

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id, type FROM bug_activities WHERE id = ?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Aktivitas tidak ditemukan"));
        if ("change_log".equals(rows.get(0).get("type"))) {
            return ResponseEntity.status(403).body(Map.of("error", "Log perubahan tidak dapat dihapus"));
        }

        Long ownerId = toLong(rows.get(0).get("user_id"));
        Long actorId = user != null ? toLong(user.get("id")) : null;
        boolean isOwner = ownerId != null && ownerId.equals(actorId);
        boolean isSuperAdmin = "super_admin".equals(com.producttracker.config.PermissionHelper.getRoleName(principal));
        if (!isOwner && !isSuperAdmin) {
            return ResponseEntity.status(403).body(Map.of("error", "Hanya bisa menghapus komentar sendiri"));
        }

        jdbc.update("DELETE FROM bug_activities WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Komentar dihapus"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
    }

    private Object orDefault(Object v, Object d) {
        return v != null ? v : d;
    }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        String s = v.toString();
        if (s.isBlank()) return null;
        return Long.parseLong(s);
    }
}
