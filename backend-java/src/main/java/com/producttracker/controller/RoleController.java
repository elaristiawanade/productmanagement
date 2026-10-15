package com.producttracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.producttracker.config.PermissionHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/roles")
public class RoleController {

    @Autowired
    private JdbcTemplate jdbc;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @GetMapping
    public ResponseEntity<?> list() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, name, display_name, permissions FROM roles ORDER BY id"
        );
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "roles", "create")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menambah role"));
        }
        if (body.get("name") == null || body.get("display_name") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "name dan display_name wajib"));
        }
        String permissionsJson = body.get("permissions") != null
            ? toJsonString(body.get("permissions")) : "{}";
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO roles (name, display_name, permissions) VALUES (?,?,?::jsonb) RETURNING *",
                body.get("name").toString().toLowerCase().replace(" ", "_"),
                body.get("display_name"),
                permissionsJson
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key")) {
                return ResponseEntity.status(409).body(Map.of("error", "Nama role sudah ada"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "roles", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk mengubah role"));
        }
        String permissionsJson = body.get("permissions") != null
            ? toJsonString(body.get("permissions")) : "{}";
        int updated = jdbc.update(
            "UPDATE roles SET display_name=?, permissions=?::jsonb WHERE id=?",
            body.get("display_name"), permissionsJson, id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Role tidak ditemukan"));
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM roles WHERE id=?", id);
        return ResponseEntity.ok(row);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "roles", "delete")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menghapus role"));
        }
        // Prevent deletion if users are assigned to this role
        Long count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE role_id = ?", Long.class, id
        );
        if (count != null && count > 0) {
            return ResponseEntity.status(409).body(
                Map.of("error", "Role ini masih digunakan oleh " + count + " user. Pindahkan user terlebih dahulu.")
            );
        }
        int deleted = jdbc.update("DELETE FROM roles WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Role tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Role dihapus"));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private String toJsonString(Object obj) {
        if (obj instanceof String) return (String) obj;
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }
}
