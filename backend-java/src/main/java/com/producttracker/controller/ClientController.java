package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Client Management: daftar bank/klien pemakai produk internal (PRD 3.17).
 * Satu baris `clients` = satu kontrak. Akses lewat matriks permission modul `clients`
 * (access / create / update / delete); super_admin selalu lolos via PermissionHelper.can().
 * Status client dikelola di ClientStatusController.
 */
@RestController
@RequestMapping("/api/clients")
public class ClientController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private TransactionTemplate tx;

    private static final String SELECT_CLIENT =
        "SELECT c.id, c.bank_name, c.city, c.status_id, " +
        "       s.code AS status_code, s.name AS status_name, s.color AS status_color, " +
        "       c.contract_no, c.revenue, c.contract_start, c.contract_end, " +
        "       c.pic_id, pu.name AS pic_name, pu.avatar_color AS pic_color, " +
        "       c.created_at, c.updated_at, cb.name AS created_by_name, " +
        "       (SELECT COUNT(*) FROM client_comments cc WHERE cc.client_id = c.id) AS comment_count, " +
        "       (SELECT cc.content FROM client_comments cc WHERE cc.client_id = c.id " +
        "          ORDER BY cc.created_at DESC, cc.id DESC LIMIT 1) AS last_comment, " +
        "       (SELECT cc.created_at FROM client_comments cc WHERE cc.client_id = c.id " +
        "          ORDER BY cc.created_at DESC, cc.id DESC LIMIT 1) AS last_comment_at " +
        "FROM clients c " +
        "JOIN client_statuses s ON s.id = c.status_id " +
        "LEFT JOIN users pu ON pu.id = c.pic_id " +
        "LEFT JOIN users cb ON cb.id = c.created_by ";

    // ── LIST / OPTIONS / GET ─────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "clients", "access")) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_CLIENT + "ORDER BY c.bank_name, c.id");
        attachProducts(rows);
        return ResponseEntity.ok(rows);
    }

    /**
     * Pilihan untuk form: SEMUA produk (bukan GET /api/products yang difilter per user — editor yang
     * tidak di-assign ke suatu produk akan melihat daftar tidak lengkap dan tanpa sengaja melepas
     * produk itu dari client), kandidat PIC (role Product Owner + owner produk mana pun), dan status.
     */
    @GetMapping("/options")
    public ResponseEntity<?> options(@AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "clients", "access")) return forbidden();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("products", jdbc.queryForList(
            "SELECT p.id, p.code, p.name, p.color, p.status, p.owner_id, u.name AS owner_name " +
            "FROM products p LEFT JOIN users u ON u.id = p.owner_id ORDER BY p.name"));
        body.put("users", jdbc.queryForList(
            "SELECT u.id, u.name, u.avatar_color, r.name AS role_name, r.display_name AS role_display " +
            "FROM users u LEFT JOIN roles r ON r.id = u.role_id " +
            "WHERE u.is_active = true AND (r.name = 'po' OR u.id IN (SELECT owner_id FROM products WHERE owner_id IS NOT NULL)) " +
            "ORDER BY u.name"));
        body.put("statuses", jdbc.queryForList(
            "SELECT id, code, name, color, sort_order FROM client_statuses ORDER BY sort_order, name"));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "clients", "access")) return forbidden();
        Map<String, Object> row = findOne(id);
        if (row == null) return notFound();
        return ResponseEntity.ok(row);
    }

    // ── CREATE / UPDATE / DELETE ─────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "clients", "create")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menambah client"));
        }
        ClientInput in = new ClientInput();
        String error = in.parse(body);
        if (error == null) error = validateReferences(in);
        if (error != null) return ResponseEntity.badRequest().body(Map.of("error", error));

        Long userId = PermissionHelper.getUserId(principal);
        Long id = tx.execute(status -> {
            Long newId = jdbc.queryForObject(
                "INSERT INTO clients (bank_name, city, status_id, contract_no, revenue, contract_start, contract_end, pic_id, created_by) " +
                "VALUES (?,?,?,?,?,?,?,?,?) RETURNING id", Long.class,
                in.bankName, in.city, in.statusId, in.contractNo, in.revenue, in.contractStart, in.contractEnd, in.picId, userId);
            syncProducts(newId, in.productIds);
            return newId;
        });
        return ResponseEntity.status(201).body(findOne(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @AuthenticationPrincipal Object principal,
                                    @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "clients", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk mengubah client"));
        }
        if (findOne(id) == null) return notFound();

        ClientInput in = new ClientInput();
        String error = in.parse(body);
        if (error == null) error = validateReferences(in);
        if (error != null) return ResponseEntity.badRequest().body(Map.of("error", error));

        tx.executeWithoutResult(status -> {
            jdbc.update(
                "UPDATE clients SET bank_name=?, city=?, status_id=?, contract_no=?, revenue=?, " +
                "contract_start=?, contract_end=?, pic_id=?, updated_at=NOW() WHERE id=?",
                in.bankName, in.city, in.statusId, in.contractNo, in.revenue,
                in.contractStart, in.contractEnd, in.picId, id);
            // Hanya ganti set produk kalau field-nya memang dikirim: request tanpa product_ids tidak melepas produk
            if (body.containsKey("product_ids")) syncProducts(id, in.productIds);
        });
        return ResponseEntity.ok(findOne(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "clients", "delete")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menghapus client"));
        }
        int deleted = jdbc.update("DELETE FROM clients WHERE id = ?", id);
        if (deleted == 0) return notFound();
        return ResponseEntity.ok(Map.of("message", "Client dihapus"));
    }

    // ── COMMENTS ─────────────────────────────────────────────────────────────

    @GetMapping("/{id}/comments")
    public ResponseEntity<?> comments(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "clients", "access")) return forbidden();
        return ResponseEntity.ok(jdbc.queryForList(
            "SELECT c.id, c.client_id, c.user_id, c.content, c.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_color " +
            "FROM client_comments c LEFT JOIN users u ON u.id = c.user_id " +
            "WHERE c.client_id = ? ORDER BY c.created_at DESC, c.id DESC", id));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<?> addComment(@PathVariable Long id,
                                        @AuthenticationPrincipal Object principal,
                                        @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "clients", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menulis catatan client"));
        }
        String content = body.get("content") == null ? "" : body.get("content").toString().trim();
        if (content.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Isi catatan wajib diisi"));
        }
        if (content.length() > 5000) {
            return ResponseEntity.badRequest().body(Map.of("error", "Catatan maksimal 5000 karakter"));
        }
        Long exists = jdbc.queryForObject("SELECT COUNT(*) FROM clients WHERE id = ?", Long.class, id);
        if (exists == null || exists == 0) return notFound();

        Long commentId = jdbc.queryForObject(
            "INSERT INTO client_comments (client_id, user_id, content) VALUES (?,?,?) RETURNING id",
            Long.class, id, PermissionHelper.getUserId(principal), content);
        jdbc.update("UPDATE clients SET updated_at = NOW() WHERE id = ?", id);
        return ResponseEntity.status(201).body(jdbc.queryForMap(
            "SELECT c.id, c.client_id, c.user_id, c.content, c.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_color " +
            "FROM client_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?", commentId));
    }

    /** Catatan hanya bisa dihapus penulisnya sendiri atau Super Admin. */
    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<?> deleteComment(@PathVariable Long commentId, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "clients", "access")) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id FROM client_comments WHERE id = ?", commentId);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Catatan tidak ditemukan"));
        Object owner = rows.get(0).get("user_id");
        Long me = PermissionHelper.getUserId(principal);
        boolean isOwner = owner instanceof Number && me != null && ((Number) owner).longValue() == me;
        if (!isOwner && !PermissionHelper.isSuperAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Catatan hanya bisa dihapus penulisnya atau Super Admin"));
        }
        jdbc.update("DELETE FROM client_comments WHERE id = ?", commentId);
        return ResponseEntity.ok(Map.of("message", "Catatan dihapus"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Map<String, Object> findOne(Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_CLIENT + "WHERE c.id = ?", id);
        if (rows.isEmpty()) return null;
        attachProducts(rows);
        return rows.get(0);
    }

    /** Menempelkan `products` ([{id, code, name, color}]) ke tiap baris dengan satu query untuk semua client. */
    private void attachProducts(List<Map<String, Object>> rows) {
        if (rows.isEmpty()) return;
        List<Map<String, Object>> links = jdbc.queryForList(
            "SELECT cp.client_id, p.id, p.code, p.name, p.color " +
            "FROM client_products cp JOIN products p ON p.id = cp.product_id ORDER BY p.name");
        Map<Long, List<Map<String, Object>>> byClient = new LinkedHashMap<>();
        for (Map<String, Object> l : links) {
            Long cid = ((Number) l.get("client_id")).longValue();
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("id", l.get("id"));
            p.put("code", l.get("code"));
            p.put("name", l.get("name"));
            p.put("color", l.get("color"));
            byClient.computeIfAbsent(cid, k -> new ArrayList<>()).add(p);
        }
        for (Map<String, Object> row : rows) {
            Long cid = ((Number) row.get("id")).longValue();
            row.put("products", byClient.getOrDefault(cid, List.of()));
        }
    }

    private void syncProducts(Long clientId, List<Long> productIds) {
        jdbc.update("DELETE FROM client_products WHERE client_id = ?", clientId);
        for (Long pid : productIds) {
            jdbc.update("INSERT INTO client_products (client_id, product_id) VALUES (?,?) ON CONFLICT DO NOTHING",
                clientId, pid);
        }
    }

    /** Status, PIC, dan produk harus benar-benar ada, supaya salah kirim ID jadi 400 yang jelas, bukan 500 dari FK. */
    private String validateReferences(ClientInput in) {
        Long st = jdbc.queryForObject("SELECT COUNT(*) FROM client_statuses WHERE id = ?", Long.class, in.statusId);
        if (st == null || st == 0) return "Status tidak valid";
        if (in.picId != null) {
            Long u = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = ?", Long.class, in.picId);
            if (u == null || u == 0) return "PIC tidak valid";
        }
        for (Long pid : in.productIds) {
            Long p = jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE id = ?", Long.class, pid);
            if (p == null || p == 0) return "Produk tidak valid";
        }
        return null;
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke modul Client Management"));
    }

    private ResponseEntity<?> notFound() {
        return ResponseEntity.status(404).body(Map.of("error", "Client tidak ditemukan"));
    }

    /** Hasil baca + validasi body request create/update. {@link #parse} mengembalikan pesan error atau null. */
    private static class ClientInput {
        String bankName;
        String city;
        String contractNo;
        Long statusId;
        Long picId;
        BigDecimal revenue;
        Date contractStart;
        Date contractEnd;
        List<Long> productIds = new ArrayList<>();

        String parse(Map<String, Object> body) {
            bankName = text(body.get("bank_name"));
            if (bankName == null) return "Nama bank wajib diisi";
            if (bankName.length() > 150) return "Nama bank maksimal 150 karakter";
            city = text(body.get("city"));
            if (city != null && city.length() > 100) return "Kota maksimal 100 karakter";
            contractNo = text(body.get("contract_no"));
            if (contractNo != null && contractNo.length() > 100) return "No Contract maksimal 100 karakter";

            statusId = toLong(body.get("status_id"));
            if (statusId == null) return "Status wajib dipilih";
            picId = toLong(body.get("pic_id"));

            String rev = text(body.get("revenue"));
            if (rev != null) {
                try {
                    revenue = new BigDecimal(rev);
                } catch (NumberFormatException e) {
                    return "Revenue harus berupa angka";
                }
                if (revenue.signum() < 0) return "Revenue tidak boleh negatif";
                if (revenue.compareTo(new BigDecimal("1000000000000000")) >= 0) return "Revenue terlalu besar";
            }

            try {
                contractStart = toDate(body.get("contract_start"));
                contractEnd = toDate(body.get("contract_end"));
            } catch (DateTimeParseException e) {
                return "Format tanggal kontrak tidak valid";
            }
            if (contractStart != null && contractEnd != null && contractEnd.before(contractStart)) {
                return "Tanggal akhir kontrak tidak boleh sebelum tanggal mulai";
            }

            Object raw = body.get("product_ids");
            if (raw instanceof List) {
                Set<Long> ids = new LinkedHashSet<>();
                for (Object o : (List<?>) raw) {
                    Long id = toLong(o);
                    if (id != null) ids.add(id);
                }
                productIds = new ArrayList<>(ids);
            }
            return null;
        }

        private static String text(Object v) {
            if (v == null) return null;
            String s = v.toString().trim();
            return s.isEmpty() ? null : s;
        }

        private static Long toLong(Object v) {
            if (v == null) return null;
            if (v instanceof Number) return ((Number) v).longValue();
            String s = v.toString().trim();
            if (s.isEmpty()) return null;
            try { return Long.parseLong(s); } catch (NumberFormatException e) { return null; }
        }

        /** Menerima "yyyy-MM-dd" (atau ISO yang diawali tanggal); kosong → null; tanggal tidak valid (mis. 31 Feb) → DateTimeParseException. */
        private static Date toDate(Object v) {
            String s = text(v);
            if (s == null) return null;
            return Date.valueOf(LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s));
        }
    }
}
