package com.producttracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/roadmap")
public class RoadmapController {

    @Autowired
    private JdbcTemplate jdbc;

    // ─── LIST ─────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> list(
            @AuthenticationPrincipal Object principal,
            @RequestParam(required = false) Long product_id,
            @RequestParam(required = false) String status) {

        StringBuilder sql = new StringBuilder(
            "SELECT r.*, p.name AS product_name, p.code AS product_code, p.color AS product_color, " +
            "       u.name AS created_by_name " +
            "FROM product_roadmap r " +
            "JOIN products p ON p.id = r.product_id " +
            "LEFT JOIN users u ON u.id = r.created_by " +
            "WHERE 1=1 ");
        java.util.List<Object> params = new java.util.ArrayList<>();

        if (product_id != null) {
            sql.append(" AND r.product_id = ?");
            params.add(product_id);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND r.status = ?");
            params.add(status);
        }
        sql.append(" ORDER BY r.product_id, r.sort_order, r.id");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), params.toArray());
        return ResponseEntity.ok(rows);
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!isPoOrAbove(actor)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses"));
        }
        if (body.get("product_id") == null || body.get("feature_name") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id dan feature_name wajib"));
        }
        Long actorId = toLong(actor.get("id"));
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO product_roadmap " +
                "  (product_id, feature_name, description, status, product_version, sort_order, created_by, month_release_target) " +
                "VALUES (?,?,?,?,?,?,?,?) RETURNING *",
                toLong(body.get("product_id")),
                body.get("feature_name"),
                body.get("description"),
                orDefault(body.get("status"), "planned"),
                body.get("product_version"),
                body.get("sort_order") != null ? toLong(body.get("sort_order")) : 0L,
                actorId,
                toSqlDate(body.get("month_release_target"))
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!isPoOrAbove(actor)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses"));
        }
        int updated = jdbc.update(
            "UPDATE product_roadmap " +
            "SET feature_name=?, description=?, status=?, product_version=?, sort_order=?, month_release_target=? " +
            "WHERE id=?",
            body.get("feature_name"),
            body.get("description"),
            body.get("status"),
            body.get("product_version"),
            body.get("sort_order") != null ? toLong(body.get("sort_order")) : 0L,
            toSqlDate(body.get("month_release_target")),
            id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM product_roadmap WHERE id=?", id);
        return ResponseEntity.ok(row);
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!isManagerOrAbove(actor)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses"));
        }
        int deleted = jdbc.update("DELETE FROM product_roadmap WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Item dihapus"));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private boolean isManagerOrAbove(Map<String, Object> user) {
        Object rn = user.get("role_name");
        return "super_admin".equals(rn) || "manager".equals(rn);
    }

    private boolean isPoOrAbove(Map<String, Object> user) {
        Object rn = user.get("role_name");
        return "super_admin".equals(rn) || "manager".equals(rn) || "po".equals(rn);
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

    private Object orDefault(Object value, Object defaultValue) {
        return value != null ? value : defaultValue;
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
