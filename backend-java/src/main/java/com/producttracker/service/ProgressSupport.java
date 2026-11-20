package com.producttracker.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Date;
import java.time.LocalDate;
import java.util.*;

/**
 * "Progress %" is never typed in by a user — it is always derived, so it cannot go stale and needs no column
 * (except the Standup snapshot, see standups.progress / migration_v30):
 *
 *  - Backlog item WITHOUT children ("leaf"): from its status, see STATUS_PCT. Leaf is decided by structure,
 *    not by type: a story with no tasks under it is real work and counts as a leaf.
 *  - Backlog item WITH children (story/epic): average of the leaves below it, weighted by story points
 *    (an item with 0 points weighs 1, so unestimated work still counts). Epics that are still empty are
 *    containers, not work, so they never count towards a parent or a product.
 *  - Product: the same average over all of its leaves.
 *  - QA test case: from the result of its latest test run, see RUN_PCT.
 *  - Standup: snapshot of the author's work in the ACTIVE sprint when the standup of today is saved.
 *
 * All numbers are 0..100 integers; null means "not applicable".
 */
@Component
public class ProgressSupport {

    @Autowired private JdbcTemplate jdbc;

    /** Leaf backlog item: status -> percent. Single place to tune the mapping. */
    private static final Map<String, Integer> STATUS_PCT = Map.of(
        "backlog", 0, "todo", 0, "in_progress", 50, "in_review", 80, "done", 100, "blocked", 25);

    /** QA: latest run result -> percent (no run at all = 0). */
    private static final Map<String, Integer> RUN_PCT = Map.of(
        "pending", 0, "skip", 0, "blocked", 25, "fail", 50, "pass", 100);

    public static int statusPct(Object status) {
        return STATUS_PCT.getOrDefault(status == null ? "" : status.toString(), 0);
    }

    /** null for a deprecated test case (retired, no progress to show). */
    public static Integer testCasePct(Object testCaseStatus, Object lastResult) {
        if ("deprecated".equals(testCaseStatus)) return null;
        return RUN_PCT.getOrDefault(lastResult == null ? "" : lastResult.toString(), 0);
    }

    // ── Backlog tree ─────────────────────────────────────────────────────────

    private static final class Node {
        long id; Long parentId; String type; String status; int weight;
        final List<Node> children = new ArrayList<>();
        boolean counted;                 // computed
        double sum; double weightSum;    // leaf progress * weight, summed over the leaves below
        int own;                         // own status percent
    }

    /** The whole backlog of some products, with progress computed for every item. */
    public static final class Snapshot {
        private final Map<Long, Node> nodes = new HashMap<>();
        private final Map<Long, List<Node>> byProduct = new HashMap<>();

        /** Progress of one item (null when the item is unknown). */
        public Integer itemPct(Long id) {
            Node n = nodes.get(id);
            if (n == null) return null;
            return n.children.isEmpty() || n.weightSum == 0 ? n.own : (int) Math.round(n.sum / n.weightSum);
        }

        public boolean isLeaf(Long id) {
            Node n = nodes.get(id);
            return n != null && n.children.isEmpty();
        }

        /** A real work item: has no children and is not an (empty) epic. */
        public boolean isWorkItem(Long id) {
            Node n = nodes.get(id);
            return n != null && n.children.isEmpty() && !"epic".equals(n.type);
        }

        /** Progress of a product; null when it has no work items yet. */
        public Integer productPct(Long productId) {
            double sum = 0, w = 0;
            for (Node n : byProduct.getOrDefault(productId, List.of())) {
                if (!n.children.isEmpty() || "epic".equals(n.type)) continue;   // leaves of real work only
                sum += n.own * n.weight; w += n.weight;
            }
            return w == 0 ? null : (int) Math.round(sum / w);
        }

        /** Weighted average over some leaf items (null when the list has none). */
        public Integer averageOfLeaves(Collection<Long> ids) {
            double sum = 0, w = 0;
            for (Long id : ids) {
                Node n = nodes.get(id);
                if (n == null || !n.children.isEmpty() || "epic".equals(n.type)) continue;
                sum += n.own * n.weight; w += n.weight;
            }
            return w == 0 ? null : (int) Math.round(sum / w);
        }

        /**
         * Weighted average over the work below some items: each item counts with all the leaves under it (itself
         * when it is a leaf), and a leaf reached twice (a story and one of its tasks both listed) counts once.
         * Used for a feature, whose linked items can be stories with tasks. null when there is no work below.
         */
        public Integer averageOfSubtrees(Collection<Long> ids) {
            Map<Long, Node> leaves = new LinkedHashMap<>();
            for (Long id : ids) collectLeaves(nodes.get(id), leaves, new HashSet<>());
            double sum = 0, w = 0;
            for (Node n : leaves.values()) { sum += n.own * n.weight; w += n.weight; }
            return w == 0 ? null : (int) Math.round(sum / w);
        }

        private static void collectLeaves(Node n, Map<Long, Node> out, Set<Long> visiting) {
            if (n == null || !visiting.add(n.id)) return;
            if (n.children.isEmpty()) {
                if (!"epic".equals(n.type)) out.put(n.id, n);
                return;
            }
            for (Node c : n.children) collectLeaves(c, out, visiting);
        }
    }

    /** Loads the full backlog of the given products (one query) and computes every item's progress. */
    public Snapshot snapshot(Collection<Long> productIds) {
        if (productIds == null || productIds.isEmpty()) return new Snapshot();
        List<Long> ids = new ArrayList<>(new LinkedHashSet<>(productIds));
        String in = String.join(",", Collections.nCopies(ids.size(), "?"));
        return fromRows(jdbc.queryForList(
            "SELECT id, product_id, parent_id, type, status, story_points FROM backlog_items WHERE product_id IN (" + in + ")",
            ids.toArray()));
    }

