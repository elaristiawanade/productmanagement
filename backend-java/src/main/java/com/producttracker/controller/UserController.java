package com.producttracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @GetMapping("/roles")
    public ResponseEntity<?> roles() {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM roles ORDER BY id");
        return ResponseEntity.ok(rows);
    }

    @GetMapping
    public ResponseEntity<?> list() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT u.id, u.name, u.email, u.avatar_color, u.is_active, u.created_at, " +
            "       r.id AS role_id, r.name AS role_name, r.display_name AS role_display, " +
            "       COUNT(bi.id) AS assigned_items " +
            "FROM users u " +
            "LEFT JOIN roles r ON r.id = u.role_id " +
            "LEFT JOIN backlog_items bi ON bi.assignee_id = u.id AND bi.status NOT IN ('done','backlog') " +
            "GROUP BY u.id, r.id " +
            "ORDER BY u.name");

        // Embed each user's assigned products
        for (Map<String, Object> user : rows) {
            Long userId = toLong(user.get("id"));
            List<Map<String, Object>> products = jdbc.queryForList(
                "SELECT p.id, p.code, p.name, p.color FROM products p " +
                "JOIN user_products up ON up.product_id = p.id " +
                "WHERE up.user_id = ? ORDER BY p.name", userId
            );
            user.put("products", products);
        }
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/{id}/products")
    public ResponseEntity<?> getUserProducts(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.id, p.code, p.name, p.color FROM products p " +
            "JOIN user_products up ON up.product_id = p.id " +
            "WHERE up.user_id = ? ORDER BY p.name", id
        );
        return ResponseEntity.ok(rows);
    }

    @PutMapping("/{id}/products")
    public ResponseEntity<?> setUserProducts(@PathVariable Long id,
                                              @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Object> productIds = (List<Object>) body.get("product_ids");
        jdbc.update("DELETE FROM user_products WHERE user_id = ?", id);
        if (productIds != null) {
            for (Object pid : productIds) {
                Long productId = toLong(pid);
                if (productId != null) {
                    jdbc.update(
                        "INSERT INTO user_products (user_id, product_id) VALUES (?,?) ON CONFLICT DO NOTHING",
                        id, productId
                    );
                }
            }
        }
        return ResponseEntity.ok(Map.of("message", "Akses produk user diperbarui"));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        String name     = (String) body.get("name");
        String email    = (String) body.get("email");
        String password = (String) body.get("password");
        if (name == null || email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "name, email, password wajib"));
        }
        if (password.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password minimal 6 karakter"));
        }
        try {
            String hash = passwordEncoder.encode(password);
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO users (name, email, password_hash, role_id, avatar_color) " +
                "VALUES (?,?,?,?,?) RETURNING id, name, email, avatar_color, is_active, created_at",
                name,
                email.toLowerCase().trim(),
                hash,
                toLong(body.get("role_id")),
                orDefault(body.get("avatar_color"), "#4F46E5")
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                return ResponseEntity.status(409).body(Map.of("error", "Email sudah digunakan"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String email = (String) body.get("email");
        try {
            int updated = jdbc.update(
                "UPDATE users SET name=?, email=?, role_id=?, avatar_color=?, is_active=? WHERE id=?",
                body.get("name"),
                email != null ? email.toLowerCase().trim() : null,
                toLong(body.get("role_id")),
                body.get("avatar_color"),
                orDefault(body.get("is_active"), true),
                id
            );
            if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "User tidak ditemukan"));
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, name, email, avatar_color, is_active FROM users WHERE id=?", id
            );
            return ResponseEntity.ok(rows.get(0));
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                return ResponseEntity.status(409).body(Map.of("error", "Email sudah digunakan"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<?> resetPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String password = body.get("password");
        if (password == null || password.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password minimal 6 karakter"));
        }
        int updated = jdbc.update(
            "UPDATE users SET password_hash=? WHERE id=?", passwordEncoder.encode(password), id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "User tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Password berhasil direset"));
    }

    // ── Self profile update ─────────────────────────────────────────────────
    @PutMapping("/me")
    public ResponseEntity<?> updateSelf(@AuthenticationPrincipal Object principal,
                                         @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        Long actorId = toLong(actor.get("id"));
        String email = (String) body.get("email");
        try {
            int updated = jdbc.update(
                "UPDATE users SET name=?, email=?, avatar_color=? WHERE id=?",
                body.get("name"),
                email != null ? email.toLowerCase().trim() : null,
                body.get("avatar_color"),
                actorId
            );
            if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "User tidak ditemukan"));
            return ResponseEntity.ok(Map.of("message", "Profil berhasil diperbarui"));
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("violates unique constraint")) {
                return ResponseEntity.status(409).body(Map.of("error", "Email sudah digunakan"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    // ── Self password change (verifies current password) ────────────────────
    @PutMapping("/me/password")
    public ResponseEntity<?> changeOwnPassword(@AuthenticationPrincipal Object principal,
                                                @RequestBody Map<String, String> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        Long actorId = toLong(actor.get("id"));

        String currentPwd = body.get("current_password");
        String newPwd     = body.get("new_password");
        if (currentPwd == null || newPwd == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "current_password dan new_password wajib"));
        }
        if (newPwd.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password baru minimal 6 karakter"));
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT password_hash FROM users WHERE id=?", actorId
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "User tidak ditemukan"));
        String stored = (String) rows.get(0).get("password_hash");
        if (!passwordEncoder.matches(currentPwd, stored)) {
            return ResponseEntity.status(400).body(Map.of("error", "Password saat ini tidak sesuai"));
        }

        jdbc.update("UPDATE users SET password_hash=? WHERE id=?", passwordEncoder.encode(newPwd), actorId);
        return ResponseEntity.ok(Map.of("message", "Password berhasil diperbarui"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deactivate(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        Map<String, Object> currentUser = toMap(principal);
        if (currentUser != null) {
            Long currentId = toLong(currentUser.get("id"));
            if (id.equals(currentId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Tidak bisa menonaktifkan diri sendiri"));
            }
        }
        int updated = jdbc.update("UPDATE users SET is_active=false WHERE id=?", id);
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "User tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "User dinonaktifkan"));
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<?> permanentDelete(@PathVariable Long id,
                                              @AuthenticationPrincipal Object principal) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null || !"super_admin".equals(actor.get("role_name"))) {
            return ResponseEntity.status(403).body(Map.of("error", "Hanya super_admin yang bisa menghapus user secara permanen"));
        }
        Long actorId = toLong(actor.get("id"));
        if (id.equals(actorId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tidak bisa menghapus akun sendiri"));
        }
        List<Map<String, Object>> targetRows = jdbc.queryForList(
            "SELECT u.id, r.name AS role_name FROM users u " +
            "LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?", id
        );
        if (targetRows.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User tidak ditemukan"));
        }
        if ("super_admin".equals(targetRows.get(0).get("role_name"))) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak bisa menghapus sesama Super Admin"));
        }
        jdbc.update("DELETE FROM users WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "User berhasil dihapus secara permanen"));
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
