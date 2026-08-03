package com.producttracker.controller;

import com.producttracker.config.DepartmentHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
public class LeaderTaskController {

    @Autowired
    private JdbcTemplate jdbc;

    private static final String TASK_FIELDS =
        "lt.id, lt.code, lt.title, lt.department, lt.priority, lt.status, lt.notes, lt.deadline, " +
        "lt.parent_id, lt.assignee_id, lt.source_note_id, lt.created_by, lt.created_at, lt.updated_at, " +
        "u.name AS assignee_name, u.avatar_color AS assignee_color, " +
        "par.code AS parent_code, par.title AS parent_title, " +
        "ln.note_date AS source_note_date, ln.goals_this_week AS source_note_goals, nu.name AS source_note_author, " +
        "CASE WHEN lt.deadline < NOW() AND lt.status NOT IN ('done') THEN true ELSE false END AS is_delayed ";

    private static final String TASK_JOINS =
        "FROM leader_tasks lt " +
        "LEFT JOIN users u          ON u.id   = lt.assignee_id " +
        "LEFT JOIN leader_tasks par ON par.id = lt.parent_id " +
        "LEFT JOIN leader_notes ln  ON ln.id  = lt.source_note_id " +
        "LEFT JOIN users nu         ON nu.id  = ln.user_id ";

    // ─── LIST ──────────────────────────────────────────────────────────────

