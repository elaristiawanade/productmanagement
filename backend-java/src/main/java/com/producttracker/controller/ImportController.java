package com.producttracker.controller;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/import")
public class ImportController {

    @Autowired
    private JdbcTemplate jdbc;

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
            Reader reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8);
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
