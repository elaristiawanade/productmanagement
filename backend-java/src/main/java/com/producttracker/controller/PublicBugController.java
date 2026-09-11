package com.producttracker.controller;

import com.producttracker.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Unauthenticated bug reporting for employees who don't have a Product Tracker
 * account — e.g. someone outside the product team who found a bug in an app
 * they use. Reachable only on the office LAN (no auth wall, no rate limiting
 * by design — see SecurityConfig's `/api/public/**` permitAll matcher).
 *
 * Tickets created here land directly in the normal `bugs` table / Bugs Incident
 * module, with `reported_by` left NULL (no user account exists) and the plain-text
 * `reporter_name`/`reporter_email` recorded instead. Assignment is automatic —
 * whichever product the reporter picks, the ticket goes straight to that
 * product's owner (or stays unassigned if the product has none).
 */
@RestController
@RequestMapping("/api/public")
public class PublicBugController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EmailService email;

    @GetMapping("/products")
    public ResponseEntity<?> listActiveProducts() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, code, name FROM products WHERE status = 'active' ORDER BY name"
        );
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/bugs")
    public ResponseEntity<?> createPublicBug(@RequestBody Map<String, Object> body) {
        if (body.get("product_id") == null || body.get("title") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id dan title wajib"));
        }
        String reporterName = str(body.get("reporter_name")).trim();
        String reporterEmail = str(body.get("reporter_email")).trim();
        if (reporterName.isBlank() || reporterEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nama dan email pelapor wajib diisi"));
        }

        Long productId = toLong(body.get("product_id"));
        List<Map<String, Object>> pRows = jdbc.queryForList(
            "SELECT code, owner_id FROM products WHERE id = ?", productId
        );
        if (pRows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Produk tidak ditemukan"));
        }
        String pCode = (String) pRows.get(0).get("code");
        Long ownerId = toLong(pRows.get(0).get("owner_id"));

        List<Map<String, Object>> last = jdbc.queryForList(
            "SELECT code FROM bugs WHERE product_id=? AND code LIKE ? " +
            "ORDER BY CAST(SUBSTRING(code FROM '\\d+$') AS INTEGER) DESC LIMIT 1",
            productId, pCode + "-%"
        );
        int lastNum = 0;
        if (!last.isEmpty()) {
            String lastCode = (String) last.get(0).get("code");
            if (lastCode != null) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+$").matcher(lastCode);
                if (m.find()) lastNum = Integer.parseInt(m.group());
            }
        }
        String bugCode = pCode + "-" + String.format("%03d", lastNum + 1);

        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO bugs " +
                "(product_id, code, title, description, steps_to_reproduce, severity, priority, stage, " +
                " reported_by, reporter_name, reporter_email, assigned_to) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *",
                productId, bugCode,
                body.get("title"), body.get("description"), body.get("steps_to_reproduce"),
                orDefault(body.get("severity"), "medium"),
                "medium",
                "open",
                null,
                reporterName, reporterEmail,
                ownerId
            );

            Long newBugId = toLong(row.get("id"));
            if (ownerId != null) {
                createNotification(ownerId, "assignment",
                    "Bug publik baru " + row.get("code"),
                    "Bug \"" + row.get("title") + "\" dilaporkan oleh " + reporterName + " (" + reporterEmail + ")",
                    "/bugs?bug=" + newBugId);
                Map<String, Object> detail = bugDetail(newBugId);
                email.notifyAssignment(detail != null ? str(detail.get("assigned_to_email")) : null,
                    "Bug Incident", str(row.get("code")), str(row.get("title")), "System (Laporan Publik)",
                    "/bugs?bug=" + newBugId);
            }

            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    private void createNotification(Long userId, String type, String title, String message, String link) {
        try {
            jdbc.update(
                "INSERT INTO notifications (user_id, type, title, message, link) VALUES (?,?,?,?,?)",
                userId, type, title, message, link
            );
        } catch (Exception ignored) {}
    }

    private Map<String, Object> bugDetail(Long bugId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT b.*, au.name AS assigned_to_name, au.email AS assigned_to_email " +
            "FROM bugs b LEFT JOIN users au ON au.id = b.assigned_to WHERE b.id = ?",
            bugId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Object orDefault(Object v, Object d) {
        return v != null ? v : d;
    }

    private String str(Object v) { return v == null ? "" : v.toString(); }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        String s = v.toString();
        if (s.isBlank()) return null;
        return Long.parseLong(s);
    }
}