    /**
     * Same computation over rows the caller already loaded (id, product_id, parent_id, type, status, story_points).
     * The weekly snapshot uses this with each item's status AS OF the end of a week instead of its current status.
     */
    public static Snapshot fromRows(List<Map<String, Object>> rows) {
        Snapshot snap = new Snapshot();
        for (Map<String, Object> r : rows) {
            Node n = new Node();
            n.id = ((Number) r.get("id")).longValue();
            n.parentId = r.get("parent_id") == null ? null : ((Number) r.get("parent_id")).longValue();
            n.type = String.valueOf(r.get("type"));
            n.status = String.valueOf(r.get("status"));
            int sp = r.get("story_points") == null ? 0 : ((Number) r.get("story_points")).intValue();
            n.weight = sp > 0 ? sp : 1;
            n.own = statusPct(n.status);
            snap.nodes.put(n.id, n);
            snap.byProduct.computeIfAbsent(((Number) r.get("product_id")).longValue(), k -> new ArrayList<>()).add(n);
        }
        for (Node n : snap.nodes.values()) {
            Node p = n.parentId == null ? null : snap.nodes.get(n.parentId);
            if (p != null && p != n) p.children.add(n);
        }
        Set<Long> visiting = new HashSet<>();   // guards a corrupted parent_id cycle
        for (Node n : snap.nodes.values()) aggregate(n, visiting);
        return snap;
    }

    private static void aggregate(Node n, Set<Long> visiting) {
        if (n.counted) return;
        if (!visiting.add(n.id)) return;
        for (Node c : n.children) {
            aggregate(c, visiting);
            if (c.children.isEmpty()) {
                if (!"epic".equals(c.type)) { n.sum += c.own * c.weight; n.weightSum += c.weight; }
            } else {
                n.sum += c.sum; n.weightSum += c.weightSum;
            }
        }
        visiting.remove(n.id);
        n.counted = true;
    }

    // ── Attach helpers ───────────────────────────────────────────────────────

    /** Adds "progress" to backlog item rows (each needs id and product_id). */
    public void attachToItems(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) return;
        Set<Long> products = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) if (r.get("product_id") != null) products.add(((Number) r.get("product_id")).longValue());
        Snapshot snap = snapshot(products);
        for (Map<String, Object> r : rows) {
            Object id = r.get("id");
            r.put("progress", id == null ? null : snap.itemPct(((Number) id).longValue()));
        }
    }

    /** Adds "progress" to product rows (each needs id). */
    public void attachToProducts(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) return;
        List<Long> ids = new ArrayList<>();
        for (Map<String, Object> r : rows) ids.add(((Number) r.get("id")).longValue());
        Snapshot snap = snapshot(ids);
        for (Map<String, Object> r : rows) r.put("progress", snap.productPct(((Number) r.get("id")).longValue()));
    }

    // ── Standup snapshot ─────────────────────────────────────────────────────

    /** A standup is only stamped when its date is (about) today; the server runs in UTC, so allow one day of slack. */
    public static boolean isCurrentStandupDate(Date standupDate) {
        if (standupDate == null) return false;
        long diff = Math.abs(java.time.temporal.ChronoUnit.DAYS.between(standupDate.toLocalDate(), LocalDate.now()));
        return diff <= 1;
    }

    /** What a standup stamps: the percent plus how many items of each status it was made of. */
    public static final class WorkProgress {
        public final int pct;
        /** JSON object status -> count, e.g. {"done":1,"in_review":1,"in_progress":1}; stored in standups.progress_detail. */
        public final String detailJson;
        WorkProgress(int pct, String detailJson) { this.pct = pct; this.detailJson = detailJson; }
    }

    /** Order in which statuses are listed in the detail. */
    private static final List<String> DETAIL_ORDER = List.of("done", "in_review", "in_progress", "blocked", "todo", "backlog");

    /**
     * Progress of the user's assigned work in the sprint that is running now: weighted average over the leaf work
     * items assigned to them in an ACTIVE sprint. A person with nothing in an active sprint gets null (no bar),
     * instead of a number made from old or unplanned work that would read like "everything is done".
     */
    public WorkProgress workProgressOfUser(Long userId) {
        if (userId == null) return null;
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT DISTINCT bi.id, bi.product_id, bi.status " +
            "FROM backlog_item_assignees bia " +
            "JOIN backlog_items bi ON bi.id = bia.backlog_item_id " +
            "JOIN sprints s ON s.id = bi.sprint_id AND s.status = 'active' " +
            "WHERE bia.user_id = ?", userId);
        if (rows.isEmpty()) return null;

        Set<Long> products = new HashSet<>();
        for (Map<String, Object> r : rows) products.add(((Number) r.get("product_id")).longValue());
        Snapshot snap = snapshot(products);

        List<Long> work = new ArrayList<>();
        Map<String, Integer> counts = new HashMap<>();
        for (Map<String, Object> r : rows) {
            Long id = ((Number) r.get("id")).longValue();
            if (!snap.isWorkItem(id)) continue;   // parents (story/epic with children) and empty epics are not work
            work.add(id);
            counts.merge(String.valueOf(r.get("status")), 1, Integer::sum);
        }
        Integer pct = snap.averageOfLeaves(work);
        if (pct == null) return null;

        StringBuilder json = new StringBuilder("{");
        for (String st : DETAIL_ORDER) {
            Integer c = counts.get(st);
            if (c == null) continue;
            if (json.length() > 1) json.append(',');
            json.append('"').append(st).append("\":").append(c);
        }
        return new WorkProgress(pct, json.append('}').toString());
    }
}
