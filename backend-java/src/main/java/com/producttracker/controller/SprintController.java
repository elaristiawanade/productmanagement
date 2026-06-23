package com.producttracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.stream.Collectors;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sprints")
public class SprintController {

    @Autowired
    private JdbcTemplate jdbc;

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal,
                                  @RequestParam(required = false) Long product_id) {
        List<String> filters = new java.util.ArrayList<>();
        List<Object> paramList = new java.util.ArrayList<>();

        Map<String, Object> user = toMap(principal);
        if (user != null && !isManagerOrAbove(user)) {
            List<Long> assignedIds = getAssignedProductIds(toLong(user.get("id")));
            if (assignedIds.isEmpty()) return ResponseEntity.ok(List.of());
            String ph = assignedIds.stream().map(x -> "?").collect(Collectors.joining(","));
            filters.add("s.product_id IN (" + ph + ")");
            paramList.addAll(assignedIds);
        }
        if (product_id != null) { filters.add("s.product_id = ?"); paramList.add(product_id); }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";
        Object[] params = paramList.toArray();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT s.*, " +
            "  COUNT(bi.id)                                         AS total_items, " +
            "  COUNT(CASE WHEN bi.status = 'todo'        THEN 1 END) AS todo, " +
            "  COUNT(CASE WHEN bi.status = 'in_progress' THEN 1 END) AS in_progress, " +
            "  COUNT(CASE WHEN bi.status = 'done'        THEN 1 END) AS done, " +
            "  COUNT(CASE WHEN bi.status = 'blocked'     THEN 1 END) AS blocked " +
            "FROM sprints s " +
            "LEFT JOIN backlog_items bi ON bi.sprint_id = s.id " +
            where +
            "GROUP BY s.id " +
            "ORDER BY s.start_date NULLS LAST",
            params);
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        if (body.get("product_id") == null || body.get("name") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id dan name wajib"));
        }
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO sprints (product_id, name, goal, start_date, end_date, capacity) " +
                "VALUES (?,?,?,?,?,?) RETURNING *",
                toLong(body.get("product_id")),
                body.get("name"),
                body.get("goal"),
                toSqlDate(body.get("start_date")),
                toSqlDate(body.get("end_date")),
                orDefault(body.get("capacity"), 0)
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                return ResponseEntity.status(409).body(Map.of("error", "Nama sprint sudah ada di produk ini"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        List<Map<String, Object>> sprintRows = jdbc.queryForList("SELECT * FROM sprints WHERE id=?", id);
        if (sprintRows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Sprint tidak ditemukan"));

        List<Map<String, Object>> items = jdbc.queryForList(
            "SELECT bi.id, bi.code, bi.title, bi.type, bi.priority, bi.story_points, bi.status, " +
            "       u.name AS assignee_name, u.avatar_color AS assignee_color, " +
            "       f.name AS feature_name, e.name AS epic_name " +
            "FROM backlog_items bi " +
            "LEFT JOIN users u    ON u.id  = bi.assignee_id " +
            "LEFT JOIN features f ON f.id  = bi.feature_id " +
            "LEFT JOIN epics    e ON e.id  = bi.epic_id " +
            "WHERE bi.sprint_id = ? " +
            "ORDER BY CASE bi.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END",
            id);

        return ResponseEntity.ok(Map.of("sprint", sprintRows.get(0), "items", items));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        int updated = jdbc.update(
            "UPDATE sprints SET name=?,goal=?,start_date=?,end_date=?,capacity=?,committed_points=?,completed_points=?,status=? WHERE id=?",
            body.get("name"), body.get("goal"),
            toSqlDate(body.get("start_date")), toSqlDate(body.get("end_date")),
            orDefault(body.get("capacity"), 0),
            orDefault(body.get("committed_points"), 0),
            orDefault(body.get("completed_points"), 0),
            orDefault(body.get("status"), "planned"),
            id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Sprint tidak ditemukan"));
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM sprints WHERE id=?", id);
        return ResponseEntity.ok(row);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        int deleted = jdbc.update("DELETE FROM sprints WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Sprint tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Sprint dihapus"));
    }

    @GetMapping("/{id}/burndown")
    public ResponseEntity<?> getBurndown(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT day, ideal_remaining, actual_remaining FROM burndown_data WHERE sprint_id=? ORDER BY day", id
        );
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/{id}/burndown")
    public ResponseEntity<?> saveBurndown(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Object day = body.get("day");
        Object actualRemaining = body.get("actual_remaining");
        if (day == null || actualRemaining == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "day dan actual_remaining wajib"));
        }

        List<Map<String, Object>> sprintRows = jdbc.queryForList(
            "SELECT committed_points FROM sprints WHERE id=?", id
        );
        if (sprintRows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Sprint tidak ditemukan"));

        int committedPoints = toInt(sprintRows.get(0).get("committed_points"));
        int dayNum = toInt(day);
        double idealRemaining = Math.max(0, committedPoints - (committedPoints / 10.0) * dayNum);

        Map<String, Object> row = jdbc.queryForMap(
            "INSERT INTO burndown_data (sprint_id, day, ideal_remaining, actual_remaining) " +
            "VALUES (?,?,?,?) " +
            "ON CONFLICT (sprint_id, day) DO UPDATE SET actual_remaining=EXCLUDED.actual_remaining, ideal_remaining=EXCLUDED.ideal_remaining " +
            "RETURNING *",
            id, dayNum, idealRemaining, toInt(actualRemaining)
        );
        return ResponseEntity.ok(row);
    }

    private boolean isManagerOrAbove(Map<String, Object> user) {
        Object rn = user.get("role_name");
        return "super_admin".equals(rn) || "manager".equals(rn);
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

    private Object orDefault(Object v, Object d) {
        return v != null ? v : d;
    }

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

    private int toInt(Object v) {
        if (v == null) return 0;
        if (v instanceof Number) return ((Number) v).intValue();
        return Integer.parseInt(v.toString());
    }
}
