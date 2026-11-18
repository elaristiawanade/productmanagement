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
 * Stage tiket Bugs Incident yang bisa diatur. 6 Stage bawaan (is_builtin) tidak bisa dihapus dan
 * perilakunya terkunci; Super Admin bisa MENAMBAH Stage baru dan mengatur nama, warna, urutan, serta dua
 * flag perilaku (is_closed = dianggap selesai, not_late = Deadline tidak pernah merah).
 * Dibaca oleh siapa pun yang boleh membuka Bugs Incident (dropdown/filter); ditulis hanya oleh pemegang
 * `settings.update` (Super Admin), sama seperti Bug Types. `bugs.stage` menyimpan `code` Stage ini.
 */
@RestController
@RequestMapping("/api/bug-stages")
public class BugStageController {

    @Autowired
    private JdbcTemplate jdbc;

    private static final String SELECT_WITH_COUNT =
        "SELECT s.id, s.code, s.name, s.color, s.sort_order, s.is_builtin, s.is_closed, s.not_late, s.counts_open, " +
        "       (SELECT COUNT(*) FROM bugs b WHERE b.stage = s.code) AS bug_count " +
        "FROM bug_stages s ";

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "bugs", "access")
                && !PermissionHelper.can(principal, "settings", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke Stage bug"));
        }
        return ResponseEntity.ok(jdbc.queryForList(SELECT_WITH_COUNT + "ORDER BY s.sort_order, s.name"));
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "settings", "update")) return forbidden();
        String name = str(body.get("name"));
        if (name.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Nama Stage wajib diisi"));
        if (name.length() > 50) return ResponseEntity.badRequest().body(Map.of("error", "Nama Stage maksimal 50 karakter"));
        if (nameTaken(name, null)) return ResponseEntity.status(409).body(Map.of("error", "Nama Stage sudah ada"));

        boolean closed = bool(body.get("is_closed"));
        boolean notLate = bool(body.get("not_late"));
        Integer sort = toInt(body.get("sort_order"));
        if (sort == null) {
            Integer max = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order), 0) FROM bug_stages", Integer.class);
            sort = (max == null ? 0 : max) + 1;
        }
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO bug_stages (code, name, color, sort_order, is_closed, not_late, counts_open) " +
                "VALUES (?,?,?,?,?,?,?) RETURNING id",
                uniqueCode(name), name, color(body.get("color")), sort, closed, notLate, !(closed || notLate));
            return ResponseEntity.status(201).body(
                jdbc.queryForMap(SELECT_WITH_COUNT + "WHERE s.id = ?", row.get("id")));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    /**
     * `code` tidak pernah berubah (identitas stabil, disimpan di bugs.stage). Nama, warna, dan urutan bisa diubah
     * untuk semua Stage; flag perilaku hanya untuk Stage buatan sendiri (Stage bawaan terkunci).
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "settings", "update")) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT is_builtin, is_closed, not_late FROM bug_stages WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Stage tidak ditemukan"));
        boolean builtin = Boolean.TRUE.equals(rows.get(0).get("is_builtin"));

        String name = str(body.get("name"));
        if (name.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Nama Stage wajib diisi"));
        if (name.length() > 50) return ResponseEntity.badRequest().body(Map.of("error", "Nama Stage maksimal 50 karakter"));
        if (nameTaken(name, id)) return ResponseEntity.status(409).body(Map.of("error", "Nama Stage sudah ada"));

        if (builtin) {
            jdbc.update("UPDATE bug_stages SET name=?, color=?, sort_order=COALESCE(?, sort_order) WHERE id=?",
                name, color(body.get("color")), toInt(body.get("sort_order")), id);
        } else {
            boolean closed = body.containsKey("is_closed") ? bool(body.get("is_closed")) : Boolean.TRUE.equals(rows.get(0).get("is_closed"));
            boolean notLate = body.containsKey("not_late") ? bool(body.get("not_late")) : Boolean.TRUE.equals(rows.get(0).get("not_late"));
            jdbc.update(
                "UPDATE bug_stages SET name=?, color=?, sort_order=COALESCE(?, sort_order), " +
                "is_closed=?, not_late=?, counts_open=? WHERE id=?",
                name, color(body.get("color")), toInt(body.get("sort_order")),
                closed, notLate, !(closed || notLate), id);
            // Tiket yang sudah ada di Stage ini ikut mengikuti flag is_closed yang baru, supaya "Tanggal Closed"
            // tidak menggantung: Stage yang kini dianggap selesai mengisi closed_at, yang tidak lagi, mengosongkannya.
            jdbc.update("UPDATE bugs b SET closed_at = CASE WHEN ? THEN COALESCE(b.closed_at, NOW()) ELSE NULL END " +
                "WHERE b.stage = (SELECT code FROM bug_stages WHERE id = ?)", closed, id);
        }
        return ResponseEntity.ok(jdbc.queryForMap(SELECT_WITH_COUNT + "WHERE s.id = ?", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "settings", "update")) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT code, is_builtin FROM bug_stages WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Stage tidak ditemukan"));
        if (Boolean.TRUE.equals(rows.get(0).get("is_builtin"))) {
            return ResponseEntity.status(409).body(Map.of("error",
                "Stage bawaan tidak bisa dihapus (nama, warna, dan urutannya boleh diubah)."));
        }
        String code = (String) rows.get(0).get("code");
        Long used = jdbc.queryForObject("SELECT COUNT(*) FROM bugs WHERE stage = ?", Long.class, code);
        if (used != null && used > 0) {
            return ResponseEntity.status(409).body(Map.of("error",
                "Stage ini masih dipakai oleh " + used + " tiket. Pindahkan tiket ke Stage lain terlebih dahulu."));
        }
        jdbc.update("DELETE FROM bug_stages WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Stage dihapus"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("error", "Hanya Super Admin yang bisa mengubah Stage bug"));
    }

    private boolean nameTaken(String name, Long exceptId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM bug_stages WHERE LOWER(name) = LOWER(?)", name);
        for (Map<String, Object> r : rows) {
            if (exceptId == null || ((Number) r.get("id")).longValue() != exceptId) return true;
        }
        return false;
    }

    /** Slug dari nama ("Waiting Client" → "waiting_client"), diberi akhiran _2, _3 … kalau bentrok. */
    private String uniqueCode(String name) {
        String base = name.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (base.isEmpty()) base = "stage";
        if (base.length() > 40) base = base.substring(0, 40);
        String code = base;
        int n = 2;
        while (jdbc.queryForObject("SELECT COUNT(*) FROM bug_stages WHERE code = ?", Long.class, code) > 0) {
            code = base + "_" + n++;
        }
        return code;
    }

    private String color(Object v) {
        String s = str(v);
        return s.matches("^#[0-9a-fA-F]{6}$") ? s : "#64748B";
    }

    private boolean bool(Object v) {
        if (v instanceof Boolean) return (Boolean) v;
        return v != null && "true".equalsIgnoreCase(v.toString().trim());
    }

    private String str(Object v) { return v == null ? "" : v.toString().trim(); }

    private Integer toInt(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try { return Integer.parseInt(v.toString().trim()); } catch (NumberFormatException e) { return null; }
    }
}
