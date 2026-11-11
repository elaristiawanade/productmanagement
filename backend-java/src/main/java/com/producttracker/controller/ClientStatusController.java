package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Status client yang bisa diatur (Approaching / Declined / Active / Sunset / Deactivated, dst.).
 * Dibaca oleh siapa pun yang boleh membuka Client Management atau Client Settings;
 * ditulis hanya oleh pemegang `settings.update` (Super Admin), sama seperti Notification Settings.
 */
@RestController
@RequestMapping("/api/client-statuses")
public class ClientStatusController {

    @Autowired
    private JdbcTemplate jdbc;

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "clients", "access")
                && !PermissionHelper.can(principal, "settings", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke status client"));
        }
        return ResponseEntity.ok(jdbc.queryForList(
            "SELECT s.id, s.code, s.name, s.color, s.sort_order, " +
            "       (SELECT COUNT(*) FROM clients c WHERE c.status_id = s.id) AS client_count " +
            "FROM client_statuses s ORDER BY s.sort_order, s.name"));
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "settings", "update")) return forbidden();
        String name = str(body.get("name"));
        if (name.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Nama status wajib diisi"));
        if (name.length() > 50) return ResponseEntity.badRequest().body(Map.of("error", "Nama status maksimal 50 karakter"));
        if (nameTaken(name, null)) return ResponseEntity.status(409).body(Map.of("error", "Nama status sudah ada"));

        Integer sort = toInt(body.get("sort_order"));
        if (sort == null) {
            Integer max = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order), 0) FROM client_statuses", Integer.class);
            sort = (max == null ? 0 : max) + 1;
        }
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO client_statuses (code, name, color, sort_order) VALUES (?,?,?,?) " +
                "RETURNING id, code, name, color, sort_order",
                uniqueCode(name), name, color(body.get("color")), sort);
            row.put("client_count", 0);
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    /** `code` tidak pernah berubah (identitas stabil); hanya nama, warna, dan urutan yang bisa diubah. */
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "settings", "update")) return forbidden();
        String name = str(body.get("name"));
        if (name.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Nama status wajib diisi"));
        if (name.length() > 50) return ResponseEntity.badRequest().body(Map.of("error", "Nama status maksimal 50 karakter"));
        if (nameTaken(name, id)) return ResponseEntity.status(409).body(Map.of("error", "Nama status sudah ada"));

        int updated = jdbc.update(
            "UPDATE client_statuses SET name=?, color=?, sort_order=COALESCE(?, sort_order) WHERE id=?",
            name, color(body.get("color")), toInt(body.get("sort_order")), id);
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Status tidak ditemukan"));
        return ResponseEntity.ok(jdbc.queryForMap(
            "SELECT s.id, s.code, s.name, s.color, s.sort_order, " +
            "       (SELECT COUNT(*) FROM clients c WHERE c.status_id = s.id) AS client_count " +
            "FROM client_statuses s WHERE s.id = ?", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "settings", "update")) return forbidden();
        Long used = jdbc.queryForObject("SELECT COUNT(*) FROM clients WHERE status_id = ?", Long.class, id);
        if (used != null && used > 0) {
            return ResponseEntity.status(409).body(Map.of("error",
                "Status ini masih dipakai oleh " + used + " client. Pindahkan client ke status lain terlebih dahulu."));
        }
        int deleted = jdbc.update("DELETE FROM client_statuses WHERE id = ?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Status tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Status dihapus"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("error", "Hanya Super Admin yang bisa mengubah status client"));
    }

    private boolean nameTaken(String name, Long exceptId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM client_statuses WHERE LOWER(name) = LOWER(?)", name);
        for (Map<String, Object> r : rows) {
            if (exceptId == null || ((Number) r.get("id")).longValue() != exceptId) return true;
        }
        return false;
    }

    /** Slug dari nama ("Under Review" → "under_review"), diberi akhiran _2, _3 … kalau bentrok. */
    private String uniqueCode(String name) {
        String base = name.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (base.isEmpty()) base = "status";
        if (base.length() > 40) base = base.substring(0, 40);
        String code = base;
        int n = 2;
        while (jdbc.queryForObject("SELECT COUNT(*) FROM client_statuses WHERE code = ?", Long.class, code) > 0) {
            code = base + "_" + n++;
        }
        return code;
    }

    private String color(Object v) {
        String s = str(v);
        return s.matches("^#[0-9a-fA-F]{6}$") ? s : "#64748B";
    }

    private String str(Object v) { return v == null ? "" : v.toString().trim(); }

    private Integer toInt(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try { return Integer.parseInt(v.toString().trim()); } catch (NumberFormatException e) { return null; }
    }
}
