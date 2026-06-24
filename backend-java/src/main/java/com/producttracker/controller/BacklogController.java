package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import com.producttracker.service.TeamsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/backlog")
public class BacklogController {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private TeamsService teams;

    private static final String ITEM_FIELDS =
        "bi.id, bi.product_id, bi.code, bi.title, bi.type, bi.priority, " +
        "bi.story_points, bi.status, bi.acceptance_criteria, bi.notes, bi.deadline, " +
        "bi.parent_id, bi.assignee_id, bi.sprint_id, bi.feature_id, bi.epic_id, " +
        "bi.created_at, bi.updated_at, " +
        "p.name AS product_name, p.color AS product_color, p.code AS product_code, " +
        "f.feature_name AS feature_name, CAST(f.id AS VARCHAR) AS feature_code, " +
        "e.name AS epic_name, e.code AS epic_code, " +
        "s.name AS sprint_name, " +
        "u.name AS assignee_name, u.avatar_color AS assignee_color, " +
        "par.code AS parent_code, par.title AS parent_title, " +
        "CASE WHEN bi.deadline < NOW() AND bi.status NOT IN ('done','backlog') THEN true ELSE false END AS is_delayed ";

    private static final String ITEM_JOINS =
        "FROM backlog_items bi " +
        "LEFT JOIN products p        ON p.id   = bi.product_id " +
        "LEFT JOIN product_roadmap f  ON f.id   = bi.feature_id " +
        "LEFT JOIN epics    e        ON e.id   = bi.epic_id " +
        "LEFT JOIN sprints  s        ON s.id   = bi.sprint_id " +
        "LEFT JOIN users    u        ON u.id   = bi.assignee_id " +
        "LEFT JOIN backlog_items par ON par.id = bi.parent_id ";

