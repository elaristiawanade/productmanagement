package com.producttracker.controller;

import com.producttracker.config.BugHelper;
import com.producttracker.service.AssigneeSupport;
import com.producttracker.service.AttachmentCopier;
import com.producttracker.service.BugStats;
import com.producttracker.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/bugs")
public class BugController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private BugHelper bugHelper;

    @Autowired
    private BugStats bugStats;

    @Autowired
    private EmailService email;

    @Autowired
    private AssigneeSupport assigneeSupport;

    // Reused as-is by "Buat Backlog" so the card gets the same code numbering, assignee sync, activity log,
    // notifications and permission check (backlog.create) as one made from the Backlog page.
    @Autowired
    private BacklogController backlogController;

    // "Buat Backlog" also copies the bug's attachments (each gets its own file on disk)
    @Autowired
    private AttachmentCopier attachmentCopier;

    private static final Pattern MENTION_PATTERN = Pattern.compile("@\\[([^\\]]+)\\]");

    /** Ticket types are configurable (bug_types table, managed by Super Admin); bugs.type stores the type's code. */
    private boolean typeExists(String code) {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM bug_types WHERE code = ?", Long.class, code);
        return n != null && n > 0;
    }

    private ResponseEntity<?> invalidType() {
        return ResponseEntity.badRequest().body(Map.of("error", "Type tidak dikenal. Pilih salah satu Type yang tersedia."));
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke modul Bugs Incident"));
    }

    // ── BUGS ─────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> listBugs(
            @AuthenticationPrincipal Object principal,
            @RequestParam(required = false) Long product_id,
            @RequestParam(required = false) Long backlog_item_id,
            @RequestParam(required = false) String stage) {
        if (!bugHelper.canAccess(principal)) return forbidden();

        List<String> filters = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (product_id != null)      { filters.add("b.product_id = ?");      params.add(product_id); }
        if (backlog_item_id != null) { filters.add("b.backlog_item_id = ?"); params.add(backlog_item_id); }
        if (stage != null)           { filters.add("b.stage = ?");           params.add(stage); }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT b.*, " +
            "  bi.code AS item_code, bi.title AS item_title, " +
            "  p.name AS product_name, p.code AS product_code, " +
            "  f.code AS feature_code, f.name AS feature_name, " +
            "  ru.name AS reported_by_name, au.name AS assigned_to_name, " +
            "  bt.name AS type_name, bt.color AS type_color, " +
            "  bs.name AS stage_name, bs.color AS stage_color, bs.is_closed AS stage_is_closed, bs.not_late AS stage_not_late, " +
            "  cbi.code AS converted_backlog_code, cbi.title AS converted_backlog_title, " +
            "  COUNT(bp.id)          AS update_count, " +
            "  MAX(bp.created_at)    AS last_update, " +
            "  (SELECT u3.name FROM bug_progress_updates bp3 " +
            "     LEFT JOIN users u3 ON u3.id = bp3.updated_by " +
            "     WHERE bp3.bug_id = b.id ORDER BY bp3.created_at DESC LIMIT 1) AS last_updated_by_name, " +
            "  " + assigneeSupport.assigneesJsonSelect("bug_assignees", "bug_id", "b") + " " +
            "FROM bugs b " +
            "LEFT JOIN backlog_items bi ON bi.id = b.backlog_item_id " +
            "LEFT JOIN products      p  ON p.id  = b.product_id " +
            "LEFT JOIN features      f  ON f.id  = b.feature_id " +
            "LEFT JOIN users         ru ON ru.id = b.reported_by " +
            "LEFT JOIN users         au ON au.id = b.assigned_to " +
            "LEFT JOIN bug_types     bt ON bt.code = b.type " +
            "LEFT JOIN bug_stages    bs ON bs.code = b.stage " +
            "LEFT JOIN backlog_items cbi ON cbi.id = b.converted_backlog_id " +
            "LEFT JOIN bug_progress_updates bp ON bp.bug_id = b.id " +
            where +
            "GROUP BY b.id, bi.code, bi.title, p.name, p.code, f.code, f.name, ru.name, au.name, bt.name, bt.color, " +
            "  bs.name, bs.color, bs.is_closed, bs.not_late, cbi.code, cbi.title " +
            "ORDER BY b.product_id, b.code",
            params.toArray());
        assigneeSupport.enrich(rows);
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    public ResponseEntity<?> createBug(@AuthenticationPrincipal Object principal,
                                        @RequestBody Map<String, Object> body) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        if (body.get("product_id") == null || body.get("title") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "product_id dan title wajib"));
        }

        // A new ticket can only start as a regular bug ("open") or as an "improvement" idea.
        String initialStage = "improvement".equals(body.get("stage")) ? "improvement" : "open";

        Long productId = toLong(body.get("product_id"));
        Long featureId = toLong(body.get("feature_id"));
        if (!featureMatchesProduct(featureId, productId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Feature tidak sesuai dengan produk yang dipilih"));
        }
        // Type is optional on create and defaults to a regular bug
        String type = str(body.get("type")).trim();
        if (type.isEmpty()) type = BugTypeController.DEFAULT_CODE;
        if (!typeExists(type)) return invalidType();
        java.sql.Date deadline;
        try { deadline = toSqlDate(body.get("deadline")); }
        catch (IllegalArgumentException e) { return invalidDeadline(); }
        String bugCode = (String) body.get("code");
        if (bugCode == null || bugCode.isBlank()) {
            List<Map<String, Object>> pRows = jdbc.queryForList(
                "SELECT code FROM products WHERE id=?", productId
            );
            String pCode = pRows.isEmpty() ? "BUG" : (String) pRows.get(0).get("code");
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
            bugCode = pCode + "-" + String.format("%03d", lastNum + 1);
        }

        Map<String, Object> user = toMap(principal);
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO bugs " +
                "(backlog_item_id, product_id, feature_id, type, code, title, description, steps_to_reproduce, severity, priority, stage, reported_by, assigned_to, deadline) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *",
                toLong(body.get("backlog_item_id")), productId, featureId, type, bugCode,
                body.get("title"), body.get("description"), body.get("steps_to_reproduce"),
                orDefault(body.get("severity"), "medium"),
                orDefault(body.get("priority"), "medium"),
                initialStage,
                user != null ? user.get("id") : null,
                toLong(body.get("assigned_to")),
                deadline
            );

            Long newBugId = toLong(row.get("id"));
            Long assignedTo = toLong(body.get("assigned_to"));
            List<Long> additionalIds = assigneeSupport.parseIdList(body.get("additional_assignee_ids"));
            assigneeSupport.sync("bug_assignees", "bug_id", newBugId, assignedTo, additionalIds);

            Long actorId = user != null ? toLong(user.get("id")) : null;
            String actorName = user != null ? str(user.get("name")) : "System";
            Map<String, Object> detail = bugDetail(newBugId);
            if (detail != null) {
                notifyBugAssignees(detail, actorId,
                    "Kamu di-assign ke bug " + row.get("code"),
                    "Bug \"" + row.get("title") + "\" telah di-assign kepadamu oleh " + actorName,
                    "/bugs?bug=" + newBugId, actorName);
            }

            return ResponseEntity.status(201).body(detail != null ? detail : row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateBug(@AuthenticationPrincipal Object principal,
                                        @PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (!bugHelper.canAccess(principal)) return forbidden();

        Map<String, Object> before = bugDetail(id);
        if (before == null) return ResponseEntity.status(404).body(Map.of("error", "Bug tidak ditemukan"));

        // product_id is not editable on an existing bug, so the feature is checked against the stored one
        Long featureId = toLong(body.get("feature_id"));
        if (!featureMatchesProduct(featureId, toLong(before.get("product_id")))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Feature tidak sesuai dengan produk bug ini"));
        }

        // Unlike the other columns, an absent type keeps the stored one (COALESCE) instead of being overwritten
        String type = str(body.get("type")).trim();
        if (!type.isEmpty() && !typeExists(type)) return invalidType();

        // Deadline is only touched when the key is sent ("" / null clears it). A request without the key
        // (e.g. a browser still running the previous frontend bundle) keeps the stored deadline.
        boolean deadlineSent = body.containsKey("deadline");
        java.sql.Date deadline;
        try { deadline = toSqlDate(body.get("deadline")); }
        catch (IllegalArgumentException e) { return invalidDeadline(); }

        int updated = jdbc.update(
            "UPDATE bugs SET title=?,description=?,steps_to_reproduce=?,severity=?,priority=?,assigned_to=?,backlog_item_id=?,feature_id=?,type=COALESCE(?, type)," +
            "deadline = CASE WHEN ?::boolean THEN ?::date ELSE deadline END WHERE id=?",
            body.get("title"), body.get("description"), body.get("steps_to_reproduce"),
            body.get("severity"), body.get("priority"),
            toLong(body.get("assigned_to")), toLong(body.get("backlog_item_id")), featureId,
            type.isEmpty() ? null : type, deadlineSent, deadline, id
        );
        if (updated == 0) return ResponseEntity.status(404).body(Map.of("error", "Bug tidak ditemukan"));

        Long newAssignedTo = toLong(body.get("assigned_to"));
        List<Long> additionalIds = assigneeSupport.parseIdList(body.get("additional_assignee_ids"));
        assigneeSupport.sync("bug_assignees", "bug_id", id, newAssignedTo, additionalIds);

        Map<String, Object> detail = bugDetail(id);
        if (detail == null) return ResponseEntity.status(404).body(Map.of("error", "Bug tidak ditemukan"));

        Map<String, Object> user = toMap(principal);
        Long actorId = user != null ? toLong(user.get("id")) : null;
        String actorName = user != null ? str(user.get("name")) : "System";

        if (!assigneeSupport.extractIds(before).equals(assigneeSupport.extractIds(detail))) {
            notifyBugAssignees(detail, actorId,
                "Kamu di-assign ke bug " + detail.get("code"),
                "Bug \"" + detail.get("title") + "\" telah di-assign kepadamu oleh " + actorName,
                "/bugs?bug=" + id, actorName);
        }

        return ResponseEntity.ok(detail);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBug(@AuthenticationPrincipal Object principal, @PathVariable Long id) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        int deleted = jdbc.update("DELETE FROM bugs WHERE id=?", id);
        if (deleted == 0) return ResponseEntity.status(404).body(Map.of("error", "Bug tidak ditemukan"));
        return ResponseEntity.ok(Map.of("message", "Bug dihapus"));
    }

    // ── PROGRESS UPDATES ─────────────────────────────────────────────────────

    @GetMapping("/progress")
    public ResponseEntity<?> listProgress(
            @AuthenticationPrincipal Object principal,
            @RequestParam(required = false) Long bug_id,
            @RequestParam(required = false) Long product_id) {
        if (!bugHelper.canAccess(principal)) return forbidden();

        List<String> filters = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (bug_id != null)     { filters.add("bp.bug_id = ?");     params.add(bug_id); }
        if (product_id != null) { filters.add("b.product_id = ?"); params.add(product_id); }
        String where = filters.isEmpty() ? "" : "WHERE " + String.join(" AND ", filters) + " ";

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT bp.*, b.code AS bug_code, b.title AS bug_title, " +
            "  bi.code AS item_code, bi.title AS item_title, " +
            "  p.name AS product_name, u.name AS updated_by_name " +
            "FROM bug_progress_updates bp " +
            "JOIN bugs            b  ON b.id  = bp.bug_id " +
            "LEFT JOIN backlog_items bi ON bi.id = b.backlog_item_id " +
            "LEFT JOIN products      p  ON p.id  = b.product_id " +
            "LEFT JOIN users         u  ON u.id  = bp.updated_by " +
            where +
            "ORDER BY bp.created_at DESC",
            params.toArray());
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/progress")
    public ResponseEntity<?> createProgress(@AuthenticationPrincipal Object principal,
                                             @RequestBody Map<String, Object> body) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        if (body.get("bug_id") == null || body.get("stage") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "bug_id dan stage wajib"));
        }
        Long bugId = toLong(body.get("bug_id"));
        String stage = body.get("stage").toString().trim();
        // Stages are configurable (bug_stages table, managed by Super Admin); bugs.stage stores the stage's code
        List<Map<String, Object>> stageRows = jdbc.queryForList(
            "SELECT name, is_closed FROM bug_stages WHERE code = ?", stage);
        if (stageRows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Stage tidak dikenal. Pilih salah satu Stage yang tersedia."));
        }
        boolean stageClosed = Boolean.TRUE.equals(stageRows.get(0).get("is_closed"));
        String note = body.get("note") != null ? body.get("note").toString().trim() : "";
        Map<String, Object> user = toMap(principal);
        Map<String, Object> beforeBug = bugDetail(bugId);
        // Messages show the stage's display name; fall back to the raw code for a stage that no longer exists
        String oldStage = beforeBug != null ? stageName(str(beforeBug.get("stage"))) : null;
        String newStageName = str(stageRows.get(0).get("name"));
        Long actorId = user != null ? toLong(user.get("id")) : null;
        String actorName = user != null ? str(user.get("name")) : "System";
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO bug_progress_updates (bug_id, stage, note, updated_by) VALUES (?,?,?,?) RETURNING *",
                bugId, stage, body.get("note"), actorId
            );
            // A "closed" stage (Done, or a custom stage flagged is_closed) stamps closed_at; any other stage clears it
            jdbc.update(
                "UPDATE bugs SET stage=?, closed_at = CASE WHEN ?::boolean THEN NOW() ELSE NULL END WHERE id=?",
                stage, stageClosed, bugId
            );

            // Surface the stage change (and, if written, the closing note) in the bug's own
            // Activity/Comments feed — bug_progress_updates alone only shows on the separate
            // Progress tab, which made closing notes look like they vanished.
            jdbc.update(
                "INSERT INTO bug_activities (bug_id, user_id, type, content) VALUES (?,?,'change_log',?)",
                bugId, actorId,
                "Stage diubah dari \"" + oldStage + "\" menjadi \"" + newStageName + "\" — oleh " + actorName
            );
            if (!note.isEmpty()) {
                jdbc.update(
                    "INSERT INTO bug_activities (bug_id, user_id, type, content) VALUES (?,?,'comment',?)",
                    bugId, actorId, note
                );
            }

            if (beforeBug != null) {
                Object rawAssignees = beforeBug.get("assignees");
                if (rawAssignees instanceof List) {
                    for (Object o : (List<?>) rawAssignees) {
                        if (!(o instanceof Map)) continue;
                        Map<?, ?> a = (Map<?, ?>) o;
                        Long uid = assigneeSupport.toLong(a.get("id"));
                        if (uid == null || uid.equals(actorId)) continue;
                        createNotification(uid, "status_change",
                            "Status bug " + beforeBug.get("code") + " berubah",
                            "Bug \"" + beforeBug.get("title") + "\" berubah stage dari \"" + oldStage +
                                "\" menjadi \"" + newStageName + "\" — oleh " + actorName,
                            "/bugs?bug=" + bugId);
                        String em = a.get("email") != null ? a.get("email").toString() : "";
                        if (!em.isBlank()) {
                            email.notifyStatusChange(em, "Bug Incident",
                                str(beforeBug.get("code")), str(beforeBug.get("title")), oldStage, newStageName, actorName,
                                "/bugs?bug=" + bugId);
                        }
                    }
                }
            }

            return ResponseEntity.status(201).body(row);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    // ── CONVERT TO BACKLOG ───────────────────────────────────────────────────

    /**
     * "Buat Backlog": turns an Improvement ticket into a Backlog card (story, status backlog, no sprint) that copies
     * the title, priority, every assignee and the deadline; description, steps and the bug's Feature go into the
     * card's notes. The bug itself stays untouched (stage included) and remembers the card in
     * bugs.converted_backlog_id, so it can be converted only once. The card is made by BacklogController.create
     * itself, which also enforces `backlog.create` (403 otherwise) and sends the usual assignee notifications.
     */
    @PostMapping("/{id}/convert-to-backlog")
    public ResponseEntity<?> convertToBacklog(@AuthenticationPrincipal Object principal, @PathVariable Long id) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        Map<String, Object> bug = bugDetail(id);
        if (bug == null) return ResponseEntity.status(404).body(Map.of("error", "Bug tidak ditemukan"));
        if (!BugTypeController.IMPROVEMENT_CODE.equals(str(bug.get("type")))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Hanya tiket bertype Improvement yang bisa dibuat menjadi Backlog"));
        }
        if (bug.get("converted_backlog_id") != null) {
            return ResponseEntity.status(409).body(Map.of("error",
                "Bug ini sudah dibuat di Backlog: " + str(bug.get("converted_backlog_code"))));
        }

        // Notes: everything that has no column of its own on a Backlog card
        StringBuilder notes = new StringBuilder("Dibuat dari bug " + str(bug.get("code")) + " (Improvement) di Bugs Incident.");
        // The card's own Author is whoever pressed the button, so the original reporter is written down here
        String reporter = reporterLabel(bug);
        if (!reporter.isEmpty()) notes.append("\nDilaporkan oleh: ").append(reporter);
        String description = str(bug.get("description")).trim();
        String steps = str(bug.get("steps_to_reproduce")).trim();
        if (!description.isEmpty()) notes.append("\n\nDeskripsi:\n").append(description);
        if (!steps.isEmpty()) notes.append("\n\nLangkah reproduksi:\n").append(steps);
        Long featureId = toLong(bug.get("feature_id"));
        if (featureId != null) {
            // bugs.feature_id points at `features`, not at the product_roadmap features a Backlog card links to,
            // so it cannot be copied as a link — it is written out instead
            List<Map<String, Object>> f = jdbc.queryForList("SELECT code, name FROM features WHERE id = ?", featureId);
            if (!f.isEmpty()) notes.append("\n\nFeature: [").append(str(f.get(0).get("code"))).append("] ").append(str(f.get(0).get("name")));
        }
        Long relatedItemId = toLong(bug.get("backlog_item_id"));
        if (relatedItemId != null) {
            List<Map<String, Object>> r = jdbc.queryForList("SELECT code, title FROM backlog_items WHERE id = ?", relatedItemId);
            if (!r.isEmpty()) notes.append("\nBacklog item terkait: [").append(str(r.get(0).get("code"))).append("] ").append(str(r.get(0).get("title")));
        }

        // Primary assignee first, the rest as additional assignees (same shape BacklogController.create reads)
        Long primary = toLong(bug.get("assigned_to"));
        List<Long> additional = new ArrayList<>();
        for (Long uid : assigneeSupport.extractIds(bug)) {
            if (!uid.equals(primary)) additional.add(uid);
        }
        if (primary == null && !additional.isEmpty()) primary = additional.remove(0);

        Map<String, Object> body = new java.util.HashMap<>();
        body.put("product_id", bug.get("product_id"));
        body.put("title", bug.get("title"));
        body.put("type", "story");
        body.put("status", "backlog");
        body.put("priority", orDefault(bug.get("priority"), "medium"));
        body.put("assignee_id", primary);
        body.put("additional_assignee_ids", additional);
        body.put("deadline", bug.get("deadline") != null ? bug.get("deadline").toString() : null);
        body.put("notes", notes.toString());

        ResponseEntity<?> created = backlogController.create(principal, body);
        if (created.getStatusCode().value() != 201 || !(created.getBody() instanceof Map)) return created;  // 403 / 400 as-is
        @SuppressWarnings("unchecked")
        Map<String, Object> item = (Map<String, Object>) created.getBody();
        Long itemId = toLong(item.get("id"));
        String itemCode = str(item.get("code"));

        // Claim the bug only if nobody converted it in the meantime (double click / two users); the loser's card is removed
        int linked = jdbc.update("UPDATE bugs SET converted_backlog_id = ? WHERE id = ? AND converted_backlog_id IS NULL", itemId, id);
        if (linked == 0) {
            jdbc.update("DELETE FROM backlog_items WHERE id = ?", itemId);
            return ResponseEntity.status(409).body(Map.of("error", "Bug ini baru saja dibuat di Backlog oleh pengguna lain"));
        }

        Map<String, Object> user = toMap(principal);
        Long actorId = user != null ? toLong(user.get("id")) : null;
        String actorName = user != null ? str(user.get("name")) : "System";
        // Attachments (screenshots, mockups, ...): copied only after the bug is claimed, so a lost race copies nothing.
        // A failure here must not undo the conversion, so it is swallowed and shows up as a lower count.
        int attachmentsCopied = 0;
        try { attachmentsCopied = attachmentCopier.copyBugToBacklog(id, itemId); } catch (Exception ignored) { /* best effort */ }
        String attachmentNote = attachmentsCopied > 0 ? " (" + attachmentsCopied + " lampiran disalin)" : "";

        jdbc.update("INSERT INTO bug_activities (bug_id, user_id, type, content) VALUES (?,?,'change_log',?)",
            id, actorId, "Dibuat menjadi kartu Backlog " + itemCode + attachmentNote + " — oleh " + actorName);
        jdbc.update("INSERT INTO item_activities (backlog_item_id, user_id, type, content) VALUES (?,?,'change_log',?)",
            itemId, actorId, "Dibuat dari bug " + str(bug.get("code")) + " (Improvement) di Bugs Incident" + attachmentNote + " — oleh " + actorName);

        return ResponseEntity.status(201).body(Map.of(
            "bug", bugDetail(id),
            "backlog_item", Map.of("id", itemId, "code", itemCode, "title", str(bug.get("title"))),
            "attachments_copied", attachmentsCopied
        ));
    }

    // ── DASHBOARD ────────────────────────────────────────────────────────────

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard(@AuthenticationPrincipal Object principal,
                                        @RequestParam(required = false) Long product_id) {
        if (!bugHelper.canAccess(principal)) return forbidden();

        String productFilter = product_id != null ? "AND b.product_id = ?" : "";
        Object[] params = product_id != null ? new Object[]{product_id} : new Object[]{};

        // open_count / done_count follow the stage flags (counts_open / is_closed) instead of fixed stage names, so a
        // custom stage lands in the right card; the built-in stages are seeded with flags that keep the old numbers.
        Map<String, Object> summary = jdbc.queryForMap(
            "SELECT " +
            "  COUNT(*)                                                        AS total_bugs, " +
            "  COUNT(CASE WHEN s.counts_open THEN 1 END)                       AS open_count, " +
            "  COUNT(CASE WHEN b.stage = 'ready_to_test' THEN 1 END)           AS ready_to_test_count, " +
            "  COUNT(CASE WHEN s.is_closed   THEN 1 END)                       AS done_count, " +
            "  ROUND(100.0 * COUNT(CASE WHEN s.is_closed THEN 1 END) / NULLIF(COUNT(*), 0), 1) AS resolution_rate " +
            "FROM bugs b LEFT JOIN bug_stages s ON s.code = b.stage WHERE 1=1 " + productFilter,
            params
        );

        // "Bugs per Feature" card (replaced the old "Bugs per Produk" chart); follows the product filter
        List<Map<String, Object>> byFeature = bugStats.bugsByFeature(product_id);

        List<Map<String, Object>> byStage = jdbc.queryForList(
            "SELECT stage, COUNT(*) AS count FROM bugs b WHERE 1=1 " + productFilter + " GROUP BY stage",
            params);

        List<Map<String, Object>> recentActivity = jdbc.queryForList(
            // bug_id: the Bugs dashboard opens the ticket from this feed
            "SELECT bp.id, bp.bug_id, bp.stage, bp.note, bp.created_at, " +
            "  b.code AS bug_code, b.title AS bug_title, " +
            "  p.name AS product, u.name AS updated_by_name " +
            "FROM bug_progress_updates bp " +
            "JOIN bugs     b ON b.id = bp.bug_id " +
            "JOIN products p ON p.id = b.product_id " +
            "LEFT JOIN users u ON u.id = bp.updated_by " +
            "ORDER BY bp.created_at DESC NULLS LAST " +
            "LIMIT 10");

        List<Map<String, Object>> recentComments = jdbc.queryForList(
            // bug_id: the Bugs dashboard opens the ticket from this feed
            "SELECT a.id, a.bug_id, a.content, a.created_at, " +
            "  b.code AS bug_code, b.title AS bug_title, " +
            "  p.name AS product, u.name AS user_name, u.avatar_color AS user_avatar_color " +
            "FROM bug_activities a " +
            "JOIN bugs     b ON b.id = a.bug_id " +
            "JOIN products p ON p.id = b.product_id " +
            "LEFT JOIN users u ON u.id = a.user_id " +
            "WHERE a.type = 'comment' " + productFilter + " " +
            "ORDER BY a.created_at DESC " +
            "LIMIT 10",
            params);

        return ResponseEntity.ok(Map.of(
            "summary", summary,
            "byFeature", byFeature,
            "byStage", byStage,
            "bugStages", bugStats.stages(),
            "recentActivity", recentActivity,
            "recentComments", recentComments
        ));
    }

    // ── ACTIVITIES / COMMENTS ────────────────────────────────────────────────

    @GetMapping("/{id}/activities")
    public ResponseEntity<?> listActivities(@AuthenticationPrincipal Object principal, @PathVariable Long id) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT a.id, a.type, a.content, a.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_avatar_color, u.id AS user_id " +
            "FROM bug_activities a " +
            "LEFT JOIN users u ON u.id = a.user_id " +
            "WHERE a.bug_id = ? ORDER BY a.created_at ASC",
            id
        );
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/{id}/activities")
    public ResponseEntity<?> addActivity(@AuthenticationPrincipal Object principal,
                                          @PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        String content = (String) body.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Komentar tidak boleh kosong"));
        }
        Map<String, Object> user = toMap(principal);

        List<Map<String, Object>> exists = jdbc.queryForList("SELECT id, code FROM bugs WHERE id = ?", id);
        if (exists.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Bug tidak ditemukan"));

        Long commenterId = user != null ? toLong(user.get("id")) : null;
        Map<String, Object> row = jdbc.queryForMap(
            "INSERT INTO bug_activities (bug_id, user_id, type, content) VALUES (?,?,'comment',?) RETURNING id",
            id, commenterId, content.trim()
        );

        notifyMentions(id, str(exists.get(0).get("code")), commenterId, content.trim());

        List<Map<String, Object>> full = jdbc.queryForList(
            "SELECT a.id, a.type, a.content, a.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_avatar_color, u.id AS user_id " +
            "FROM bug_activities a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?",
            row.get("id")
        );
        return ResponseEntity.status(201).body(full.get(0));
    }

    @DeleteMapping("/activities/{id}")
    public ResponseEntity<?> deleteActivity(@AuthenticationPrincipal Object principal, @PathVariable Long id) {
        if (!bugHelper.canAccess(principal)) return forbidden();
        Map<String, Object> user = toMap(principal);

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id, type FROM bug_activities WHERE id = ?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Aktivitas tidak ditemukan"));
        if ("change_log".equals(rows.get(0).get("type"))) {
            return ResponseEntity.status(403).body(Map.of("error", "Log perubahan tidak dapat dihapus"));
        }

        Long ownerId = toLong(rows.get(0).get("user_id"));
        Long actorId = user != null ? toLong(user.get("id")) : null;
        boolean isOwner = ownerId != null && ownerId.equals(actorId);
        if (!isOwner && !bugHelper.canAccess(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Hanya bisa menghapus komentar sendiri"));
        }

        jdbc.update("DELETE FROM bug_activities WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Komentar dihapus"));
    }

    private void notifyMentions(Long bugId, String bugCode, Long commenterId, String content) {
        Matcher m = MENTION_PATTERN.matcher(content);
        Set<String> names = new HashSet<>();
        while (m.find()) names.add(m.group(1));
        if (names.isEmpty()) return;

        List<Map<String, Object>> commenterRows = commenterId != null
            ? jdbc.queryForList("SELECT name FROM users WHERE id = ?", commenterId) : List.of();
        String commenterName = commenterRows.isEmpty() ? "Seseorang" : str(commenterRows.get(0).get("name"));
        String snippet = content.length() > 200 ? content.substring(0, 200) + "..." : content;

        for (String name : names) {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT id, email FROM users WHERE name = ?", name);
            if (rows.isEmpty()) continue;
            Long mentionedId = ((Number) rows.get(0).get("id")).longValue();
            if (mentionedId.equals(commenterId)) continue;

            createNotification(mentionedId, "mention",
                commenterName + " menyebut kamu di " + bugCode,
                snippet,
                "/bugs?bug=" + bugId);

            email.notifyMention(str(rows.get(0).get("email")), commenterName, snippet,
                "Bug Incident", bugCode, "/bugs?bug=" + bugId);
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

    /** Notifies (in-app + email) every current assignee of a bug, except the actor who made the change. */
    private void notifyBugAssignees(Map<String, Object> detail, Long excludeUserId,
                                     String notifTitle, String notifMessage, String link, String actorName) {
        Object rawAssignees = detail.get("assignees");
        if (!(rawAssignees instanceof List)) return;
        for (Object o : (List<?>) rawAssignees) {
            if (!(o instanceof Map)) continue;
            Map<?, ?> a = (Map<?, ?>) o;
            Long uid = assigneeSupport.toLong(a.get("id"));
            if (uid == null || uid.equals(excludeUserId)) continue;
            createNotification(uid, "assignment", notifTitle, notifMessage, link);
            String em = a.get("email") != null ? a.get("email").toString() : "";
            if (!em.isBlank()) {
                email.notifyAssignment(em, "Bug Incident", str(detail.get("code")), str(detail.get("title")),
                    actorName, link);
            }
        }
    }

    private Map<String, Object> bugDetail(Long bugId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT b.*, au.name AS assigned_to_name, au.email AS assigned_to_email, " +
            "  bt.name AS type_name, bt.color AS type_color, " +
            "  bs.name AS stage_name, bs.color AS stage_color, bs.is_closed AS stage_is_closed, bs.not_late AS stage_not_late, " +
            "  cbi.code AS converted_backlog_code, cbi.title AS converted_backlog_title, " +
            "  " + assigneeSupport.assigneesJsonSelect("bug_assignees", "bug_id", "b") + " " +
            "FROM bugs b LEFT JOIN users au ON au.id = b.assigned_to " +
            "LEFT JOIN bug_types bt ON bt.code = b.type " +
            "LEFT JOIN bug_stages bs ON bs.code = b.stage " +
            "LEFT JOIN backlog_items cbi ON cbi.id = b.converted_backlog_id WHERE b.id = ?",
            bugId
        );
        if (rows.isEmpty()) return null;
        assigneeSupport.enrich(rows);
        return rows.get(0);
    }

    /** Who reported the bug: the logged-in author, else the name/email an outside reporter typed on the public form. */
    private String reporterLabel(Map<String, Object> bug) {
        Long reporterId = toLong(bug.get("reported_by"));
        if (reporterId != null) {
            List<Map<String, Object>> u = jdbc.queryForList("SELECT name FROM users WHERE id = ?", reporterId);
            if (!u.isEmpty() && !str(u.get(0).get("name")).isBlank()) return str(u.get(0).get("name"));
        }
        String name = str(bug.get("reporter_name")).trim();
        String mail = str(bug.get("reporter_email")).trim();
        if (!name.isEmpty() && !mail.isEmpty()) return name + " (" + mail + ")";
        return !name.isEmpty() ? name : mail;
    }

    /** Display name of a stage code; the raw code if the stage no longer exists. */
    private String stageName(String code) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT name FROM bug_stages WHERE code = ?", code);
        return rows.isEmpty() ? code : str(rows.get(0).get("name"));
    }

    /** A feature is optional; when given it must belong to the same product as the bug. */
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

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
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
