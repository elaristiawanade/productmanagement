package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import com.producttracker.service.FeatureRoadmapSync;
import org.springframework.transaction.support.TransactionTemplate;
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

    @Autowired
    private TransactionTemplate tx;

    @Autowired
    private FeatureRoadmapSync sync;

    // ─── LIST ─────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> list(
            @AuthenticationPrincipal Object principal,
            @RequestParam(required = false) Long product_id,
            @RequestParam(required = false) String status) {

        StringBuilder sql = new StringBuilder(
            "SELECT r.*, p.name AS product_name, p.code AS product_code, p.color AS product_color, " +
            "       u.name AS created_by_name, ft.code AS feature_code, ft.status AS feature_status " +
            "FROM product_roadmap r " +
            "JOIN products p ON p.id = r.product_id " +
            "LEFT JOIN users u ON u.id = r.created_by " +
            "LEFT JOIN features ft ON ft.id = r.source_feature_id " +
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
        // Progress comes from the status (set through the Feature), never from the Backlog; see FeatureRoadmapSync.
        for (Map<String, Object> r : rows) r.put("progress", FeatureRoadmapSync.pctOf(r.get("status")));
        return ResponseEntity.ok(rows);
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!PermissionHelper.can(principal, "roadmap", "create")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses"));
        }
        if (body.get("product_id") == null || body.get("feature_name") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id dan feature_name wajib"));
        }
        Long actorId = toLong(actor.get("id"));
        Long productId = toLong(body.get("product_id"));
        String status = orDefault(body.get("status"), "planned").toString();
        Object version = body.get("product_version");
        for (int attempt = 0; ; attempt++) {
            try {
                // A roadmap item always has a Feature behind it (Feature is the master): create both in one transaction.
                Map<String, Object> row = tx.execute(st -> {
                    Map<String, Object> feature = sync.createFeatureForRoadmap(
                        productId, body.get("feature_name").toString(), status, version == null ? null : version.toString());
                    Map<String, Object> created = jdbc.queryForMap(
                        "INSERT INTO product_roadmap " +
                        "  (product_id, feature_name, description, status, product_version, sort_order, created_by, month_release_target, source_feature_id) " +
                        "VALUES (?,?,?,?,?,?,?,?,?) RETURNING *",
                        productId,
                        body.get("feature_name"),
                        body.get("description"),
                        status,
                        version,
                        body.get("sort_order") != null ? toLong(body.get("sort_order")) : 0L,
                        actorId,
                        toSqlDate(body.get("month_release_target")),
                        feature.get("id")
                    );
                    created.put("feature_code", feature.get("code"));
                    return created;
                });
                return ResponseEntity.status(201).body(row);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                if (attempt < 2 && (msg.contains("duplicate key") || msg.contains("violates unique constraint"))) continue;   // generated code taken by a parallel create
                return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
            }
        }
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!PermissionHelper.can(principal, "roadmap", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses"));
        }
        List<Map<String, Object>> cur = jdbc.queryForList(
            "SELECT source_feature_id, description, sort_order FROM product_roadmap WHERE id=?", id);
        if (cur.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));
        if (cur.get(0).get("source_feature_id") != null) {
            // Linked to a Feature: name, status, version and month belong to the Feature, so whatever the request
            // carries for them is ignored here (not just locked in the form). Only the roadmap-only fields change.
            jdbc.update("UPDATE product_roadmap SET description=?, sort_order=? WHERE id=?",
                body.containsKey("description") ? body.get("description") : cur.get(0).get("description"),
                body.get("sort_order") != null ? toLong(body.get("sort_order")) : cur.get(0).get("sort_order"),
                id);
        } else {
            jdbc.update(
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
        }
        Map<String, Object> row = jdbc.queryForMap(
            "SELECT r.*, ft.code AS feature_code FROM product_roadmap r " +
            "LEFT JOIN features ft ON ft.id = r.source_feature_id WHERE r.id=?", id);
        return ResponseEntity.ok(row);
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!PermissionHelper.can(principal, "roadmap", "delete")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses"));
        }
        // A linked row is the Feature's roadmap entry: deleting only the row would leave a Feature with none, so the
        // Feature has to be deleted instead (which removes this row with it).
        List<String> linked = jdbc.queryForList(
            "SELECT ft.code FROM product_roadmap r JOIN features ft ON ft.id = r.source_feature_id WHERE r.id=?", String.class, id);
        if (!linked.isEmpty()) {
            return ResponseEntity.status(409).body(Map.of("error",
                "Item roadmap ini terhubung ke Feature " + linked.get(0) + ". Hapus lewat tab Produk & Features."));
        }
        int deleted = jdbc.update("DELETE FROM product_roadmap WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Item dihapus"));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

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
