package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import com.producttracker.service.AssigneeSupport;
import com.producttracker.service.BugStats;
import com.producttracker.service.EmailService;
import com.producttracker.service.ProgressSupport;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/qa")
public class QaController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private BugStats bugStats;

    @Autowired
    private AssigneeSupport assigneeSupport;

    @Autowired
    private EmailService email;

    @Autowired
    private TransactionTemplate tx;

    /** Join table of a test case's assignees (migration_v35); the first pick is flagged is_primary. */
    private static final String ASSIGNEES = "qa_test_case_assignees";
    private static final String ASSIGNEES_FK = "test_case_id";

    /**
     * Test case statuses since migration_v35, in workflow order: the names of a Backlog card's statuses
     * (todo / in_progress / in_review), with Draft before and Finish at the end.
     */
    public static final List<String> STATUSES = List.of("draft", "todo", "in_progress", "in_review", "finish");

    /** The statuses before v35, still accepted from a browser running the previous frontend bundle and from Import CSV. */
    private static final Map<String, String> LEGACY_STATUS = Map.of("active", "todo", "deprecated", "finish");

    /**
     * The status code for a value from the form, the API or Import CSV: a code ("in_progress"), its label
     * ("In Progress", "To Do", "Finish"; "Done" is read as Finish), or a status from before v35 (active → todo,
     * deprecated → finish). null when the value is not a test case status.
     */
    public static String toStatus(String raw) {
        if (raw == null) return null;
        String v = raw.trim().toLowerCase().replace('-', '_').replace(' ', '_');
        if (v.equals("to_do")) v = "todo";
        if (v.equals("done") || v.equals("finished")) v = "finish";
        v = LEGACY_STATUS.getOrDefault(v, v);
        return STATUSES.contains(v) ? v : null;
    }

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
        if (status != null) {
            String code = toStatus(status);
            filters.add("tc.status = ?");
            params.add(code != null ? code : status);
        }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT tc.*, " +
            "  bi.code AS item_code, bi.title AS item_title, " +
            "  p.name AS product_name, p.code AS product_code, " +
            "  f.code AS feature_code, f.name AS feature_name, " +
            "  u.name AS created_by_name, " +
            "  COUNT(tr.id)                                      AS run_count, " +
            "  COUNT(CASE WHEN tr.result='pass'  THEN 1 END)     AS pass_count, " +
            "  COUNT(CASE WHEN tr.result='fail'  THEN 1 END)     AS fail_count, " +
            "  MAX(tr.executed_at)                               AS last_run, " +
            "  (SELECT r.result FROM qa_test_runs r WHERE r.test_case_id = tc.id " +
            "     ORDER BY COALESCE(r.executed_at, r.created_at) DESC, r.id DESC LIMIT 1) AS last_result, " +
            "  " + assigneeSupport.assigneesJsonSelect(ASSIGNEES, ASSIGNEES_FK, "tc") + " " +
            "FROM qa_test_cases tc " +
            "LEFT JOIN backlog_items bi ON bi.id = tc.backlog_item_id " +
            "LEFT JOIN products      p  ON p.id  = tc.product_id " +
            "LEFT JOIN features      f  ON f.id  = tc.feature_id " +
            "LEFT JOIN users         u  ON u.id  = tc.created_by " +
            "LEFT JOIN qa_test_runs  tr ON tr.test_case_id = tc.id " +
            where +
            "GROUP BY tc.id, bi.code, bi.title, p.name, p.code, f.code, f.name, u.name " +
            "ORDER BY tc.product_id, tc.code",
            params.toArray());
        assigneeSupport.enrich(rows);
        // Progress is derived from the latest test run, not from the status
        for (Map<String, Object> r : rows) r.put("progress", ProgressSupport.testCasePct(r.get("status"), r.get("last_result")));
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/test-cases")
    public ResponseEntity<?> createTestCase(@AuthenticationPrincipal Object principal,
                                             @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "qa", "create")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk membuat test case"));
        }
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

        Long featureId = toLong(body.get("feature_id"));
        if (!featureMatchesProduct(featureId, toLong(body.get("product_id")))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Feature tidak sesuai dengan produk yang dipilih"));
        }
        java.sql.Date deadline;
        try { deadline = toSqlDate(body.get("deadline")); }
        catch (IllegalArgumentException e) { return invalidDeadline(); }
        // A new test case starts as Draft unless the form picked another status
        String rawStatus = str(body.get("status")).trim();
        String status = rawStatus.isEmpty() ? "draft" : toStatus(rawStatus);
        if (status == null) return invalidStatus();
        // Assignees: the first pick (assigned_to) is the primary one, the rest come as additional_assignee_ids (same as Bugs)
        Long primaryId = toLong(body.get("assigned_to"));
        List<Long> additionalIds = assigneeSupport.parseIdList(body.get("additional_assignee_ids"));
        if (!usersExist(primaryId, additionalIds)) return invalidAssignee();

        Map<String, Object> user = toMap(principal);
        Long actorId = user != null ? toLong(user.get("id")) : null;
        final String code = tcCode;
        Long newId;
        try {
            // Test case and its assignees in one transaction: a failed assignee write leaves no half-made test case
            newId = tx.execute(st -> {
                Long id = jdbc.queryForObject(
                    "INSERT INTO qa_test_cases " +
                    "(backlog_item_id, product_id, feature_id, code, title, description, steps, expected_result, status, priority, created_by, deadline) " +
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id", Long.class,
                    toLong(body.get("backlog_item_id")), toLong(body.get("product_id")), featureId, code,
                    body.get("title"), body.get("description"),
                    body.get("steps"), body.get("expected_result"),
                    status,
                    orDefault(body.get("priority"), "medium"),
                    actorId,
                    deadline
                );
                assigneeSupport.sync(ASSIGNEES, ASSIGNEES_FK, id, primaryId, additionalIds);
                return id;
            });
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }

        Map<String, Object> detail = testCaseDetail(newId);
        if (detail == null) return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        notifyAssignees(detail, actorId, actorName(user));
        return ResponseEntity.status(201).body(detail);
    }

    @PutMapping("/test-cases/{id}")
    public ResponseEntity<?> updateTestCase(@PathVariable Long id,
                                             @AuthenticationPrincipal Object principal,
                                             @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "qa", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk mengubah test case"));
        }
        // product_id is not editable on an existing test case, so the feature is checked against the stored one
        List<Map<String, Object>> current = jdbc.queryForList("SELECT product_id FROM qa_test_cases WHERE id=?", id);
        if (current.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Test case tidak ditemukan"));
        Long featureId = toLong(body.get("feature_id"));
        if (!featureMatchesProduct(featureId, toLong(current.get(0).get("product_id")))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Feature tidak sesuai dengan produk test case ini"));
        }
        // Deadline is only touched when the key is sent ("" / null clears it). A request without the key
        // (e.g. a browser still running the previous frontend bundle) keeps the stored deadline.
        boolean deadlineSent = body.containsKey("deadline");
        java.sql.Date deadline;
        try { deadline = toSqlDate(body.get("deadline")); }
        catch (IllegalArgumentException e) { return invalidDeadline(); }
        // Status: an absent / empty value keeps the stored one; a status from before v35 is mapped (active → todo,
        // deprecated → finish), so a browser still running the previous bundle can save; anything else is rejected
        String rawStatus = str(body.get("status")).trim();
        String status = rawStatus.isEmpty() ? null : toStatus(rawStatus);
        if (!rawStatus.isEmpty() && status == null) return invalidStatus();
        // Assignees are only touched when the request carries them: a request without the keys (the previous frontend
        // bundle has no assignee field) keeps the stored assignees instead of clearing them, like deadline above.
        boolean assigneesSent = body.containsKey("assigned_to") || body.containsKey("additional_assignee_ids");
        Long primaryId = toLong(body.get("assigned_to"));
        List<Long> additionalIds = assigneeSupport.parseIdList(body.get("additional_assignee_ids"));
        if (assigneesSent && !usersExist(primaryId, additionalIds)) return invalidAssignee();

        Map<String, Object> before = testCaseDetail(id);
        Integer updated = tx.execute(st -> {
            int n = jdbc.update(
                "UPDATE qa_test_cases SET title=?,description=?,steps=?,expected_result=?,status=COALESCE(?::varchar, status),priority=?,feature_id=?," +
                "deadline = CASE WHEN ?::boolean THEN ?::date ELSE deadline END WHERE id=?",
                body.get("title"), body.get("description"),
                body.get("steps"), body.get("expected_result"),
                status, body.get("priority"), featureId, deadlineSent, deadline, id
            );
            if (n > 0 && assigneesSent) assigneeSupport.sync(ASSIGNEES, ASSIGNEES_FK, id, primaryId, additionalIds);
            return n;
        });
        if (updated == null || updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Test case tidak ditemukan"));

        Map<String, Object> detail = testCaseDetail(id);
        if (detail == null) return ResponseEntity.status(404).body(Map.of("error", "Test case tidak ditemukan"));
        // Same rule as Backlog and Bugs: when the assignee set changed, everyone assigned now is notified (not the actor)
        if (before != null && !assigneeSupport.extractIds(before).equals(assigneeSupport.extractIds(detail))) {
            Map<String, Object> user = toMap(principal);
            notifyAssignees(detail, user != null ? toLong(user.get("id")) : null, actorName(user));
        }
        return ResponseEntity.ok(detail);
    }

    /**
     * Status only, for the dropdown on the status pill in the Test Cases table (like PATCH /backlog/{id}/status). PUT
     * cannot be used for that: it writes every field it is sent. Same permission and status rules as PUT; no
     * notification (changing the status through the form does not send one either).
     */
    @PatchMapping("/test-cases/{id}/status")
    public ResponseEntity<?> updateTestCaseStatus(@PathVariable Long id,
                                                  @AuthenticationPrincipal Object principal,
                                                  @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.can(principal, "qa", "update")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk mengubah test case"));
        }
        String status = toStatus(str(body.get("status")));
        if (status == null) return invalidStatus();
        int updated = jdbc.update("UPDATE qa_test_cases SET status=? WHERE id=?", status, id);
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Test case tidak ditemukan"));
        return ResponseEntity.ok(testCaseDetail(id));
    }

    @DeleteMapping("/test-cases/{id}")
    public ResponseEntity<?> deleteTestCase(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.can(principal, "qa", "delete")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menghapus test case"));
        }
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
        if (!PermissionHelper.can(principal, "qa", "run")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menjalankan test"));
        }
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
        if (!PermissionHelper.can(principal, "qa", "run")) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses untuk menjalankan test"));
        }
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
    public ResponseEntity<?> dashboard(@AuthenticationPrincipal Object principal,
                                       @RequestParam(required = false) Long product_id) {
        String productFilter = product_id != null ? "AND tc.product_id = ?" : "";
        Object[] params = product_id != null ? new Object[]{product_id} : new Object[]{};

        Map<String, Object> summary = jdbc.queryForMap(
            "SELECT " +
            "  COUNT(DISTINCT tc.id)                                           AS total_cases, " +
            // active_cases (kept for API compatibility): test cases being worked on, To Do / In Progress / In Review
            "  COUNT(DISTINCT CASE WHEN tc.status IN ('todo','in_progress','in_review') THEN tc.id END) AS active_cases, " +
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

        // Latest SPRINTS_PER_PRODUCT sprints of each product (or only the filtered product), returned
        // oldest-first within each product so the UI can draw one trend line per product.
        // (Previously: all products interleaved by start_date and the OLDEST 12 overall, ignoring the filter.)
        final int SPRINTS_PER_PRODUCT = 6;
        String sprintProductFilter = product_id != null ? "AND s.product_id = ? " : "";
        Object[] sprintParams = product_id != null ? new Object[]{product_id, SPRINTS_PER_PRODUCT} : new Object[]{SPRINTS_PER_PRODUCT};
        List<Map<String, Object>> bySprint = jdbc.queryForList(
            "SELECT sprint_id, sprint, product_id, product_code, product_name, product_color, start_date, " +
            "  pass_count, fail_count, blocked_count " +
            "FROM ( " +
            "  SELECT s.id AS sprint_id, s.name AS sprint, s.product_id, s.start_date, " +
            "    p.code AS product_code, p.name AS product_name, p.color AS product_color, " +
            "    COUNT(CASE WHEN tr.result='pass'    THEN 1 END) AS pass_count, " +
            "    COUNT(CASE WHEN tr.result='fail'    THEN 1 END) AS fail_count, " +
            "    COUNT(CASE WHEN tr.result='blocked' THEN 1 END) AS blocked_count, " +
            "    ROW_NUMBER() OVER (PARTITION BY s.product_id ORDER BY s.start_date DESC NULLS LAST, s.id DESC) AS rn " +
            "  FROM sprints s " +
            "  LEFT JOIN products p ON p.id = s.product_id " +
            "  LEFT JOIN qa_test_runs tr ON tr.sprint_id = s.id " +
            "  WHERE 1=1 " + sprintProductFilter +
            "  GROUP BY s.id, s.name, s.product_id, s.start_date, p.code, p.name, p.color " +
            ") x " +
            "WHERE rn <= ? " +
            "ORDER BY product_id, start_date NULLS LAST, sprint_id",
            sprintParams);

        List<Map<String, Object>> recentFails = jdbc.queryForList(
            // test_case_id / backlog_item_id: the QA dashboard links each failure to its test case and backlog item
            "SELECT tr.id, tr.result, tr.notes, tr.bug_reference, tr.executed_at, tr.test_case_id, tc.backlog_item_id, " +
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

        // "Bugs per Feature" card. Gated by role name, NOT by bugs.access: manager / po / developer see the
        // counts without gaining access to the Bugs Incident module itself. Other roles get an empty list
        // and the UI hides the card. Same query as the Bugs Incident dashboard (BugStats).
        boolean bugOverviewAllowed = canViewBugOverview(principal);
        List<Map<String, Object>> bugsByFeature = bugOverviewAllowed ? bugStats.bugsByFeature(product_id) : List.of();

        return ResponseEntity.ok(Map.of(
            "summary", summary,
            "byProduct", byProduct,
            "bySprint", bySprint,
            "recentFails", recentFails,
            "bugOverviewAllowed", bugOverviewAllowed,
            "bugsByFeature", bugsByFeature,
            // The card's columns are the configurable bug stages (same payload shape as the Bugs Incident dashboard)
            "bugStages", bugOverviewAllowed ? bugStats.stages() : List.of()
        ));
    }

    /** Roles that may see the "Bugs per Feature" card on the QA dashboard (super_admin always may). */
    private static final Set<String> BUG_OVERVIEW_ROLES = Set.of("manager", "po", "developer", "qa");

    private boolean canViewBugOverview(Object principal) {
        if (PermissionHelper.isSuperAdmin(principal)) return true;
        Map<String, Object> user = toMap(principal);
        return user != null && BUG_OVERVIEW_ROLES.contains(String.valueOf(user.get("role_name")));
    }

    /** A feature is optional; when given it must belong to the same product as the test case. */
    private boolean featureMatchesProduct(Long featureId, Long productId) {
        if (featureId == null) return true;
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT product_id FROM features WHERE id=?", featureId);
        return !rows.isEmpty() && productId != null && productId.equals(toLong(rows.get(0).get("product_id")));
    }

    /**
     * Optional deadline from the form's date input ("yyyy-MM-dd"; a longer ISO string is cut to its date part).
     * null / blank = no deadline. Throws IllegalArgumentException for anything else, so a bad value is
     * rejected with 400 instead of being silently dropped.
     */
    private java.sql.Date toSqlDate(Object v) {
        if (v == null) return null;
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        return java.sql.Date.valueOf(s.length() > 10 ? s.substring(0, 10) : s);
    }

    private ResponseEntity<?> invalidDeadline() {
        return ResponseEntity.badRequest().body(Map.of("error", "Format deadline tidak valid (YYYY-MM-DD)"));
    }

    private ResponseEntity<?> invalidStatus() {
        return ResponseEntity.badRequest().body(Map.of("error",
            "Status tidak valid. Pilihan: Draft, To Do, In Progress, In Review, Finish"));
    }

    private ResponseEntity<?> invalidAssignee() {
        return ResponseEntity.badRequest().body(Map.of("error", "Assignee tidak ditemukan"));
    }

    /** Every picked assignee is an existing user (nobody picked is fine). */
    private boolean usersExist(Long primaryId, List<Long> additionalIds) {
        Set<Long> ids = new LinkedHashSet<>();
        if (primaryId != null) ids.add(primaryId);
        ids.addAll(additionalIds);
        if (ids.isEmpty()) return true;
        String in = String.join(",", Collections.nCopies(ids.size(), "?"));
        Integer found = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id IN (" + in + ")", Integer.class, ids.toArray());
        return found != null && found == ids.size();
    }

    /** One test case with its assignees (list of {id, name, color, email}, primary first); null when it does not exist. */
    private Map<String, Object> testCaseDetail(Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT tc.*, " + assigneeSupport.assigneesJsonSelect(ASSIGNEES, ASSIGNEES_FK, "tc") + " " +
            "FROM qa_test_cases tc WHERE tc.id = ?", id);
        if (rows.isEmpty()) return null;
        assigneeSupport.enrich(rows);
        return rows.get(0);
    }

    /** Notifies (in-app + email) every current assignee of a test case, except the actor who made the change. */
    private void notifyAssignees(Map<String, Object> tc, Long excludeUserId, String actorName) {
        Object raw = tc.get("assignees");
        if (!(raw instanceof List)) return;
        String code = str(tc.get("code"));
        String title = str(tc.get("title"));
        String link = "/qa?case=" + tc.get("id");
        for (Object o : (List<?>) raw) {
            if (!(o instanceof Map)) continue;
            Map<?, ?> a = (Map<?, ?>) o;
            Long uid = toLong(a.get("id"));
            if (uid == null || uid.equals(excludeUserId)) continue;
            try {
                jdbc.update("INSERT INTO notifications (user_id, type, title, message, link) VALUES (?,?,?,?,?)",
                    uid, "assignment", "Kamu di-assign ke test case " + code,
                    "Test case \"" + title + "\" telah di-assign kepadamu oleh " + actorName, link);
            } catch (Exception ignored) {}
            String em = str(a.get("email"));
            if (!em.isBlank()) email.notifyAssignment(em, "QA Test Case", code, title, actorName, link);
        }
    }

    private String actorName(Map<String, Object> user) {
        String name = user != null ? str(user.get("name")) : "";
        return name.isBlank() ? "System" : name;
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
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
        // Empty selects (e.g. "no sprint") arrive as "" — treat as absent instead of failing with a 500
        String s = v.toString().trim();
        return s.isEmpty() ? null : Long.parseLong(s);
    }
}
