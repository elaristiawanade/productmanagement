package com.producttracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    @Autowired
    private JdbcTemplate jdbc;

    @GetMapping
    public ResponseEntity<?> list() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, code, name, code_prefix, color, sort_order FROM departments ORDER BY sort_order, name"
        );
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        if (!isSuperAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Hanya super_admin yang bisa menambah departemen"));
        }
        String code = str(body.get("code"));
        String name = str(body.get("name"));
        if (code.isBlank() || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "code dan name wajib"));
        }
        String codePrefix = str(body.get("code_prefix"));
        if (codePrefix.isBlank()) codePrefix = code.toUpperCase();
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO departments (code, name, code_prefix, color, sort_order) VALUES (?,?,?,?,?) RETURNING *",
                code, name, codePrefix.toUpperCase(),
                orDefault(body.get("color"), "#64748B"),
                orDefault(body.get("sort_order"), 0)
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key")) {
                return ResponseEntity.status(409).body(Map.of("error", "Kode departemen sudah ada"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        if (!isSuperAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Hanya super_admin yang bisa mengubah departemen"));
        }
        List<Map<String, Object>> existing = jdbc.queryForList("SELECT * FROM departments WHERE id=?", id);
        if (existing.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Departemen tidak ditemukan"));
        Map<String, Object> prev = existing.get(0);

        String codePrefix = str(body.get("code_prefix"));
        int updated = jdbc.update(
            "UPDATE departments SET name=?, code_prefix=?, color=?, sort_order=? WHERE id=?",
            orDefault(body.get("name"), prev.get("name")),
            (codePrefix.isBlank() ? str(prev.get("code_prefix")) : codePrefix.toUpperCase()),
            orDefault(body.get("color"), prev.get("color")),
            orDefault(body.get("sort_order"), prev.get("sort_order")),
            id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Departemen tidak ditemukan"));
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM departments WHERE id=?", id);
        return ResponseEntity.ok(row);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal) {
        if (!isSuperAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Hanya super_admin yang bisa menghapus departemen"));
        }
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT code FROM departments WHERE id=?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Departemen tidak ditemukan"));
        String code = str(rows.get(0).get("code"));

        Long usedByNotes = jdbc.queryForObject("SELECT COUNT(*) FROM leader_notes WHERE department=?", Long.class, code);
        Long usedByTasks = jdbc.queryForObject("SELECT COUNT(*) FROM leader_tasks WHERE department=?", Long.class, code);
        long usedCount = (usedByNotes != null ? usedByNotes : 0) + (usedByTasks != null ? usedByTasks : 0);
        if (usedCount > 0) {
            return ResponseEntity.status(409).body(
                Map.of("error", "Departemen ini masih dipakai oleh " + usedCount + " Leader Notes/Task. Pindahkan data terlebih dahulu.")
            );
        }
        jdbc.update("DELETE FROM departments WHERE id=?", id);
        return ResponseEntity.ok(Map.of("message", "Departemen dihapus"));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private boolean isSuperAdmin(Object principal) {
        if (!(principal instanceof Map)) return false;
        Object rn = ((Map<String, Object>) principal).get("role_name");
        return "super_admin".equals(rn);
    }

    private String str(Object v) { return v == null ? "" : v.toString(); }

    private Object orDefault(Object v, Object d) { return v != null ? v : d; }
}
