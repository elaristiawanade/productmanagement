package com.producttracker.controller;

import com.producttracker.config.DepartmentHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/leader-notes")
public class LeaderNotesController {

    @Autowired
    private JdbcTemplate jdbc;

    private static final String NOTE_FIELDS =
        "n.id, n.department, n.note_date, n.goals_this_week, n.created_at, n.updated_at, " +
        "u.id AS user_id, u.name AS user_name, u.avatar_color ";
    private static final String NOTE_JOINS =
        "FROM leader_notes n JOIN users u ON u.id = n.user_id ";

    // ─── LIST ─────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal,
                                   @RequestParam(required = false) String department,
                                   @RequestParam(required = false) Long user_id,
                                   @RequestParam(required = false) String date_from,
                                   @RequestParam(required = false) String date_to) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();

        List<String> visible = DepartmentHelper.visibleDepartments(principal);
        if (visible != null && visible.isEmpty()) return ResponseEntity.ok(List.of());

        List<String> filters = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (visible != null) {
            filters.add("n.department = ?");
            params.add(visible.get(0));
        } else if (department != null && !department.isBlank()) {
            filters.add("n.department = ?");
            params.add(department);
        }
        if (user_id != null) { filters.add("n.user_id = ?"); params.add(user_id); }
        if (date_from != null && !date_from.isBlank()) {
            filters.add("n.note_date >= ?"); params.add(java.sql.Date.valueOf(date_from));
        }
        if (date_to != null && !date_to.isBlank()) {
            filters.add("n.note_date <= ?"); params.add(java.sql.Date.valueOf(date_to));
        }

        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";
        List<Map<String, Object>> notes = jdbc.queryForList(
            "SELECT " + NOTE_FIELDS + NOTE_JOINS + where + "ORDER BY n.note_date DESC, n.created_at DESC LIMIT 200",
            params.toArray()
        );
        embedTasks(notes);
        return ResponseEntity.ok(notes);
    }

    // ─── TODAY (check if already submitted for a department) ──────────────

    @GetMapping("/today")
    public ResponseEntity<?> today(@AuthenticationPrincipal Object principal,
                                    @RequestParam String department) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        Long userId = toLong(actor.get("id"));

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " + NOTE_FIELDS + NOTE_JOINS +
            "WHERE n.user_id = ? AND n.department = ? AND n.note_date = ?",
            userId, department, java.sql.Date.valueOf(LocalDate.now())
        );
        if (rows.isEmpty()) return ResponseEntity.ok(Map.of("submitted", false));
        embedTasks(rows);
        return ResponseEntity.ok(Map.of("submitted", true, "note", rows.get(0)));
    }

    // ─── CREATE ───────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!DepartmentHelper.canWrite(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk membuat Leader Notes"));
        }

        String department = (String) body.get("department");
        if (!DepartmentHelper.isValidDepartment(department)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Departemen tidak valid"));
        }
        Object goals = body.get("goals_this_week");
        if (goals == null || goals.toString().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Goals of This Week wajib diisi"));
        }

        String dateStr = body.get("note_date") != null ? body.get("note_date").toString() : LocalDate.now().toString();
        java.sql.Date noteDate;
        try { noteDate = java.sql.Date.valueOf(dateStr.length() > 10 ? dateStr.substring(0, 10) : dateStr); }
        catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", "Format tanggal tidak valid")); }

        Long userId = toLong(actor.get("id"));

        try {
            Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO leader_notes (user_id, department, note_date, goals_this_week) " +
                "VALUES (?,?,?,?) RETURNING id",
                userId, department, noteDate, goals.toString()
            );
            Long noteId = toLong(created.get("id"));

            Object tasksObj = body.get("tasks");
            if (tasksObj instanceof List) {
                for (Object t : (List<Object>) tasksObj) {
                    String title = t == null ? "" : t.toString().trim();
                    if (title.isEmpty()) continue;
                    createLinkedTask(department, title, userId, noteId);
                }
            }

            List<Map<String, Object>> detail = jdbc.queryForList(
                "SELECT " + NOTE_FIELDS + NOTE_JOINS + "WHERE n.id = ?", noteId
            );
            embedTasks(detail);
            return ResponseEntity.status(201).body(detail.get(0));
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("unique")) {
                return ResponseEntity.status(409).body(Map.of("error", "Catatan untuk departemen dan tanggal ini sudah ada"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!DepartmentHelper.canWrite(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki izin untuk mengubah Leader Notes"));
        }

        String department = (String) body.get("department");
        if (!DepartmentHelper.isValidDepartment(department)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Departemen tidak valid"));
        }
        Object goals = body.get("goals_this_week");
        if (goals == null || goals.toString().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Goals of This Week wajib diisi"));
        }
        String dateStr = body.get("note_date") != null ? body.get("note_date").toString() : null;
        java.sql.Date noteDate = null;
        if (dateStr != null && !dateStr.isBlank()) {
            try { noteDate = java.sql.Date.valueOf(dateStr.length() > 10 ? dateStr.substring(0, 10) : dateStr); }
            catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", "Format tanggal tidak valid")); }
        }

        try {
            int updated;
            if (noteDate != null) {
                updated = jdbc.update(
                    "UPDATE leader_notes SET department=?, note_date=?, goals_this_week=? WHERE id=?",
                    department, noteDate, goals.toString(), id
                );
            } else {
                updated = jdbc.update(
                    "UPDATE leader_notes SET department=?, goals_this_week=? WHERE id=?",
                    department, goals.toString(), id
                );
            }
            if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Catatan tidak ditemukan"));
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("unique")) {
                return ResponseEntity.status(409).body(Map.of("error", "Catatan untuk departemen dan tanggal ini sudah ada"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }

        List<Map<String, Object>> detail = jdbc.queryForList(
            "SELECT " + NOTE_FIELDS + NOTE_JOINS + "WHERE n.id = ?", id
        );
        if (detail.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Catatan tidak ditemukan"));
        embedTasks(detail);
        return ResponseEntity.ok(detail.get(0));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /** Mirrors LeaderTaskController's code auto-generation (kept local to avoid a cross-controller call). */
    private void createLinkedTask(String department, String title, Long createdBy, Long sourceNoteId) {
        String prefix = DepartmentHelper.codePrefix(department);
        List<Map<String, Object>> lastRows = jdbc.queryForList(
            "SELECT code FROM leader_tasks WHERE code LIKE ? ORDER BY code DESC LIMIT 1", prefix + "-%"
        );
        int lastNum = 0;
        if (!lastRows.isEmpty()) {
            Matcher m = Pattern.compile("\\d+$").matcher((String) lastRows.get(0).get("code"));
            if (m.find()) lastNum = Integer.parseInt(m.group());
        }
        String code = prefix + "-" + String.format("%03d", lastNum + 1);
        jdbc.update(
            "INSERT INTO leader_tasks (code, title, department, status, source_note_id, created_by) " +
            "VALUES (?,?,?, 'todo', ?, ?)",
            code, title, department, sourceNoteId, createdBy
        );
    }

    private void embedTasks(List<Map<String, Object>> notes) {
        for (Map<String, Object> note : notes) {
            Long noteId = toLong(note.get("id"));
            List<Map<String, Object>> tasks = jdbc.queryForList(
                "SELECT id, code, title, status, priority FROM leader_tasks WHERE source_note_id = ? ORDER BY id",
                noteId
            );
            note.put("tasks", tasks);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
    }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }
}
