package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    @Autowired
    private JdbcTemplate jdbc;

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal) {
        Map<String, Object> user = toMap(principal);
        String baseQuery =
            "SELECT p.*, u.name AS owner_name, " +
            "  (SELECT COUNT(*) FROM backlog_items bi WHERE bi.product_id = p.id)                        AS total_items, " +
            "  (SELECT COUNT(*) FROM backlog_items bi WHERE bi.product_id = p.id AND bi.status = 'done') AS done_items, " +
            "  (SELECT COUNT(*) FROM sprints s WHERE s.product_id = p.id AND s.status = 'active')       AS active_sprints " +
            "FROM products p " +
            "LEFT JOIN users u ON u.id = p.owner_id ";

        List<Map<String, Object>> rows;
        if (user == null || isManagerOrAbove(user)) {
            rows = jdbc.queryForList(baseQuery + "ORDER BY p.id");
        } else {
            List<Long> ids = getAssignedProductIds(toLong(user.get("id")));
            if (ids.isEmpty()) return ResponseEntity.ok(List.of());
            String placeholders = ids.stream().map(x -> "?").collect(Collectors.joining(","));
            rows = jdbc.queryForList(
                baseQuery + "WHERE p.id IN (" + placeholders + ") ORDER BY p.id",
                ids.toArray()
            );
        }
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal, @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "products", "create")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menambah produk"));
        }
        String code = (String) body.get("code");
        String name = (String) body.get("name");
        if (code == null || name == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Code dan name wajib diisi"));
        }
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO products (code, name, description, status, owner_id, repository_url, color) " +
                "VALUES (?,?,?,?,?,?,?) RETURNING *",
                code.toUpperCase(),
                name,
                body.get("description"),
                orDefault(body.get("status"), "active"),
                toLong(body.get("owner_id")),
                body.get("repository_url"),
                orDefault(body.get("color"), "#4F46E5")
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                return ResponseEntity.status(409).body(Map.of("error", "Kode produk sudah digunakan"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.*, u.name AS owner_name FROM products p LEFT JOIN users u ON u.id = p.owner_id WHERE p.id = ?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Produk tidak ditemukan"));
        return ResponseEntity.ok(rows.get(0));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "products", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk mengubah produk"));
        }
        try {
            int updated = jdbc.update(
                "UPDATE products SET name=?, description=?, status=?, owner_id=?, repository_url=?, color=? WHERE id=?",
                body.get("name"), body.get("description"), body.get("status"),
                toLong(body.get("owner_id")), body.get("repository_url"), body.get("color"), id
            );
            if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Produk tidak ditemukan"));
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.*, u.name AS owner_name FROM products p LEFT JOIN users u ON u.id = p.owner_id WHERE p.id = ?", id
            );
            return ResponseEntity.ok(rows.get(0));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "products", "delete")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menghapus produk"));
        }
        int deleted = jdbc.update("DELETE FROM products WHERE id = ?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Produk tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Produk dihapus"));
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

    private Object orDefault(Object value, Object defaultValue) {
        return value != null ? value : defaultValue;
    }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
    }
}
