package com.producttracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import org.w3c.dom.*;
import javax.xml.parsers.*;
import java.util.zip.*;

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

        // Default: show own standups. Manager may filter to another user via user_id param.
        Long filterUserId = (isManagerOrAbove && user_id != null) ? user_id : actorId;
        sql.append(" AND s.user_id = ?");
        params.add(filterUserId);
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

    // ─── IMPORT CSV / XLSX ───────────────────────────────────────────────

    // Column aliases: key = canonical name, values = accepted header names (lowercase)
    private static final Map<String, List<String>> COL_ALIASES = new LinkedHashMap<>();
    static {
        COL_ALIASES.put("email",        List.of("email"));
        COL_ALIASES.put("standup_date", List.of("standup_date", "date", "tanggal", "standup date", "tgl",
                                                 "standup meeting date", "meeting date"));
        COL_ALIASES.put("yesterday",    List.of("yesterday", "kemarin", "hari kemarin", "aktivitas kemarin",
                                                 "task yang dilakukan kemarin"));
        COL_ALIASES.put("today",        List.of("today", "hari ini", "rencana hari ini", "aktivitas hari ini",
                                                 "task yang akan dilakukan hari ini"));
        COL_ALIASES.put("has_blocker",  List.of("has_blocker", "blocker?", "ada blocker", "hambatan?", "ada hambatan"));
        COL_ALIASES.put("blocker",      List.of("blocker", "hambatan", "kendala",
                                                 "apa yang diperlukan untuk menghilangkan blocker:"));
        COL_ALIASES.put("blocker_plan", List.of("blocker_plan", "rencana", "solusi", "rencana atasi blocker",
                                                 "estimasi penyelesaian task"));
    }

    @PostMapping("/import")
    public ResponseEntity<?> importFile(@AuthenticationPrincipal Object principal,
                                        @RequestParam("file") MultipartFile file) {
        Map<String, Object> actor = toMap(principal);
        if (actor == null) return ResponseEntity.status(401).build();
        if (!isManagerOrAbove(actor)) {
            return ResponseEntity.status(403).body(Map.of("error", "Hanya manager ke atas yang bisa import data"));
        }
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File tidak boleh kosong"));
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<String[]> rows;
        try {
            if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
                rows = parseXlsx(file);
            } else {
                rows = parseCsvRows(file);
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "Gagal membaca file [" + e.getClass().getSimpleName() + "]: " + e.getMessage(),
                "filename", filename,
                "size", file.getSize()
            ));
        }

        if (rows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File kosong atau tidak memiliki data"));
        }

        // Find first non-blank row as header (some xlsx have empty rows before header)
        int headerRowIdx = -1;
        for (int i = 0; i < rows.size(); i++) {
            if (!Arrays.stream(rows.get(i)).allMatch(c -> c == null || c.isBlank())) {
                headerRowIdx = i; break;
            }
        }
        if (headerRowIdx < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "File kosong atau tidak memiliki data"));
        }

        // Build column index from header row using aliases
        String[] headers = rows.get(headerRowIdx);
        Map<String, Integer> colIdx = new LinkedHashMap<>();
        for (int i = 0; i < headers.length; i++) {
            String h = headers[i].trim().toLowerCase();
            for (Map.Entry<String, List<String>> entry : COL_ALIASES.entrySet()) {
                if (entry.getValue().contains(h) && !colIdx.containsKey(entry.getKey())) {
                    colIdx.put(entry.getKey(), i);
                }
            }
        }

        List<String> required = List.of("standup_date", "email", "yesterday", "today");
        List<String> missing = required.stream().filter(r -> !colIdx.containsKey(r)).collect(Collectors.toList());
        if (!missing.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Kolom wajib tidak ditemukan: " + String.join(", ", missing) +
                         ". Pastikan header sesuai template."
            ));
        }

        int imported = 0, skipped = 0, errors = 0;
        List<String> errorDetails = new ArrayList<>();

        for (int rowNum = headerRowIdx + 1; rowNum < rows.size(); rowNum++) {
            String[] cols = rows.get(rowNum);
            // skip blank rows
            if (Arrays.stream(cols).allMatch(c -> c == null || c.isBlank())) continue;

            try {
                String email       = getCol(cols, colIdx, "email");
                String dateStr     = getCol(cols, colIdx, "standup_date");
                String yesterday   = getCol(cols, colIdx, "yesterday");
                String today       = getCol(cols, colIdx, "today");
                String hasBlockerS = getCol(cols, colIdx, "has_blocker");
                String blocker     = getCol(cols, colIdx, "blocker");
                String blockerPlan = getCol(cols, colIdx, "blocker_plan");

                if (email.isBlank() || dateStr.isBlank() || yesterday.isBlank() || today.isBlank()) {
                    errorDetails.add("Baris " + (rowNum + 1) + ": kolom wajib (email/tanggal/yesterday/today) kosong");
                    errors++; continue;
                }

                List<Map<String, Object>> userRows = jdbc.queryForList(
                    "SELECT id FROM users WHERE LOWER(email) = ?", email.toLowerCase().trim());
                if (userRows.isEmpty()) {
                    errorDetails.add("Baris " + (rowNum + 1) + ": email tidak ditemukan → " + email);
                    errors++; continue;
                }
                Long userId = toLong(userRows.get(0).get("id"));

                java.sql.Date standupDate;
                try { standupDate = java.sql.Date.valueOf(dateStr.trim().substring(0, 10)); }
                catch (Exception e) {
                    try {
                        // Excel date serial number
                        long serial = Long.parseLong(dateStr.trim());
                        standupDate = java.sql.Date.valueOf(LocalDate.of(1899, 12, 30).plusDays(serial));
                    } catch (Exception e2) {
                        errorDetails.add("Baris " + (rowNum + 1) + ": format tanggal tidak valid → " + dateStr);
                        errors++; continue;
                    }
                }

                Long cnt = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM standups WHERE user_id=? AND standup_date=?",
                    Long.class, userId, standupDate);
                if (cnt != null && cnt > 0) { skipped++; continue; }

                boolean hasBlocker = "true".equalsIgnoreCase(hasBlockerS.trim())
                    || "1".equals(hasBlockerS.trim())
                    || "yes".equalsIgnoreCase(hasBlockerS.trim())
                    || "ya".equalsIgnoreCase(hasBlockerS.trim());

                jdbc.update(
                    "INSERT INTO standups (user_id, standup_date, yesterday, today, has_blocker, blocker, blocker_plan) " +
                    "VALUES (?,?,?,?,?,?,?)",
                    userId, standupDate, yesterday, today, hasBlocker,
                    hasBlocker && !blocker.isBlank()     ? blocker     : null,
                    hasBlocker && !blockerPlan.isBlank() ? blockerPlan : null);
                imported++;

            } catch (Exception e) {
                errorDetails.add("Baris " + (rowNum + 1) + ": " + (e.getMessage() != null ? e.getMessage() : "error tidak diketahui"));
                errors++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", imported);
        result.put("skipped",  skipped);
        result.put("errors",   errors);
        if (!errorDetails.isEmpty()) result.put("error_details", errorDetails);
        return ResponseEntity.ok(result);
    }

    private List<String[]> parseCsvRows(MultipartFile file) throws Exception {
        List<String[]> rows = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line = br.readLine();
            if (line == null) return rows;
            if (line.startsWith("﻿")) line = line.substring(1); // strip BOM
            rows.add(parseCsvLine(line));
            while ((line = br.readLine()) != null) {
                if (!line.isBlank()) rows.add(parseCsvLine(line));
            }
        }
        return rows;
    }

    private List<String[]> parseXlsx(MultipartFile file) throws Exception {
        byte[] data = file.getBytes();
        Map<String, byte[]> zipEntries = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new java.io.ByteArrayInputStream(data))) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                String name = ze.getName();
                if (name.equals("xl/sharedStrings.xml") || name.startsWith("xl/worksheets/sheet")) {
                    zipEntries.put(name, zis.readAllBytes());
                }
            }
        }

        List<String> sharedStrings = new ArrayList<>();
        byte[] ssBytes = zipEntries.get("xl/sharedStrings.xml");
        if (ssBytes != null) sharedStrings = parseSharedStrings(ssBytes);

        byte[] sheetBytes = zipEntries.get("xl/worksheets/sheet1.xml");
        if (sheetBytes == null) {
            for (Map.Entry<String, byte[]> e : zipEntries.entrySet()) {
                if (e.getKey().startsWith("xl/worksheets/")) { sheetBytes = e.getValue(); break; }
            }
        }
        if (sheetBytes == null) throw new Exception("Tidak ditemukan sheet di file xlsx");
        return parseXlsxSheet(sheetBytes, sharedStrings);
    }

    private List<String> parseSharedStrings(byte[] data) throws Exception {
        List<String> result = new ArrayList<>();
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(false);
        Document doc = dbf.newDocumentBuilder().parse(new java.io.ByteArrayInputStream(data));
        NodeList siNodes = doc.getElementsByTagName("si");
        for (int i = 0; i < siNodes.getLength(); i++) {
            NodeList tNodes = ((Element) siNodes.item(i)).getElementsByTagName("t");
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < tNodes.getLength(); j++) sb.append(tNodes.item(j).getTextContent());
            result.add(sb.toString());
        }
        return result;
    }

    private List<String[]> parseXlsxSheet(byte[] data, List<String> sharedStrings) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(false);
        Document doc = dbf.newDocumentBuilder().parse(new java.io.ByteArrayInputStream(data));
        NodeList rowNodes = doc.getElementsByTagName("row");

        int maxCol = 0;
        for (int i = 0; i < rowNodes.getLength(); i++) {
            NodeList cells = ((Element) rowNodes.item(i)).getElementsByTagName("c");
            for (int j = 0; j < cells.getLength(); j++) {
                int col = xlsxColToIndex(((Element) cells.item(j)).getAttribute("r")) + 1;
                if (col > maxCol) maxCol = col;
            }
        }

        List<String[]> rows = new ArrayList<>();
        for (int i = 0; i < rowNodes.getLength(); i++) {
            String[] rowData = new String[maxCol];
            Arrays.fill(rowData, "");
            NodeList cells = ((Element) rowNodes.item(i)).getElementsByTagName("c");
            for (int j = 0; j < cells.getLength(); j++) {
                Element cell = (Element) cells.item(j);
                int col = xlsxColToIndex(cell.getAttribute("r"));
                if (col < 0 || col >= maxCol) continue;

                String type = cell.getAttribute("t");
                NodeList vNodes = cell.getElementsByTagName("v");
                String raw = vNodes.getLength() > 0 ? vNodes.item(0).getTextContent().trim() : "";

                String value;
                if ("s".equals(type)) {
                    try {
                        int idx = Integer.parseInt(raw);
                        value = idx >= 0 && idx < sharedStrings.size() ? sharedStrings.get(idx) : "";
                    } catch (NumberFormatException e) { value = raw; }
                } else if ("inlineStr".equals(type)) {
                    NodeList tNodes = cell.getElementsByTagName("t");
                    StringBuilder sb = new StringBuilder();
                    for (int k = 0; k < tNodes.getLength(); k++) sb.append(tNodes.item(k).getTextContent());
                    value = sb.toString();
                } else if ("b".equals(type)) {
                    value = "1".equals(raw) ? "true" : "false";
                } else {
                    if (raw.isEmpty()) { value = ""; }
                    else {
                        try {
                            double num = Double.parseDouble(raw);
                            // Excel date serial: has style attr, looks like a date range
                            if (!cell.getAttribute("s").isEmpty() && num >= 25569 && num < 60000 && num == Math.floor(num)) {
                                value = LocalDate.of(1899, 12, 30).plusDays((long) num).toString();
                            } else if (num == Math.floor(num)) {
                                value = String.valueOf((long) num);
                            } else { value = raw; }
                        } catch (NumberFormatException e) { value = raw; }
                    }
                }
                rowData[col] = value;
            }
            rows.add(rowData);
        }
        return rows;
    }

    private int xlsxColToIndex(String cellRef) {
        int col = 0;
        for (char c : cellRef.toCharArray()) {
            if (!Character.isLetter(c)) break;
            col = col * 26 + (c - 'A' + 1);
        }
        return col - 1;
    }

    /** Parses a single CSV line respecting double-quoted fields (including embedded commas). */
    private String[] parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        boolean inQuote = false;
        StringBuilder cur = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuote && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"'); i++;
                } else { inQuote = !inQuote; }
            } else if (c == ',' && !inQuote) {
                fields.add(cur.toString()); cur = new StringBuilder();
            } else { cur.append(c); }
        }
        fields.add(cur.toString());
        return fields.toArray(new String[0]);
    }

    private String getCol(String[] cols, Map<String, Integer> idx, String name) {
        Integer i = idx.get(name);
        if (i == null || i >= cols.length) return "";
        return cols[i] == null ? "" : cols[i].trim().replaceAll("^\"|\"$", "");
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
