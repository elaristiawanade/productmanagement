package com.producttracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/qa")
public class QaController {

    @Autowired
    private JdbcTemplate jdbc;

    // ── TEST CASES ────────────────────────────────────────────────────────────

    @GetMapping("/test-cases")
    public ResponseEntity<?> listTestCases(
            @RequestParam(required = false) Long product_id,
            @RequestParam(required = false) Long backlog_item_id,
            @RequestParam(required = false) String status) {

        List<String> filters = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (product_id != null)      { filters.add("tc.product_id = ?");      params.add(product_id); }
        if (backlog_item_id != null) { filters.add("tc.backlog_item_id = ?"); params.add(backlog_item_id); }
        if (status != null)          { filters.add("tc.status = ?");          params.add(status); }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT tc.*, " +
            "  bi.code AS item_code, bi.title AS item_title, " +
            "  p.name AS product_name, p.code AS product_code, " +
            "  u.name AS created_by_name, " +
            "  COUNT(tr.id)                                      AS run_count, " +
            "  COUNT(CASE WHEN tr.result='pass'  THEN 1 END)     AS pass_count, " +
            "  COUNT(CASE WHEN tr.result='fail'  THEN 1 END)     AS fail_count, " +
            "  MAX(tr.executed_at)                               AS last_run " +
            "FROM qa_test_cases tc " +
            "LEFT JOIN backlog_items bi ON bi.id = tc.backlog_item_id " +
            "LEFT JOIN products      p  ON p.id  = tc.product_id " +
            "LEFT JOIN users         u  ON u.id  = tc.created_by " +
            "LEFT JOIN qa_test_runs  tr ON tr.test_case_id = tc.id " +
            where +
            "GROUP BY tc.id, bi.code, bi.title, p.name, p.code, u.name " +
            "ORDER BY tc.product_id, tc.code",
            params.toArray());
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/test-cases")
    public ResponseEntity<?> createTestCase(@AuthenticationPrincipal Object principal,
                                             @RequestBody Map<String, Object> body) {
        if (body.get("backlog_item_id") == null || body.get("title") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "backlog_item_id dan title wajib"));
        }

        String tcCode = (String) body.get("code");
        if (tcCode == null || tcCode.isBlank()) {
            Long productId = toLong(body.get("product_id"));
            List<Map<String, Object>> last = jdbc.queryForList(
                "SELECT code FROM qa_test_cases WHERE product_id=? ORDER BY id DESC LIMIT 1", productId
            );
            int lastNum = 0;
            if (!last.isEmpty()) {
                String lastCode = (String) last.get(0).get("code");
                if (lastCode != null) {
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+$").matcher(lastCode);
                    if (m.find()) lastNum = Integer.parseInt(m.group());
                }
            }
            tcCode = "TC-" + String.format("%03d", lastNum + 1);
        }

        Map<String, Object> user = toMap(principal);
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO qa_test_cases " +
                "(backlog_item_id, product_id, code, title, description, steps, expected_result, status, priority, created_by) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING *",
                toLong(body.get("backlog_item_id")), toLong(body.get("product_id")), tcCode,
                body.get("title"), body.get("description"),
                body.get("steps"), body.get("expected_result"),
                orDefault(body.get("status"), "draft"),
                orDefault(body.get("priority"), "medium"),
                user != null ? user.get("id") : null
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/test-cases/{id}")
    public ResponseEntity<?> updateTestCase(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        int updated = jdbc.update(
            "UPDATE qa_test_cases SET title=?,description=?,steps=?,expected_result=?,status=?,priority=? WHERE id=?",
            body.get("title"), body.get("description"),
            body.get("steps"), body.get("expected_result"),
            body.get("status"), body.get("priority"), id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Test case tidak ditemukan"));
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM qa_test_cases WHERE id=?", id);
        return ResponseEntity.ok(row);
    }

    @DeleteMapping("/test-cases/{id}")
    public ResponseEntity<?> deleteTestCase(@PathVariable Long id) {
        int deleted = jdbc.update("DELETE FROM qa_test_cases WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Test case tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Test case dihapus"));
    }

    // ── TEST RUNS ─────────────────────────────────────────────────────────────

    @GetMapping("/test-runs")
    public ResponseEntity<?> listTestRuns(
            @RequestParam(required = false) Long sprint_id,
            @RequestParam(required = false) Long test_case_id,
            @RequestParam(required = false) Long product_id) {

        List<String> filters = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (sprint_id != null)    { filters.add("tr.sprint_id = ?");    params.add(sprint_id); }
        if (test_case_id != null) { filters.add("tr.test_case_id = ?"); params.add(test_case_id); }
        if (product_id != null)   { filters.add("tc.product_id = ?");   params.add(product_id); }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT tr.*, tc.code AS tc_code, tc.title AS tc_title, " +
            "  bi.code AS item_code, bi.title AS item_title, " +
            "  u.name AS tester_name, s.name AS sprint_name " +
            "FROM qa_test_runs tr " +
            "JOIN qa_test_cases tc ON tc.id = tr.test_case_id " +
            "JOIN backlog_items bi ON bi.id = tc.backlog_item_id " +
            "LEFT JOIN users   u   ON u.id  = tr.tester_id " +
            "LEFT JOIN sprints s   ON s.id  = tr.sprint_id " +
            where +
            "ORDER BY tr.created_at DESC",
            params.toArray());
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/test-runs")
    public ResponseEntity<?> createTestRun(@AuthenticationPrincipal Object principal,
                                            @RequestBody Map<String, Object> body) {
        if (body.get("test_case_id") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "test_case_id wajib"));
        }
        Map<String, Object> user = toMap(principal);
        String result = (String) orDefault(body.get("result"), "pending");
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO qa_test_runs (test_case_id, sprint_id, tester_id, result, notes, bug_reference, executed_at) " +
                "VALUES (?,?,?,?,?,?,?) RETURNING *",
                toLong(body.get("test_case_id")),
                toLong(body.get("sprint_id")),
                user != null ? user.get("id") : null,
                result,
                body.get("notes"),
                body.get("bug_reference"),
                "pending".equals(result) ? null : new java.util.Date()
            );
            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/test-runs/{id}")
    public ResponseEntity<?> updateTestRun(@PathVariable Long id,
                                            @AuthenticationPrincipal Object principal,
                                            @RequestBody Map<String, Object> body) {
        Map<String, Object> user = toMap(principal);
        String result = (String) body.get("result");
        int updated = jdbc.update(
            "UPDATE qa_test_runs SET result=?,notes=?,bug_reference=?,executed_at=?,tester_id=? WHERE id=?",
            result,
            body.get("notes"),
            body.get("bug_reference"),
            "pending".equals(result) ? null : new java.util.Date(),
            user != null ? user.get("id") : null,
            id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Test run tidak ditemukan"));
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM qa_test_runs WHERE id=?", id);
        return ResponseEntity.ok(row);
    }

    // ── QA DASHBOARD ──────────────────────────────────────────────────────────

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard(@RequestParam(required = false) Long product_id) {
        String productFilter = product_id != null ? "AND tc.product_id = ?" : "";
        Object[] params = product_id != null ? new Object[]{product_id} : new Object[]{};

        Map<String, Object> summary = jdbc.queryForMap(
            "SELECT " +
            "  COUNT(DISTINCT tc.id)                                           AS total_cases, " +
            "  COUNT(DISTINCT CASE WHEN tc.status='active' THEN tc.id END)     AS active_cases, " +
            "  COUNT(tr.id)                                                    AS total_runs, " +
            "  COUNT(CASE WHEN tr.result='pass'    THEN 1 END)                 AS pass_count, " +
            "  COUNT(CASE WHEN tr.result='fail'    THEN 1 END)                 AS fail_count, " +
            "  COUNT(CASE WHEN tr.result='blocked' THEN 1 END)                 AS blocked_count, " +
            "  COUNT(CASE WHEN tr.result='pending' THEN 1 END)                 AS pending_count, " +
            "  ROUND(100.0 * COUNT(CASE WHEN tr.result='pass' THEN 1 END) / " +
            "    NULLIF(COUNT(CASE WHEN tr.result IN('pass','fail') THEN 1 END), 0), 1) AS pass_rate " +
            "FROM qa_test_cases tc " +
            "LEFT JOIN qa_test_runs tr ON tr.test_case_id = tc.id " +
            "WHERE 1=1 " + productFilter,
            params
        );

        List<Map<String, Object>> byProduct = jdbc.queryForList(
            "SELECT p.name AS product, p.color, " +
            "  COUNT(DISTINCT tc.id)                               AS total_cases, " +
            "  COUNT(CASE WHEN tr.result='pass' THEN 1 END)        AS pass_count, " +
            "  COUNT(CASE WHEN tr.result='fail' THEN 1 END)        AS fail_count " +
            "FROM products p " +
            "LEFT JOIN qa_test_cases tc ON tc.product_id = p.id " +
            "LEFT JOIN qa_test_runs  tr ON tr.test_case_id = tc.id " +
            "GROUP BY p.id, p.name, p.color " +
            "ORDER BY p.id");

        List<Map<String, Object>> bySprint = jdbc.queryForList(
            "SELECT s.name AS sprint, s.product_id, " +
            "  COUNT(CASE WHEN tr.result='pass'    THEN 1 END) AS pass_count, " +
            "  COUNT(CASE WHEN tr.result='fail'    THEN 1 END) AS fail_count, " +
            "  COUNT(CASE WHEN tr.result='blocked' THEN 1 END) AS blocked_count " +
            "FROM sprints s " +
            "LEFT JOIN qa_test_runs tr ON tr.sprint_id = s.id " +
            "GROUP BY s.id, s.name, s.product_id " +
            "ORDER BY s.start_date NULLS LAST " +
            "LIMIT 12");

        List<Map<String, Object>> recentFails = jdbc.queryForList(
            "SELECT tr.id, tr.result, tr.notes, tr.bug_reference, tr.executed_at, " +
            "  tc.code AS tc_code, tc.title AS tc_title, " +
            "  bi.code AS item_code, bi.title AS item_title, " +
            "  p.name AS product, u.name AS tester " +
            "FROM qa_test_runs tr " +
            "JOIN qa_test_cases tc ON tc.id = tr.test_case_id " +
            "JOIN backlog_items bi ON bi.id = tc.backlog_item_id " +
            "JOIN products      p  ON p.id  = tc.product_id " +
            "LEFT JOIN users    u  ON u.id  = tr.tester_id " +
            "WHERE tr.result = 'fail' " +
            "ORDER BY tr.executed_at DESC NULLS LAST " +
            "LIMIT 10");

        return ResponseEntity.ok(Map.of(
            "summary", summary,
            "byProduct", byProduct,
            "bySprint", bySprint,
            "recentFails", recentFails
        ));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
    }

    private Object orDefault(Object v, Object d) {
        return v != null ? v : d;
    }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        return Long.parseLong(v.toString());
    }
}