    @GetMapping("/api/leader-tasks")
    public ResponseEntity<?> list(
            @AuthenticationPrincipal Object principal,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Long assignee_id,
            @RequestParam(required = false) Long parent_id,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "false") boolean hide_done) {

        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();

        List<String> filters = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        // MyTask bypass: a user always sees items assigned to them, regardless of department scope.
        boolean isMyTasksQuery = assignee_id != null && assignee_id.equals(toLong(actor.get("id")));

        List<String> visible = DepartmentHelper.visibleDepartments(principal);
        if (visible != null && !isMyTasksQuery) {
            if (visible.isEmpty()) {
                return ResponseEntity.ok(Map.of("items", List.of(), "total", 0, "page", page, "limit", limit));
            }
            filters.add("lt.department = ?");
            params.add(visible.get(0));
        } else if (department != null && !department.isBlank()) {
            filters.add(buildInFilter("lt.department", department, params));
        }

        if (hide_done && status == null) { filters.add("lt.status != 'done'"); }
        if (status != null)      { filters.add(buildInFilter("lt.status", status, params)); }
        if (priority != null)    { filters.add(buildInFilter("lt.priority", priority, params)); }
        if (assignee_id != null) { filters.add("lt.assignee_id = ?"); params.add(assignee_id); }
        if (parent_id != null)   { filters.add("lt.parent_id = ?"); params.add(parent_id); }
        if (search != null && !search.isBlank()) {
            filters.add("(lt.title ILIKE ? OR lt.code ILIKE ?)");
            params.add("%" + search + "%");
            params.add("%" + search + "%");
        }

        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";
        int offset = (page - 1) * limit;

        try {
            Long total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM leader_tasks lt " + where, Long.class, params.toArray()
            );

            List<Object> pageParams = new ArrayList<>(params);
            pageParams.add(limit);
            pageParams.add(offset);

            List<Map<String, Object>> items = jdbc.queryForList(
                "SELECT " + TASK_FIELDS + TASK_JOINS + where +
                "ORDER BY " +
                "  CASE lt.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, " +
                "  lt.created_at DESC " +
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

    @GetMapping("/api/leader-tasks/{id}")
    public ResponseEntity<?> get(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " + TASK_FIELDS + TASK_JOINS + "WHERE lt.id=?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Task tidak ditemukan"));
        Map<String, Object> task = rows.get(0);

        List<String> visible = DepartmentHelper.visibleDepartments(principal);
        boolean isAssignee = Objects.equals(toLong(task.get("assignee_id")), toLong(actor.get("id")));
        if (visible != null && !isAssignee && !visible.contains(task.get("department"))) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke departemen ini"));
        }

        return ResponseEntity.ok(task);
    }

    // ─── CREATE ────────────────────────────────────────────────────────────

    @PostMapping("/api/leader-tasks")
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!DepartmentHelper.canWrite(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk menambah Leader Task"));
        }

        String department = (String) body.get("department");
        if (!DepartmentHelper.isValidDepartment(department)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Departemen tidak valid"));
        }
        if (body.get("title") == null || body.get("title").toString().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Judul wajib diisi"));
        }

        String code = (String) body.get("code");
        if (code == null || code.isBlank()) code = generateCode(department);

        String actorName = str(actor.get("name"));

        try {
            Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO leader_tasks (code, title, department, priority, status, assignee_id, parent_id, notes, deadline, created_by) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id",
                code, body.get("title"), department,
                orDefault(body.get("priority"), "medium"),
                orDefault(body.get("status"), "backlog"),
                toLong(body.get("assignee_id")), toLong(body.get("parent_id")),
                body.get("notes"), toSqlDate(body.get("deadline")),
                toLong(actor.get("id"))
            );
            Long newId = toLong(created.get("id"));

            logActivity(newId, "Task dibuat oleh " + actorName);

            Long assigneeId = toLong(body.get("assignee_id"));
            if (assigneeId != null && !assigneeId.equals(toLong(actor.get("id")))) {
                createNotification(assigneeId, "assignment",
                    "Kamu di-assign ke " + code,
                    "Leader Task \"" + body.get("title") + "\" telah di-assign kepadamu oleh " + actorName,
                    "/c-level?tab=tasks&task=" + newId);
            }

            List<Map<String, Object>> detail = jdbc.queryForList(
                "SELECT " + TASK_FIELDS + TASK_JOINS + "WHERE lt.id=?", newId
            );
            return ResponseEntity.status(201).body(detail.get(0));
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                return ResponseEntity.status(409).body(Map.of("error", "Kode task sudah ada"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    // ─── UPDATE ────────────────────────────────────────────────────────────

    @PutMapping("/api/leader-tasks/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!DepartmentHelper.canWrite(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk mengubah Leader Task"));
        }

        List<Map<String, Object>> before = jdbc.queryForList(
            "SELECT " + TASK_FIELDS + TASK_JOINS + "WHERE lt.id=?", id
        );
        if (before.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Task tidak ditemukan"));
        Map<String, Object> prev = before.get(0);

        String department = body.get("department") != null ? (String) body.get("department") : str(prev.get("department"));
        if (!DepartmentHelper.isValidDepartment(department)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Departemen tidak valid"));
        }

        String actorName = str(actor.get("name"));

        jdbc.update(
            "UPDATE leader_tasks SET title=?, department=?, priority=?, status=?, assignee_id=?, parent_id=?, notes=?, deadline=? WHERE id=?",
            orDefault(body.get("title"), prev.get("title")), department,
            orDefault(body.get("priority"), prev.get("priority")),
            orDefault(body.get("status"), prev.get("status")),
            toLong(body.get("assignee_id")), toLong(body.get("parent_id")),
            body.get("notes"), toSqlDate(body.get("deadline")),
            id
        );

        List<Map<String, Object>> detail = jdbc.queryForList(
            "SELECT " + TASK_FIELDS + TASK_JOINS + "WHERE lt.id=?", id
        );
        Map<String, Object> task = detail.get(0);

        List<String> changes = new ArrayList<>();
        checkChange(changes, "Status", str(prev.get("status")), str(task.get("status")));
        checkChange(changes, "Prioritas", str(prev.get("priority")), str(task.get("priority")));
        checkChange(changes, "Assignee", str(prev.get("assignee_name")), str(task.get("assignee_name")));
        logActivity(id, (changes.isEmpty() ? "Task diperbarui" : String.join("; ", changes)) + " — oleh " + actorName);

        Long newAssigneeId = toLong(body.get("assignee_id"));
        Long prevAssigneeId = toLong(prev.get("assignee_id"));
        Long actorId = toLong(actor.get("id"));
        if (newAssigneeId != null && !newAssigneeId.equals(prevAssigneeId) && !newAssigneeId.equals(actorId)) {
            createNotification(newAssigneeId, "assignment",
                "Kamu di-assign ke " + str(task.get("code")),
                "Leader Task \"" + task.get("title") + "\" telah di-assign kepadamu oleh " + actorName,
                "/c-level?tab=tasks&task=" + id);
        }

        return ResponseEntity.ok(task);
    }

    // ─── PATCH STATUS ──────────────────────────────────────────────────────

    @PatchMapping("/api/leader-tasks/{id}/status")
    public ResponseEntity<?> patchStatus(@PathVariable Long id,
                                          @AuthenticationPrincipal Object principal,
                                          @RequestBody Map<String, Object> body) {
        if (body.get("status") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Status wajib"));
        }
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT status, code, assignee_id FROM leader_tasks WHERE id=?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Task tidak ditemukan"));

        boolean isAssignee = Objects.equals(toLong(rows.get(0).get("assignee_id")), toLong(actor.get("id")));
        if (!DepartmentHelper.canWrite(principal) && !isAssignee) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk mengubah status task"));
        }

        String oldStatus = str(rows.get(0).get("status"));
        String newStatus = (String) body.get("status");

        int updated = jdbc.update("UPDATE leader_tasks SET status=? WHERE id=?", newStatus, id);
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Task tidak ditemukan"));

        logActivity(id, "Status diubah dari \"" + oldStatus + "\" menjadi \"" + newStatus + "\" — oleh " + str(actor.get("name")));
        return ResponseEntity.ok(Map.of("id", id, "status", newStatus));
    }

    // ─── DELETE ────────────────────────────────────────────────────────────

    @DeleteMapping("/api/leader-tasks/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!DepartmentHelper.canWrite(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk menghapus Leader Task"));
        }
        int deleted = jdbc.update("DELETE FROM leader_tasks WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Task tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Task dihapus"));
    }

    // ─── ACTIVITIES / COMMENTS ─────────────────────────────────────────────

    @GetMapping("/api/leader-tasks/{id}/activities")
    public ResponseEntity<?> listActivities(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT a.id, a.type, a.content, a.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_avatar_color " +
            "FROM leader_task_activities a " +
            "LEFT JOIN users u ON u.id = a.user_id " +
            "WHERE a.leader_task_id = ? ORDER BY a.created_at ASC",
            id
        );
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/api/leader-tasks/{id}/activities")
    public ResponseEntity<?> addComment(@PathVariable Long id,
                                         @AuthenticationPrincipal Object principal,
                                         @RequestBody Map<String, Object> body) {
        String content = (String) body.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Komentar tidak boleh kosong"));
        }
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();

        List<Map<String, Object>> exists = jdbc.queryForList("SELECT id FROM leader_tasks WHERE id = ?", id);
        if (exists.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Task tidak ditemukan"));

        Map<String, Object> row = jdbc.queryForMap(
            "INSERT INTO leader_task_activities (leader_task_id, user_id, type, content) " +
            "VALUES (?,?,'comment',?) RETURNING id",
            id, toLong(actor.get("id")), content.trim()
        );
        List<Map<String, Object>> full = jdbc.queryForList(
            "SELECT a.id, a.type, a.content, a.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_avatar_color " +
            "FROM leader_task_activities a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?",
            row.get("id")
        );
        return ResponseEntity.status(201).body(full.get(0));
    }

    @DeleteMapping("/api/leader-task-activities/{id}")
    public ResponseEntity<?> deleteActivity(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id, type FROM leader_task_activities WHERE id = ?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Aktivitas tidak ditemukan"));
        if ("change_log".equals(rows.get(0).get("type"))) {
            return ResponseEntity.status(403).body(Map.of("error", "Log perubahan tidak dapat dihapus"));
        }
        boolean isOwner = Objects.equals(toLong(rows.get(0).get("user_id")), toLong(actor.get("id")));
        if (!isOwner && !"super_admin".equals(actor.get("role_name"))) {
            return ResponseEntity.status(403).body(Map.of("error", "Hanya bisa menghapus komentar sendiri"));
        }
        jdbc.update("DELETE FROM leader_task_activities WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Komentar dihapus"));
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private String generateCode(String department) {
        String prefix = DepartmentHelper.codePrefix(department);
        List<Map<String, Object>> lastRows = jdbc.queryForList(
            "SELECT code FROM leader_tasks WHERE code LIKE ? ORDER BY code DESC LIMIT 1", prefix + "-%"
        );
        int lastNum = 0;
        if (!lastRows.isEmpty()) {
            Matcher m = Pattern.compile("\\d+$").matcher((String) lastRows.get(0).get("code"));
            if (m.find()) lastNum = Integer.parseInt(m.group());
        }
        return prefix + "-" + String.format("%03d", lastNum + 1);
    }

    private void logActivity(Long taskId, String content) {
        try {
            jdbc.update(
                "INSERT INTO leader_task_activities (leader_task_id, type, content) VALUES (?, 'change_log', ?)",
                taskId, content
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

    private void checkChange(List<String> changes, String field, String oldVal, String newVal) {
        String o = oldVal == null ? "" : oldVal.trim();
        String n = newVal == null ? "" : newVal.trim();
        if (!o.equals(n)) changes.add(field + ": \"" + o + "\" → \"" + n + "\"");
    }

    private String buildInFilter(String column, String csvValue, List<Object> params) {
        String[] values = csvValue.split(",");
        List<String> placeholders = new ArrayList<>();
        for (String v : values) { placeholders.add("?"); params.add(v.trim()); }
        return column + " IN (" + String.join(",", placeholders) + ")";
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
