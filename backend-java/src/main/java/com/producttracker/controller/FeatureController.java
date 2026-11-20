package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.producttracker.service.FeatureRoadmapSync;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.stream.Collectors;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/features")
public class FeatureController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private TransactionTemplate tx;

    @Autowired
    private FeatureRoadmapSync sync;

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
        // No Backlog figures here: a Feature's progress is set by hand through its status (FeatureRoadmapSync).
        // (The old item_count / points columns joined backlog_items.feature_id to features.id, but that column points
        // at product_roadmap since migration_v7, so they were never right.)
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT f.*, u.name AS owner_name, e.name AS epic_name, rm.status AS roadmap_status " +
            "FROM features f " +
            "LEFT JOIN users u  ON u.id  = f.owner_id " +
            "LEFT JOIN epics e  ON e.id  = f.epic_id " +
            "LEFT JOIN product_roadmap rm ON rm.source_feature_id = f.id " +
            where +
            "ORDER BY f.product_id, f.code",
            params);
        for (Map<String, Object> r : rows) r.put("progress", FeatureRoadmapSync.featureProgress(r.get("status"), r.get("roadmap_status")));
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal, @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "features", "create")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menambah feature"));
        }
        if (body.get("product_id") == null || body.get("name") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id dan name wajib"));
        }
        java.sql.Date targetDate;
        try { targetDate = toSqlDate(body.get("target_date")); }
        catch (IllegalArgumentException e) { return invalidTargetDate(); }
        // A blank code is generated ({product code}FT-{n}); a typed one is used as is.
        boolean autoCode = body.get("code") == null || body.get("code").toString().isBlank();
        Long productId = toLong(body.get("product_id"));
        for (int attempt = 0; ; attempt++) {
            try {
                String code = autoCode ? sync.nextFeatureCode(productId) : body.get("code").toString().trim();
                // Every Feature has a roadmap row (Feature is the master), created in the same transaction.
                Map<String, Object> row = tx.execute(st -> {
                    Map<String, Object> created = jdbc.queryForMap(
                        "INSERT INTO features (product_id, epic_id, code, name, owner_id, status, priority, target_release, is_roadmap_item, target_date) " +
                        "VALUES (?,?,?,?,?,?,?,?,TRUE,?) RETURNING *",
                        productId,
                        toLong(body.get("epic_id")),
                        code,
                        body.get("name"),
                        toLong(body.get("owner_id")),
                        orDefault(body.get("status"), "not_started"),
                        orDefault(body.get("priority"), "medium"),
                        body.get("target_release"),
                        targetDate
                    );
                    sync.syncRoadmap(created, true);
                    return created;
                });
                return ResponseEntity.status(201).body(row);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                    if (autoCode && attempt < 2) continue;   // two creates took the same generated number: take the next one
                    return ResponseEntity.status(409).body(Map.of("error", "Kode feature sudah ada di produk ini"));
                }
                return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
            }
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "features", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk mengubah feature"));
        }
        // target_date (the Management Dashboard's "Target") is only touched when the body carries it, so a caller
        // that does not know the field (an old browser tab still on the previous frontend) keeps the stored date.
        boolean targetSent = body.containsKey("target_date");
        java.sql.Date targetDate;
        try { targetDate = toSqlDate(body.get("target_date")); }
        catch (IllegalArgumentException e) { return invalidTargetDate(); }
        List<Map<String, Object>> before = jdbc.queryForList("SELECT target_date FROM features WHERE id=?", id);
        if (before.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Feature tidak ditemukan"));
        // The roadmap month only follows the Feature when this save actually changed the date (see FeatureRoadmapSync).
        boolean dateChanged = targetSent && !java.util.Objects.equals(before.get(0).get("target_date"), targetDate);
        // is_roadmap_item is always TRUE now: every Feature has a roadmap row, so the old "show on roadmap" flag from a
        // stale browser tab is ignored (unchecking it used to delete the roadmap row and the Backlog links on it).
        Map<String, Object> row = tx.execute(st -> {
            jdbc.update(
                "UPDATE features SET name=?, epic_id=?, owner_id=?, status=?, priority=?, target_release=?, is_roadmap_item=TRUE, " +
                "target_date = CASE WHEN ?::boolean THEN ?::date ELSE target_date END WHERE id=?",
                body.get("name"), toLong(body.get("epic_id")), toLong(body.get("owner_id")),
                body.get("status"), body.get("priority"), body.get("target_release"),
                targetSent, targetDate, id
            );
            Map<String, Object> updated = jdbc.queryForMap("SELECT * FROM features WHERE id=?", id);
            sync.syncRoadmap(updated, dateChanged);
            return updated;
        });
        return ResponseEntity.ok(row);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "features", "delete")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menghapus feature"));
        }
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

    /** Optional date from the form's date input ("yyyy-MM-dd"); blank = none; anything else is rejected (400). */
    private java.sql.Date toSqlDate(Object v) {
        if (v == null) return null;
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        return java.sql.Date.valueOf(s.length() > 10 ? s.substring(0, 10) : s);
    }

    private ResponseEntity<?> invalidTargetDate() {
        return ResponseEntity.badRequest().body(Map.of("error", "Format Target tidak valid (YYYY-MM-DD)"));
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
