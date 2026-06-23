package com.producttracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/standups")
public class StandupController {

    @Autowired
    private JdbcTemplate jdbc;

    // ─── LIST ─────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal,
                                   @RequestParam(required = false) Long user_id,
                                   @RequestParam(required = false) String date_from,
                                   @RequestParam(required = false) String date_to) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();

        boolean isManagerOrAbove = isManagerOrAbove(actor);
        Long actorId = toLong(actor.get("id"));

        StringBuilder sql = new StringBuilder(
            "SELECT s.id, s.standup_date, s.yesterday, s.today, " +
            "       s.has_blocker, s.blocker, s.blocker_plan, " +
            "       s.created_at, s.updated_at, " +
            "       u.id AS user_id, u.name AS user_name, u.avatar_color " +
            "FROM standups s " +
            "JOIN users u ON u.id = s.user_id " +
            "WHERE 1=1 ");

        java.util.List<Object> params = new java.util.ArrayList<>();

        if (!isManagerOrAbove) {
            sql.append(" AND s.user_id = ?");
            params.add(actorId);
        } else if (user_id != null) {
            sql.append(" AND s.user_id = ?");
            params.add(user_id);
        }
        if (date_from != null && !date_from.isBlank()) {
            sql.append(" AND s.standup_date >= ?");
            params.add(java.sql.Date.valueOf(date_from));
        }
        if (date_to != null && !date_to.isBlank()) {
            sql.append(" AND s.standup_date <= ?");
            params.add(java.sql.Date.valueOf(date_to));
        }
        sql.append(" ORDER BY s.standup_date DESC, u.name LIMIT 200");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), params.toArray());
        return ResponseEntity.ok(rows);
    }

    // ─── GET TODAY (check if already submitted) ──────────────────────────

    @GetMapping("/today")
    public ResponseEntity<?> today(@AuthenticationPrincipal Object principal) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        Long userId = toLong(actor.get("id"));
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM standups WHERE user_id = ? AND standup_date = ?",
            userId, java.sql.Date.valueOf(LocalDate.now())
        );
        if (rows.isEmpty()) return ResponseEntity.ok(Map.of("submitted", false));
        return ResponseEntity.ok(Map.of("submitted", true, "standup", rows.get(0)));
    }

    // ─── CREATE ───────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        Long userId = toLong(actor.get("id"));

        if (body.get("yesterday") == null || body.get("today") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "yesterday dan today wajib"));
        }

        String dateStr = body.get("standup_date") != null
            ? body.get("standup_date").toString() : LocalDate.now().toString();
        java.sql.Date standupDate;
        try { standupDate = java.sql.Date.valueOf(dateStr); }
        catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", "Format tanggal tidak valid")); }

        boolean hasBlocker = Boolean.TRUE.equals(body.get("has_blocker")) ||
            "true".equals(String.valueOf(body.get("has_blocker")));

        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO standups (user_id, standup_date, yesterday, today, has_blocker, blocker, blocker_plan) " +
                "VALUES (?,?,?,?,?,?,?) RETURNING *",
                userId, standupDate,
                body.get("yesterday"), body.get("today"),
                hasBlocker,
                hasBlocker ? body.get("blocker") : null,
                hasBlocker ? body.get("blocker_plan") : null
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("unique")) {
                return ResponseEntity.status(409).body(Map.of("error", "Standup untuk tanggal ini sudah ada"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal,
                                     @RequestBody Map<String, Object> body) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        Long actorId = toLong(actor.get("id"));
        boolean canEditAll = isPoOrAbove(actor);

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id FROM standups WHERE id = ?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Standup tidak ditemukan"));

        Long ownerId = toLong(rows.get(0).get("user_id"));
        if (!canEditAll && !actorId.equals(ownerId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses"));
        }

        boolean hasBlocker = Boolean.TRUE.equals(body.get("has_blocker")) ||
            "true".equals(String.valueOf(body.get("has_blocker")));

        String dateStr = body.get("standup_date") != null
            ? body.get("standup_date").toString() : null;
        java.sql.Date standupDate = null;
        if (dateStr != null && !dateStr.isBlank()) {
            try { standupDate = java.sql.Date.valueOf(dateStr.substring(0, 10)); }
            catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", "Format tanggal tidak valid")); }
        }

        try {
            if (standupDate != null) {
                jdbc.update(
                    "UPDATE standups SET standup_date=?, yesterday=?, today=?, has_blocker=?, blocker=?, blocker_plan=? WHERE id=?",
                    standupDate,
                    body.get("yesterday"), body.get("today"),
                    hasBlocker,
                    hasBlocker ? body.get("blocker") : null,
                    hasBlocker ? body.get("blocker_plan") : null,
                    id
                );
            } else {
                jdbc.update(
                    "UPDATE standups SET yesterday=?, today=?, has_blocker=?, blocker=?, blocker_plan=? WHERE id=?",
                    body.get("yesterday"), body.get("today"),
                    hasBlocker,
                    hasBlocker ? body.get("blocker") : null,
                    hasBlocker ? body.get("blocker_plan") : null,
                    id
                );
            }
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("duplicate key") || msg.contains("unique")) {
                return ResponseEntity.status(409).body(Map.of("error", "Standup untuk tanggal ini sudah ada"));
            }
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }

        Map<String, Object> updated = jdbc.queryForMap("SELECT * FROM standups WHERE id=?", id);
        return ResponseEntity.ok(updated);
    }

    // ─── ACHIEVEMENT ─────────────────────────────────────────────────────

    @GetMapping("/achievement")
    public ResponseEntity<?> achievement(@AuthenticationPrincipal Object principal) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();

        // Per-user stats: total, this month, streak (approx: consecutive days from latest)
        List<Map<String, Object>> stats = jdbc.queryForList(
            "SELECT " +
            "  u.id AS user_id, u.name AS user_name, u.avatar_color, " +
            "  COUNT(s.id)                                    AS total_standups, " +
            "  COUNT(CASE WHEN s.standup_date >= date_trunc('month', NOW()) THEN 1 END) AS this_month, " +
            "  COUNT(CASE WHEN s.has_blocker THEN 1 END)      AS total_blockers, " +
            "  MAX(s.standup_date)                            AS last_standup, " +
            "  MIN(s.standup_date)                            AS first_standup " +
            "FROM users u " +
            "LEFT JOIN standups s ON s.user_id = u.id " +
            "WHERE u.is_active = true " +
            "GROUP BY u.id, u.name, u.avatar_color " +
            "ORDER BY total_standups DESC, u.name");

        // Working-days count this month (Mon–Fri, approximate)
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        long workingDays = 0;
        for (LocalDate d = monthStart; !d.isAfter(today); d = d.plusDays(1)) {
            int dow = d.getDayOfWeek().getValue(); // 1=Mon, 7=Sun
            if (dow < 6) workingDays++;
        }
        final long wd = workingDays;

        stats.forEach(row -> {
            long thisMonth = row.get("this_month") instanceof Number
                ? ((Number) row.get("this_month")).longValue() : 0L;
            row.put("participation_pct", wd > 0 ? Math.min(100, Math.round((thisMonth * 100.0) / wd)) : 0);
            row.put("working_days_this_month", wd);
        });

        return ResponseEntity.ok(stats);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private boolean isManagerOrAbove(Map<String, Object> user) {
        Object rn = user.get("role_name");
        return "super_admin".equals(rn) || "manager".equals(rn);
    }

    private boolean isPoOrAbove(Map<String, Object> user) {
        Object rn = user.get("role_name");
        return "super_admin".equals(rn) || "manager".equals(rn) || "po".equals(rn);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
    }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }
}
