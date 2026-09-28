package com.producttracker.controller;

import com.producttracker.config.BugHelper;
import com.producttracker.service.AssigneeSupport;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PushbackInputStream;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/import")
public class ImportController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private BugHelper bugHelper;

    @Autowired
    private AssigneeSupport assigneeSupport;

    private static final Set<String> SEVERITY_VALUES = Set.of("critical", "high", "medium", "low");
    private static final Set<String> STAGE_VALUES    = Set.of("open", "in_progress", "ready_to_test", "reopen", "done");

    @PostMapping("/jira")
    public ResponseEntity<?> importJira(
            @RequestParam("file") MultipartFile file,
            @RequestParam("product_id") Long productId,
            @AuthenticationPrincipal Object principal) {

        // Verify product exists
        List<Map<String, Object>> pRows = jdbc.queryForList(
            "SELECT id, code FROM products WHERE id = ?", productId
        );
        if (pRows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Produk tidak ditemukan"));
        }
        String productCode = (String) pRows.get(0).get("code");
        Long creatorId = currentUserId(principal);

        int created = 0, skipped = 0;
        List<String> errors = new ArrayList<>();

        try {
            Reader reader = csvReader(file);
            CSVParser parser = CSVFormat.DEFAULT
                .builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreHeaderCase(true)
                .setTrim(true)
                .build()
                .parse(reader);

            for (CSVRecord rec : parser) {
                try {
                    String jiraKey   = col(rec, "Issue key", "Key", "ID");
                    String summary   = col(rec, "Summary", "Title", "Issue summary");
                    if (summary.isBlank()) { skipped++; continue; }

                    String issueType = col(rec, "Issue Type", "Issue type", "Type");
                    String status    = col(rec, "Status");
                    String priority  = col(rec, "Priority");
                    String assignee  = col(rec, "Assignee");
                    String dueDate   = col(rec, "Due Date", "Due date");
                    String sprintName = col(rec, "Sprint");
                    String epicLink  = col(rec, "Epic Link", "Epic link");
                    String storyPtsStr = col(rec, "Story Points", "Story points", "Custom field (Story Points)", "Custom field (story_points)");
                    String description = col(rec, "Description");

                    // Build our item code: use Jira key if fits, else auto-generate
                    String itemCode;
                    if (!jiraKey.isBlank() && jiraKey.length() <= 20) {
                        itemCode = jiraKey;
                    } else {
                        itemCode = generateCode(productCode, productId);
                    }

                    // Check for duplicate
                    List<Map<String, Object>> existing = jdbc.queryForList(
                        "SELECT id FROM backlog_items WHERE product_id=? AND code=?",
                        productId, itemCode
                    );
                    if (!existing.isEmpty()) { skipped++; continue; }

                    int storyPoints = 0;
                    if (!storyPtsStr.isBlank()) {
                        try { storyPoints = (int) Double.parseDouble(storyPtsStr); } catch (Exception ignored) {}
                    }

                    Long assigneeId = null;
                    if (!assignee.isBlank()) {
                        List<Map<String, Object>> uRows = jdbc.queryForList(
                            "SELECT id FROM users WHERE name ILIKE ? OR email ILIKE ? LIMIT 1",
                            assignee, assignee
                        );
                        if (!uRows.isEmpty()) assigneeId = toLong(uRows.get(0).get("id"));
                    }

                    Long sprintId = null;
                    if (!sprintName.isBlank()) {
                        List<Map<String, Object>> sRows = jdbc.queryForList(
                            "SELECT id FROM sprints WHERE product_id=? AND name ILIKE ? LIMIT 1",
                            productId, sprintName
                        );
                        if (!sRows.isEmpty()) sprintId = toLong(sRows.get(0).get("id"));
                    }

                    Long epicId = null;
                    if (!epicLink.isBlank()) {
                        List<Map<String, Object>> eRows = jdbc.queryForList(
                            "SELECT id FROM epics WHERE product_id=? AND code ILIKE ? LIMIT 1",
                            productId, epicLink
                        );
                        if (!eRows.isEmpty()) epicId = toLong(eRows.get(0).get("id"));
                    }

                    java.sql.Date deadline = null;
                    if (!dueDate.isBlank()) {
                        try {
                            String d = dueDate.length() > 10 ? dueDate.substring(0, 10) : dueDate;
                            deadline = java.sql.Date.valueOf(d);
                        } catch (Exception ignored) {}
                    }

                    jdbc.update(
                        "INSERT INTO backlog_items " +
                        "(product_id, code, title, type, priority, story_points, status, " +
                        "sprint_id, assignee_id, epic_id, notes, deadline, created_by) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        productId, itemCode, summary,
                        mapType(issueType),
                        mapPriority(priority),
                        storyPoints,
                        mapStatus(status),
                        sprintId, assigneeId, epicId,
                        description.isBlank() ? null : description,
                        deadline,
                        creatorId
                    );
                    created++;

                } catch (Exception rowErr) {
                    errors.add("Baris " + rec.getRecordNumber() + ": " + rowErr.getMessage());
                }
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Gagal membaca CSV: " + e.getMessage()));
        }

        return ResponseEntity.ok(Map.of(
            "created", created,
            "skipped", skipped,
            "errors",  errors
        ));
    }

    // ─── Bugs Incident CSV import ────────────────────────────────────────────
    // Column format matches the "Export CSV" button on the Bugs tab of
    // BugsIncident.jsx, so an unmodified export can be re-imported as a no-op
    // (every row skipped as a duplicate `code`) and a lightly-edited export
    // (blanked codes, changed fields) creates only the new/changed rows.

    @PostMapping("/bugs")
    public ResponseEntity<?> importBugs(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Object principal) {

        if (!bugHelper.canAccess(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke modul Bugs Incident"));
        }

        int created = 0, skipped = 0;
        List<String> errors = new ArrayList<>();

        try {
            Reader reader = csvReader(file);
            CSVParser parser = CSVFormat.DEFAULT
                .builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreHeaderCase(true)
                .setTrim(true)
                .build()
                .parse(reader);

            for (CSVRecord rec : parser) {
                try {
                    String title = col(rec, "Judul", "Title");
                    if (title.isBlank()) { skipped++; continue; }

                    String produk = col(rec, "Produk", "Product");
                    if (produk.isBlank()) {
                        errors.add("Baris " + rec.getRecordNumber() + ": kolom Produk kosong");
                        continue;
                    }
                    List<Map<String, Object>> prodRows = jdbc.queryForList(
                        "SELECT id, code FROM products WHERE code ILIKE ? OR name ILIKE ? LIMIT 1",
                        produk, produk
                    );
                    if (prodRows.isEmpty()) {
                        errors.add("Baris " + rec.getRecordNumber() + ": produk '" + produk + "' tidak ditemukan");
                        continue;
                    }
                    Long productId   = toLong(prodRows.get(0).get("id"));
                    String productCode = (String) prodRows.get(0).get("code");

                    String code = col(rec, "Kode", "Code");
                    if (code.isBlank()) {
                        code = generateBugCode(productCode, productId);
                    } else {
                        List<Map<String, Object>> existing = jdbc.queryForList(
                            "SELECT id FROM bugs WHERE product_id=? AND code=?", productId, code
                        );
                        if (!existing.isEmpty()) { skipped++; continue; }
                    }

                    String description = col(rec, "Deskripsi", "Description");
                    String steps        = col(rec, "Langkah Reproduksi", "Steps to Reproduce");
                    String severity     = normalizeEnum(col(rec, "Severity"), SEVERITY_VALUES, "medium");
                    String priority     = normalizeEnum(col(rec, "Prioritas", "Priority"), SEVERITY_VALUES, "medium");
                    String stage        = normalizeEnum(col(rec, "Stage"), STAGE_VALUES, "open");

                    Long backlogItemId = null;
                    String backlogCol = col(rec, "Backlog Item");
                    if (!backlogCol.isBlank()) {
                        Matcher bm = Pattern.compile("^\\[(.+?)\\]").matcher(backlogCol);
                        if (bm.find()) {
                            List<Map<String, Object>> biRows = jdbc.queryForList(
                                "SELECT id FROM backlog_items WHERE product_id=? AND code=?",
                                productId, bm.group(1).trim()
                            );
                            if (!biRows.isEmpty()) backlogItemId = toLong(biRows.get(0).get("id"));
                        }
                    }

                    Long assignedTo = resolveUser(col(rec, "Assigned To", "Assignee"));

                    String reportedByRaw = col(rec, "Reported By", "Incident Author");
                    Long reportedBy = resolveUser(reportedByRaw);
                    String reporterName = (reportedBy == null && !reportedByRaw.isBlank()) ? reportedByRaw : null;

                    Timestamp createdAt = parseDate(col(rec, "Tanggal Incident"));
                    Timestamp closedAt  = parseDate(col(rec, "Tanggal Closed"));

                    Map<String, Object> row = jdbc.queryForMap(
                        "INSERT INTO bugs " +
                        "(backlog_item_id, product_id, code, title, description, steps_to_reproduce, severity, priority, stage, reported_by, reporter_name, assigned_to, created_at, closed_at) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?, COALESCE(?::timestamp, NOW()), ?) RETURNING id",
                        backlogItemId, productId, code, title,
                        description.isBlank() ? null : description,
                        steps.isBlank() ? null : steps,
                        severity, priority, stage,
                        reportedBy, reporterName, assignedTo,
                        createdAt, closedAt
                    );

                    Long newId = toLong(row.get("id"));
                    assigneeSupport.sync("bug_assignees", "bug_id", newId, assignedTo, new ArrayList<>());
                    created++;

                } catch (Exception rowErr) {
                    errors.add("Baris " + rec.getRecordNumber() + ": " + rowErr.getMessage());
                }
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Gagal membaca CSV: " + e.getMessage()));
        }

        return ResponseEntity.ok(Map.of(
            "created", created,
            "skipped", skipped,
            "errors",  errors
        ));
    }

    private String normalizeEnum(String value, Set<String> allowed, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String v = value.trim().toLowerCase().replace(" ", "_");
        return allowed.contains(v) ? v : fallback;
    }

    private Long resolveUser(String value) {
        if (value == null || value.isBlank()) return null;
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM users WHERE name ILIKE ? OR email ILIKE ? LIMIT 1", value, value
        );
        return rows.isEmpty() ? null : toLong(rows.get(0).get("id"));
    }

    private Timestamp parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        try {
            return Timestamp.valueOf(LocalDateTime.parse(v, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        } catch (Exception ignored) {}
        try {
            return Timestamp.valueOf(LocalDate.parse(v, DateTimeFormatter.ofPattern("yyyy-MM-dd")).atStartOfDay());
        } catch (Exception ignored) {}
        return null;
    }

    private String generateBugCode(String productCode, Long productId) {
        List<Map<String, Object>> last = jdbc.queryForList(
            "SELECT code FROM bugs WHERE product_id=? AND code LIKE ? " +
            "ORDER BY CAST(SUBSTRING(code FROM '\\d+$') AS INTEGER) DESC LIMIT 1",
            productId, productCode + "-%"
        );
        int lastNum = 0;
        if (!last.isEmpty()) {
            String lastCode = (String) last.get(0).get("code");
            if (lastCode != null) {
                Matcher m = Pattern.compile("\\d+$").matcher(lastCode);
                if (m.find()) lastNum = Integer.parseInt(m.group());
            }
        }
        return productCode + "-" + String.format("%03d", lastNum + 1);
    }

    // ─── Jira field mappers ──────────────────────────────────────────────────

    private String mapType(String jiraType) {
        if (jiraType == null) return "story";
        switch (jiraType.toLowerCase()) {
            case "bug": return "bug";
            case "task": case "sub-task": case "subtask": return "task";
            case "epic": return "epic";
            default: return "story";
        }
    }

    private String mapPriority(String p) {
        if (p == null) return "medium";
        switch (p.toLowerCase()) {
            case "highest": case "critical": return "critical";
            case "high": return "high";
            case "low": case "lowest": return "low";
            default: return "medium";
        }
    }

    private String mapStatus(String s) {
        if (s == null) return "backlog";
        switch (s.toLowerCase().replace(" ", "_")) {
            case "to_do": case "todo": case "open": case "new": return "todo";
            case "in_progress": case "in_progress_": return "in_progress";
            case "in_review": case "code_review": return "in_review";
            case "done": case "closed": case "resolved": return "done";
            case "blocked": case "impediment": return "blocked";
            default: return "backlog";
        }
    }

    // Excel/frontend-exported CSVs are commonly saved with a UTF-8 BOM (the
    // export button here does this deliberately, `'﻿' + csv`, so Excel
    // reads the encoding correctly). Left as-is, the BOM sticks to the first
    // header cell ("﻿Kode" instead of "Kode"), which silently breaks
    // header-name lookups for just that one column. Strip it before parsing.
    private Reader csvReader(MultipartFile file) throws IOException {
        InputStream is = file.getInputStream();
        PushbackInputStream pis = new PushbackInputStream(is, 3);
        byte[] head = new byte[3];
        int n = pis.read(head, 0, 3);
        boolean hasBom = n == 3 && (head[0] & 0xFF) == 0xEF && (head[1] & 0xFF) == 0xBB && (head[2] & 0xFF) == 0xBF;
        if (!hasBom && n > 0) {
            pis.unread(head, 0, n);
        }
        return new InputStreamReader(pis, StandardCharsets.UTF_8);
    }

    // Returns first non-blank value from tried header names
    private String col(CSVRecord rec, String... headers) {
        for (String h : headers) {
            try {
                if (rec.isMapped(h)) {
                    String v = rec.get(h);
                    if (v != null && !v.isBlank()) return v.trim();
                }
            } catch (Exception ignored) {}
        }
        return "";
    }

    private String generateCode(String productCode, Long productId) {
        List<Map<String, Object>> last = jdbc.queryForList(
            "SELECT code FROM backlog_items WHERE product_id=? AND code LIKE ? " +
            "ORDER BY CAST(SUBSTRING(code FROM '\\d+$') AS INTEGER) DESC LIMIT 1",
            productId, productCode + "-%"
        );
        int num = 0;
        if (!last.isEmpty()) {
            String lc = (String) last.get(0).get("code");
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+$").matcher(lc);
            if (m.find()) num = Integer.parseInt(m.group());
        }
        return productCode + "-" + String.format("%03d", num + 1);
    }

    @SuppressWarnings("unchecked")
    private Long currentUserId(Object principal) {
        if (!(principal instanceof Map)) return null;
        Object id = ((Map<String, Object>) principal).get("id");
        return toLong(id);
    }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }
}