    // ─── LIST ──────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> list(
            @AuthenticationPrincipal Object principal,
            @RequestParam(required = false) Long product_id,
            @RequestParam(required = false) Long sprint_id,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Long assignee_id,
            @RequestParam(required = false) Long parent_id,
            @RequestParam(required = false) String deadline_from,
            @RequestParam(required = false) String deadline_to,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int limit) {

        List<String> filters = new ArrayList<>();
        List<Object> params  = new ArrayList<>();

        Map<String, Object> user = toMap(principal);
        // Skip product restriction when user is viewing their own assigned tasks
        // (MyTask module uses assignee_id=current_user — users must always see their own items)
        boolean isMyTasksQuery = user != null && assignee_id != null
            && assignee_id.equals(toLong(user.get("id")));

        if (user != null && !isManagerOrAbove(user) && !isMyTasksQuery) {
            List<Long> assignedIds = getAssignedProductIds(toLong(user.get("id")));
            if (assignedIds.isEmpty()) {
                return ResponseEntity.ok(Map.of("items", List.of(), "total", 0, "page", page, "limit", limit));
            }
            String ph = assignedIds.stream().map(x -> "?").collect(Collectors.joining(","));
            filters.add("bi.product_id IN (" + ph + ")");
            params.addAll(assignedIds);
        }

        if (product_id != null)  { filters.add("bi.product_id = ?");  params.add(product_id); }
        if (sprint_id != null)   { filters.add("bi.sprint_id = ?");   params.add(sprint_id); }
        if (status != null)      { filters.add(buildInFilter("bi.status", status, params)); }
        if (priority != null)    { filters.add(buildInFilter("bi.priority", priority, params)); }
        if (type != null)        { filters.add(buildInFilter("bi.type", type, params)); }
        if (assignee_id != null) { filters.add("bi.assignee_id = ?"); params.add(assignee_id); }
        if (parent_id != null)   { filters.add("bi.parent_id = ?");   params.add(parent_id); }
        if (deadline_from != null && !deadline_from.isBlank()) {
            filters.add("bi.deadline >= ?::date");
            params.add(deadline_from);
        }
        if (deadline_to != null && !deadline_to.isBlank()) {
            filters.add("bi.deadline <= (?::date + INTERVAL '1 day' - INTERVAL '1 second')");
            params.add(deadline_to);
        }
        if (search != null && !search.isBlank()) {
            filters.add("(bi.title ILIKE ? OR bi.code ILIKE ?)");
            params.add("%" + search + "%");
            params.add("%" + search + "%");
        }

        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";
        int offset = (page - 1) * limit;

        try {
            Long total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM backlog_items bi " + where, Long.class, params.toArray()
            );

            List<Object> pageParams = new ArrayList<>(params);
            pageParams.add(limit);
            pageParams.add(offset);

            List<Map<String, Object>> items = jdbc.queryForList(
                "SELECT " + ITEM_FIELDS + ITEM_JOINS + where +
                "ORDER BY " +
                "  CASE bi.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, " +
                "  bi.created_at DESC " +
                "LIMIT ? OFFSET ?",
                pageParams.toArray()
            );

            return ResponseEntity.ok(Map.of(
                "items", items, "total", total != null ? total : 0, "page", page, "limit", limit
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.getClass().getName()));
        }
    }

    // ─── GET ONE ───────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " + ITEM_FIELDS + ITEM_JOINS + "WHERE bi.id=?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));
        return ResponseEntity.ok(rows.get(0));
    }

    // ─── CREATE ────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        if (body.get("product_id") == null || body.get("title") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id dan title wajib"));
        }
        Map<String, Object> actorCheck = toMap(principal);
        if (actorCheck == null) return ResponseEntity.status(401).build();
        if (!canWriteBacklog(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk menambah backlog item"));
        }

        String type    = (String) orDefault(body.get("type"), "story");
        Long parentId  = toLong(body.get("parent_id"));

        ResponseEntity<?> valErr = validateTaskParent(type, parentId);
        if (valErr != null) return valErr;

        String itemCode = (String) body.get("code");
        if (itemCode == null || itemCode.isBlank()) {
            Long productId = toLong(body.get("product_id"));
            List<Map<String, Object>> pRows = jdbc.queryForList(
                "SELECT code FROM products WHERE id=?", productId
            );
            String pCode = pRows.isEmpty() ? "PB" : (String) pRows.get(0).get("code");
            List<Map<String, Object>> lastRows = jdbc.queryForList(
                "SELECT code FROM backlog_items WHERE product_id=? AND code LIKE ? ORDER BY code DESC LIMIT 1",
                productId, pCode + "-%"
            );
            String lastCode = lastRows.isEmpty() ? null : (String) lastRows.get(0).get("code");
            int lastNum = 0;
            if (lastCode != null) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+$").matcher(lastCode);
                if (m.find()) lastNum = Integer.parseInt(m.group());
            }
            itemCode = pCode + "-" + String.format("%03d", lastNum + 1);
        }

        Map<String, Object> actor = toMap(principal);
        String actorName = actor != null ? str(actor.get("name")) : "System";

        try {
            Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO backlog_items " +
                "(product_id, code, title, type, feature_id, epic_id, parent_id, priority, story_points, " +
                "status, sprint_id, assignee_id, acceptance_criteria, notes, deadline, created_by) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id, code",
                toLong(body.get("product_id")), itemCode, body.get("title"),
                type,
                toLong(body.get("feature_id")), toLong(body.get("epic_id")),
                parentId,
                orDefault(body.get("priority"), "medium"),
                orDefault(body.get("story_points"), 0),
                orDefault(body.get("status"), "backlog"),
                toLong(body.get("sprint_id")), toLong(body.get("assignee_id")),
                body.get("acceptance_criteria"), body.get("notes"), toSqlDate(body.get("deadline")),
                actor != null ? actor.get("id") : null
            );

            Long newId = toLong(created.get("id"));

            List<Map<String, Object>> detail = jdbc.queryForList(
                "SELECT " + ITEM_FIELDS + ITEM_JOINS + "WHERE bi.id=?", newId
            );
            Map<String, Object> item = detail.get(0);

            // Activity log
            logActivity(newId, actor, "Item dibuat oleh " + actorName);

            // Notification if assigned
            Long assigneeId = toLong(body.get("assignee_id"));
            if (assigneeId != null && !assigneeId.equals(toLong(actor != null ? actor.get("id") : null))) {
                createNotification(assigneeId, "assignment",
                    "Kamu di-assign ke " + itemCode,
                    "Task \"" + body.get("title") + "\" telah di-assign kepadamu oleh " + actorName,
                    "/backlog?item=" + newId);
            }

            // Teams
            teams.sendTaskCreated(item, actorName);

            // Cascade SP up: Story SP = Σ tasks, Epic SP = Σ stories
            recalcAncestorSp(parentId);

            return ResponseEntity.status(201).body(item);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                return ResponseEntity.status(409).body(Map.of("error", "Kode item sudah ada"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    // ─── UPDATE ────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actorUpd = toMap(principal);
        if (actorUpd == null) return ResponseEntity.status(401).build();

        // Check: can write backlog, OR has update_assigned AND is the assignee
        if (!canWriteBacklog(principal)) {
            if (PermissionHelper.hasPermission(principal, "update_assigned")) {
                Long actorId = PermissionHelper.getUserId(principal);
                List<Map<String, Object>> assigneeCheck = jdbc.queryForList(
                    "SELECT assignee_id FROM backlog_items WHERE id = ?", id
                );
                Long currentAssignee = assigneeCheck.isEmpty() ? null
                    : toLong(assigneeCheck.get(0).get("assignee_id"));
                if (!java.util.Objects.equals(actorId, currentAssignee)) {
                    return ResponseEntity.status(403).body(Map.of("error", "Hanya bisa mengubah item yang di-assign kepadamu"));
                }
            } else {
                return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk mengubah backlog item"));
            }
        }

        String type   = (String) body.get("type");
        Long parentId = toLong(body.get("parent_id"));

        ResponseEntity<?> valErr = validateTaskParent(type, parentId);
        if (valErr != null) return valErr;

        // Snapshot before update to detect changes
        List<Map<String, Object>> before = jdbc.queryForList(
            "SELECT " + ITEM_FIELDS + ITEM_JOINS + "WHERE bi.id=?", id
        );
        if (before.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));
        Map<String, Object> prev = before.get(0);

        Map<String, Object> actor = toMap(principal);
        String actorName = actor != null ? str(actor.get("name")) : "System";

        jdbc.update(
            "UPDATE backlog_items SET title=?,type=?,feature_id=?,epic_id=?,parent_id=?,priority=?," +
            "story_points=?,status=?,sprint_id=?,assignee_id=?,acceptance_criteria=?,notes=?,deadline=? WHERE id=?",
            body.get("title"), type,
            toLong(body.get("feature_id")), toLong(body.get("epic_id")),
            parentId,
            body.get("priority"),
            orDefault(body.get("story_points"), 0),
            body.get("status"),
            toLong(body.get("sprint_id")), toLong(body.get("assignee_id")),
            body.get("acceptance_criteria"), body.get("notes"), toSqlDate(body.get("deadline")),
            id
        );

        // Cascade SP up: Story SP = Σ tasks, Epic SP = Σ stories
        Long oldParentId = toLong(prev.get("parent_id"));
        if (parentId != null) recalcAncestorSp(parentId);
        if (oldParentId != null && !java.util.Objects.equals(oldParentId, parentId)) {
            recalcAncestorSp(oldParentId); // also recalc old parent if parent changed
        }

        List<Map<String, Object>> detail = jdbc.queryForList(
            "SELECT " + ITEM_FIELDS + ITEM_JOINS + "WHERE bi.id=?", id
        );
        Map<String, Object> item = detail.get(0);

        // Build change description
        List<String> changes = buildChanges(prev, body, item);
        if (!changes.isEmpty()) {
            String changeLog = String.join("; ", changes) + " — oleh " + actorName;
            logActivity(id, null, changeLog); // null user_id = system log entry
        } else {
            logActivity(id, null, "Item diperbarui oleh " + actorName);
        }

        // Notification if assignee changed
        Long newAssigneeId = toLong(body.get("assignee_id"));
        Long prevAssigneeId = toLong(prev.get("assignee_id"));
        Long actorId = actor != null ? toLong(actor.get("id")) : null;
        if (newAssigneeId != null && !newAssigneeId.equals(prevAssigneeId)
                && !newAssigneeId.equals(actorId)) {
            createNotification(newAssigneeId, "assignment",
                "Kamu di-assign ke " + str(item.get("code")),
                "Task \"" + item.get("title") + "\" telah di-assign kepadamu oleh " + actorName,
                "/backlog?item=" + id);
        }

        // Teams
        String changesStr = changes.isEmpty() ? "Diperbarui" : String.join(", ", changes);
        teams.sendTaskUpdated(item, actorName, changesStr);

        return ResponseEntity.ok(item);
    }

    // ─── PATCH STATUS ──────────────────────────────────────────────────────

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> patchStatus(@PathVariable Long id,
                                          @AuthenticationPrincipal Object principal,
                                          @RequestBody Map<String, Object> body) {
        if (body.get("status") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Status wajib"));
        }
        Map<String, Object> actorPatch = toMap(principal);
        if (actorPatch == null) return ResponseEntity.status(401).build();
        if (!canWriteBacklog(principal) && !PermissionHelper.hasPermission(principal, "update_assigned")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk mengubah status item"));
        }

        // Get old status
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT bi.status, bi.code, bi.title FROM backlog_items bi WHERE bi.id=?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));
        String oldStatus = str(rows.get(0).get("status"));
        String newStatus = (String) body.get("status");

        int updated = jdbc.update(
            "UPDATE backlog_items SET status=? WHERE id=?", newStatus, id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));

        Map<String, Object> actor = toMap(principal);
        String actorName = actor != null ? str(actor.get("name")) : "System";
        logActivity(id, null, "Status diubah dari \"" + oldStatus + "\" menjadi \"" + newStatus + "\" — oleh " + actorName);

        // Fetch full item for Teams
        List<Map<String, Object>> detail = jdbc.queryForList(
            "SELECT " + ITEM_FIELDS + ITEM_JOINS + "WHERE bi.id=?", id
        );
        if (!detail.isEmpty()) {
            teams.sendStatusChanged(detail.get(0), actorName, oldStatus, newStatus);
        }

        return ResponseEntity.ok(Map.of("id", id, "status", newStatus));
    }

    // ─── DELETE ────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal) {
        if (!canDeleteBacklog(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk menghapus backlog item"));
        }
        // Capture parent before delete so we can cascade SP after
        List<Map<String, Object>> beforeDel = jdbc.queryForList(
            "SELECT parent_id FROM backlog_items WHERE id = ?", id
        );
        if (beforeDel.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));
        Long delParentId = toLong(beforeDel.get(0).get("parent_id"));

        int deleted = jdbc.update("DELETE FROM backlog_items WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));

        // Cascade SP up after deletion
        recalcAncestorSp(delParentId);
        return ResponseEntity.ok(Map.of("message", "Item dihapus"));
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private void logActivity(Long itemId, Map<String, Object> actor, String content) {
        try {
            Long userId = actor != null ? toLong(actor.get("id")) : null;
            jdbc.update(
                "INSERT INTO item_activities (backlog_item_id, user_id, type, content) VALUES (?,?,?,?)",
                itemId, userId, "change_log", content
            );
        } catch (Exception ignored) {}
    }

    private void createNotification(Long userId, String type, String title, String message, String link) {
        try {
            jdbc.update(
                "INSERT INTO notifications (user_id, type, title, message, link) VALUES (?,?,?,?,?)",
                userId, type, title, message, link
            );
        } catch (Exception ignored) {}
    }

    private List<String> buildChanges(Map<String, Object> prev, Map<String, Object> body,
                                       Map<String, Object> after) {
        List<String> changes = new ArrayList<>();
        checkChange(changes, "Status", str(prev.get("status")), str(body.get("status")));
        checkChange(changes, "Prioritas", str(prev.get("priority")), str(body.get("priority")));
        checkChange(changes, "Assignee",
            str(prev.get("assignee_name")),
            str(after.get("assignee_name")));
        checkChange(changes, "Sprint",
            str(prev.get("sprint_name")),
            str(after.get("sprint_name")));
        checkChange(changes, "Story Points",
            str(prev.get("story_points")), str(body.get("story_points")));
        return changes;
    }

    private void checkChange(List<String> changes, String field, String oldVal, String newVal) {
        String o = oldVal == null ? "" : oldVal.trim();
        String n = newVal == null ? "" : newVal.trim();
        if (!o.equals(n)) {
            changes.add(field + ": \"" + o + "\" → \"" + n + "\"");
        }
    }

    private ResponseEntity<?> validateTaskParent(String type, Long parentId) {
        if (!"task".equals(type)) return null;
        if (parentId == null) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Task harus memiliki 1 user story sebagai parent"));
        }
        List<Map<String, Object>> parentRows = jdbc.queryForList(
            "SELECT type FROM backlog_items WHERE id=?", parentId
        );
        if (parentRows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Parent item tidak ditemukan"));
        }
        if (!"story".equals(parentRows.get(0).get("type"))) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Parent dari task harus bertipe user story"));
        }
        return null;
    }

    private String buildInFilter(String column, String csvValue, List<Object> params) {
        String[] values = csvValue.split(",");
        List<String> placeholders = new ArrayList<>();
        for (String v : values) { placeholders.add("?"); params.add(v.trim()); }
        return column + " IN (" + String.join(",", placeholders) + ")";
    }

    /**
     * Recalculates story_points for the given item as SUM(direct children SP),
     * then cascades up to the grandparent (Story → Epic chain).
     */
    private void recalcAncestorSp(Long parentId) {
        if (parentId == null) return;
        try {
            Long sumSp = jdbc.queryForObject(
                "SELECT COALESCE(SUM(story_points), 0) FROM backlog_items WHERE parent_id = ?",
                Long.class, parentId
            );
            jdbc.update("UPDATE backlog_items SET story_points = ? WHERE id = ?", sumSp, parentId);
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT parent_id FROM backlog_items WHERE id = ?", parentId
            );
            if (!rows.isEmpty() && rows.get(0).get("parent_id") != null) {
                recalcAncestorSp(toLong(rows.get(0).get("parent_id")));
            }
        } catch (Exception ignored) {}
    }

    private boolean isManagerOrAbove(Map<String, Object> user) {
        Object rn = user.get("role_name");
        return "super_admin".equals(rn) || "manager".equals(rn);
    }

    /** Create / edit backlog: managers, PO, developers by role, OR manage_backlog permission. */
    private boolean canWriteBacklog(Object principal) {
        String rn = PermissionHelper.getRoleName(principal);
        if ("super_admin".equals(rn) || "manager".equals(rn) || "po".equals(rn) || "developer".equals(rn) || "qa".equals(rn)) {
            return true;
        }
        return PermissionHelper.hasPermission(principal, "manage_backlog");
    }

    /** Delete backlog: only managers, PO and above by role, OR manage_backlog permission. */
    private boolean canDeleteBacklog(Object principal) {
        String rn = PermissionHelper.getRoleName(principal);
        if ("super_admin".equals(rn) || "manager".equals(rn) || "po".equals(rn)) {
            return true;
        }
        return PermissionHelper.hasPermission(principal, "manage_backlog");
    }

    private List<Long> getAssignedProductIds(Long userId) {
        return jdbc.queryForList(
            "SELECT product_id FROM user_products WHERE user_id = ?", userId
        ).stream().map(r -> ((Number) r.get("product_id")).longValue()).collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
    }

    private Object orDefault(Object v, Object d) { return v != null ? v : d; }
    private String str(Object v) { return v == null ? "" : v.toString(); }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }

    private java.sql.Date toSqlDate(Object v) {
        if (v == null) return null;
        if (v instanceof String) {
            String s = (String) v;
            if (s.isBlank()) return null;
            try { return java.sql.Date.valueOf(s.length() > 10 ? s.substring(0, 10) : s); }
            catch (Exception e) { return null; }
        }
        return null;
    }
}
