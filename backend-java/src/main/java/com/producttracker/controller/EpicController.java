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
@RequestMapping("/api/epics")
public class EpicController {

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
            filters.add("e.product_id IN (" + ph + ")");
            paramList.addAll(assignedIds);
        }
        if (product_id != null) { filters.add("e.product_id = ?"); paramList.add(product_id); }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";
        Object[] params = paramList.toArray();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT e.*, u.name AS created_by_name, " +
            "  COUNT(bi.id) AS item_count, " +
            "  COALESCE(SUM(bi.story_points), 0) AS total_points, " +
            "  COALESCE(SUM(CASE WHEN bi.status='done' THEN bi.story_points ELSE 0 END), 0) AS done_points " +
            "FROM epics e " +
            "LEFT JOIN users u ON u.id = e.created_by " +
            "LEFT JOIN backlog_items bi ON bi.epic_id = e.id " +
            where +
            "GROUP BY e.id, u.name " +
            "ORDER BY e.product_id, e.code",
            params);
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        if (body.get("product_id") == null || body.get("code") == null || body.get("name") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id, code, name wajib"));
        }
        Map<String, Object> user = toMap(principal);
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO epics (product_id, code, name, description, status, priority, created_by) " +
                "VALUES (?,?,?,?,?,?,?) RETURNING *",
                toLong(body.get("product_id")), body.get("code"), body.get("name"),
                body.get("description"),
                orDefault(body.get("status"), "open"),
                orDefault(body.get("priority"), "medium"),
                user != null ? user.get("id") : null
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                return ResponseEntity.status(409).body(Map.of("error", "Kode epic sudah ada di produk ini"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        int updated = jdbc.update(
            "UPDATE epics SET name=?, description=?, status=?, priority=? WHERE id=?",
            body.get("name"), body.get("description"), body.get("status"), body.get("priority"), id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Epic tidak ditemukan"));
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM epics WHERE id=?", id);
        return ResponseEntity.ok(row);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        int deleted = jdbc.update("DELETE FROM epics WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Epic tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Epic dihapus"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
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

    private Object orDefault(Object v, Object d) {
        return v != null ? v : d;
    }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }
}
