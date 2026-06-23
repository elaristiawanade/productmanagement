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
@RequestMapping("/api/features")
public class FeatureController {

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
            filters.add("f.product_id IN (" + ph + ")");
            paramList.addAll(assignedIds);
        }
        if (product_id != null) { filters.add("f.product_id = ?"); paramList.add(product_id); }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";
        Object[] params = paramList.toArray();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT f.*, u.name AS owner_name, e.name AS epic_name, " +
            "  COUNT(bi.id) AS item_count, " +
            "  COALESCE(SUM(bi.story_points), 0) AS total_points, " +
            "  COALESCE(SUM(CASE WHEN bi.status='done' THEN bi.story_points ELSE 0 END), 0) AS done_points " +
            "FROM features f " +
            "LEFT JOIN users u  ON u.id  = f.owner_id " +
            "LEFT JOIN epics e  ON e.id  = f.epic_id " +
            "LEFT JOIN backlog_items bi ON bi.feature_id = f.id " +
            where +
            "GROUP BY f.id, u.name, e.name " +
            "ORDER BY f.product_id, f.code",
            params);
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        if (body.get("product_id") == null || body.get("code") == null || body.get("name") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id, code, name wajib"));
        }
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO features (product_id, epic_id, code, name, owner_id, status, priority, target_release) " +
                "VALUES (?,?,?,?,?,?,?,?) RETURNING *",
                toLong(body.get("product_id")),
                toLong(body.get("epic_id")),
                body.get("code"),
                body.get("name"),
                toLong(body.get("owner_id")),
                orDefault(body.get("status"), "not_started"),
                orDefault(body.get("priority"), "medium"),
                body.get("target_release")
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                return ResponseEntity.status(409).body(Map.of("error", "Kode feature sudah ada di produk ini"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        int updated = jdbc.update(
            "UPDATE features SET name=?, epic_id=?, owner_id=?, status=?, priority=?, target_release=? WHERE id=?",
            body.get("name"), toLong(body.get("epic_id")), toLong(body.get("owner_id")),
            body.get("status"), body.get("priority"), body.get("target_release"), id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Feature tidak ditemukan"));
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM features WHERE id=?", id);
        return ResponseEntity.ok(row);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        int deleted = jdbc.update("DELETE FROM features WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Feature tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Feature dihapus"));
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
}
