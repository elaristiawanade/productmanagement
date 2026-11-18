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
 * Type tiket Bugs Incident yang bisa diatur (Bug / Inquiry-Clarification, dst.).
 * Dibaca oleh siapa pun yang boleh membuka Bugs Incident atau Bug Types (untuk dropdown dan filter);
 * ditulis hanya oleh pemegang `settings.update` (Super Admin), sama seperti Client Statuses.
 * `bugs.type` menyimpan `code` Type ini.
 */
@RestController
@RequestMapping("/api/bug-types")
public class BugTypeController {

    /** Type bawaan: dipakai form lapor publik dan tiket tanpa Type, jadi tidak boleh dihapus. */
    public static final String DEFAULT_CODE = "bug";

    /** Type bawaan kedua: pemicu tombol "Buat Backlog" di Bugs Incident, jadi juga tidak boleh dihapus (nama boleh diubah). */
    public static final String IMPROVEMENT_CODE = "improvement";

    @Autowired
    private JdbcTemplate jdbc;

    private static final String SELECT_WITH_COUNT =
        "SELECT t.id, t.code, t.name, t.color, t.sort_order, " +
        "       (SELECT COUNT(*) FROM bugs b WHERE b.type = t.code) AS bug_count " +
        "FROM bug_types t ";

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "bugs", "access")
                && !PermissionHelper.can(principal, "settings", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke Type bug"));
        }
        return ResponseEntity.ok(jdbc.queryForList(SELECT_WITH_COUNT + "ORDER BY t.sort_order, t.name"));
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "settings", "update")) return forbidden();
        String name = str(body.get("name"));
        if (name.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Nama Type wajib diisi"));
        if (name.length() > 50) return ResponseEntity.badRequest().body(Map.of("error", "Nama Type maksimal 50 karakter"));
        if (nameTaken(name, null)) return ResponseEntity.status(409).body(Map.of("error", "Nama Type sudah ada"));

        Integer sort = toInt(body.get("sort_order"));
        if (sort == null) {
            Integer max = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order), 0) FROM bug_types", Integer.class);
            sort = (max == null ? 0 : max) + 1;
        }
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO bug_types (code, name, color, sort_order) VALUES (?,?,?,?) " +
                "RETURNING id, code, name, color, sort_order",
                uniqueCode(name), name, color(body.get("color")), sort);
            row.put("bug_count", 0);
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    /** `code` tidak pernah berubah (identitas stabil, disimpan di bugs.type); hanya nama, warna, dan urutan yang bisa diubah. */
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "settings", "update")) return forbidden();
        String name = str(body.get("name"));
        if (name.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Nama Type wajib diisi"));
        if (name.length() > 50) return ResponseEntity.badRequest().body(Map.of("error", "Nama Type maksimal 50 karakter"));
        if (nameTaken(name, id)) return ResponseEntity.status(409).body(Map.of("error", "Nama Type sudah ada"));

        int updated = jdbc.update(
            "UPDATE bug_types SET name=?, color=?, sort_order=COALESCE(?, sort_order) WHERE id=?",
            name, color(body.get("color")), toInt(body.get("sort_order")), id);
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Type tidak ditemukan"));
        return ResponseEntity.ok(jdbc.queryForMap(SELECT_WITH_COUNT + "WHERE t.id = ?", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "settings", "update")) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT code FROM bug_types WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Type tidak ditemukan"));
        String code = (String) rows.get(0).get("code");
        if (DEFAULT_CODE.equals(code)) {
            return ResponseEntity.status(409).body(Map.of("error",
                "Type bawaan tidak bisa dihapus karena dipakai sebagai nilai default (namanya boleh diubah)."));
        }
        if (IMPROVEMENT_CODE.equals(code)) {
            return ResponseEntity.status(409).body(Map.of("error",
                "Type Improvement tidak bisa dihapus karena dipakai untuk tombol Buat Backlog (namanya boleh diubah)."));
        }
        Long used = jdbc.queryForObject("SELECT COUNT(*) FROM bugs WHERE type = ?", Long.class, code);
        if (used != null && used > 0) {
            return ResponseEntity.status(409).body(Map.of("error",
                "Type ini masih dipakai oleh " + used + " tiket. Pindahkan tiket ke Type lain terlebih dahulu."));
        }
        jdbc.update("DELETE FROM bug_types WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Type dihapus"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("error", "Hanya Super Admin yang bisa mengubah Type bug"));
    }

    private boolean nameTaken(String name, Long exceptId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM bug_types WHERE LOWER(name) = LOWER(?)", name);
        for (Map<String, Object> r : rows) {
            if (exceptId == null || ((Number) r.get("id")).longValue() != exceptId) return true;
        }
        return false;
    }

    /** Slug dari nama ("Change Request" → "change_request"), diberi akhiran _2, _3 … kalau bentrok. */
    private String uniqueCode(String name) {
        String base = name.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (base.isEmpty()) base = "type";
        if (base.length() > 40) base = base.substring(0, 40);
        String code = base;
        int n = 2;
        while (jdbc.queryForObject("SELECT COUNT(*) FROM bug_types WHERE code = ?", Long.class, code) > 0) {
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
