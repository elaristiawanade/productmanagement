package com.producttracker.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/**
 * "Open Item (weekly basis)" of the Management Dashboard: per product and week, the work that was open during the
 * week plus the work finished in it. Four sources, always in this order: Backlog, My Task (personal_tasks), QA
 * Module (test cases), Bug.
 *
 * <p>The CURRENT week is computed live on every request ({@link #buildItems}). Once a week is over it is FROZEN:
 * {@link #captureWeek} copies its rows into weekly_snapshots / weekly_snapshot_items and they never change again,
 * even when the items do. The catch-up ({@link #catchUp}) runs at startup and every hour; it freezes any of the
 * last {@link #CATCH_UP_WEEKS} complete weeks that is still missing. A week frozen within a day of its end is
 * "scheduled"; a later one (the server was down when the week ended) is "backfill" (shown as an estimate).
 *
 * <p>Tracking starts with the week the feature went live ({@link #trackingStart}, kept in app_settings): weeks
 * before it are never frozen or estimated, so the dashboard's past weeks start out empty (mentor's decision).
 *
 * <p>A week runs Monday 00:00 to the next Monday 00:00 in the team's time zone (app.management.week-zone, WIB by
 * default), not in the database's UTC clock, so a Monday-morning change in Jakarta lands in the new week.
 *
 * <p>What a frozen row holds, per column:
 * <ul>
 *   <li>status: AS OF the end of the week, from the history tables (backlog_status_events,
 *       personal_task_status_events, qa_test_runs, bug_progress_updates). It decides whether the item is in the
 *       list at all and whether it counts as finished that week.</li>
 *   <li>progress: from those as-of statuses (a story from its tasks as they stood then).</li>
 *   <li>title, PIC, deadline: as they are when the week is frozen; these fields have no history.</li>
 * </ul>
 *
 * <p>Inclusion rules: Backlog skips epics and anything in status `backlog` (not planned yet); a Done item only
 * counts in the week it became Done. A task whose story is also listed is placed right under it (parent_id), for
 * indentation. Bugs skip tickets already turned into a Backlog item (that item is listed instead); a closed Stage
 * only counts in the week it closed. QA skips deprecated test cases; a test case is finished by a Pass run.
 */
@Service
public class WeeklySnapshotService {

    private static final Logger log = LoggerFactory.getLogger(WeeklySnapshotService.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Complete weeks the catch-up keeps filled in, counted back from last week (never before the tracking start). */
    public static final int CATCH_UP_WEEKS = 4;
    /** app_settings key holding the Monday of the first tracked week (yyyy-MM-dd). */
    public static final String TRACKING_START_KEY = "management.tracking_start";
    /** A week frozen later than this after it ended is labelled an estimate. */
    private static final Duration ON_TIME = Duration.ofHours(24);

    @Autowired private JdbcTemplate jdbc;
    @Autowired private TransactionTemplate tx;

    private final ZoneId weekZone;

    public WeeklySnapshotService(@Value("${app.management.week-zone:Asia/Jakarta}") String weekZone) {
        this.weekZone = ZoneId.of(weekZone);
    }

    // ── Week arithmetic ──────────────────────────────────────────────────────

    public LocalDate today() { return LocalDate.now(weekZone); }

    public static LocalDate weekStartOf(LocalDate day) { return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); }

    public LocalDate currentWeekStart() { return weekStartOf(today()); }

    /**
     * Monday of the first week the dashboard tracks: the week the backend first ran with this feature. It is written
     * once (the first call stores the current week) and only read after that; to move it, update the app_settings row.
     */
    public LocalDate trackingStart() {
        jdbc.update("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING",
            TRACKING_START_KEY, currentWeekStart().toString());
        String value = jdbc.queryForObject("SELECT value FROM app_settings WHERE key = ?", String.class, TRACKING_START_KEY);
        try {
            return weekStartOf(LocalDate.parse(value.trim()));
        } catch (RuntimeException e) {
            log.warn("{} tidak valid ({}), dipakai minggu ini", TRACKING_START_KEY, value);
            return currentWeekStart();
        }
    }

    /**
     * Midnight of a day in the week zone, on the database's wall clock. Timestamps are `timestamp without time
     * zone` written by NOW() in sessions that run in the JVM's zone (the JDBC driver sets it), so that is the zone
     * stored values are compared in.
     */
    private Timestamp dbTime(LocalDate day) {
        LocalDateTime local = day.atStartOfDay(weekZone).withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        return Timestamp.valueOf(local);
    }

    // ── Building a week ──────────────────────────────────────────────────────

    /**
     * The Open Item rows of one product for the week starting on {@code weekStart} (a Monday), as they stand at the
     * end of that week. For the current week that is simply now. Every row has: source, id, parent_id, type, code,
     * title, pic (list of {id, name, color}), status, deadline ("yyyy-MM-dd" or null), is_late, progress (null =
     * not applicable), done_in_week, sort_order.
     */
    public List<Map<String, Object>> buildItems(long productId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(7);
        Timestamp start = dbTime(weekStart), end = dbTime(weekEnd);
        LocalDate t = today();
        // A deadline is over once its day has passed: by today for a running week, by Sunday for a past one.
        LocalDate lateBefore = t.isBefore(weekEnd) ? t : weekEnd;

        List<Map<String, Object>> out = new ArrayList<>();
        out.addAll(backlogRows(productId, start, end, lateBefore));
        out.addAll(personalTaskRows(productId, start, end, lateBefore));
        out.addAll(qaRows(productId, start, end, lateBefore));
        out.addAll(bugRows(productId, start, end, lateBefore));
        for (int i = 0; i < out.size(); i++) out.get(i).put("sort_order", i);
        return out;
    }

    /** JSON array of {id, name, color} for the users picked by a subquery that returns (user_id, is_primary). */
    private static String picJson(String usersSubquery) {
        return "(SELECT COALESCE(json_agg(json_build_object('id', pu.id, 'name', pu.name, 'color', pu.avatar_color) " +
               "ORDER BY px.is_primary DESC, pu.name), '[]'::json)::text " +
               "FROM (" + usersSubquery + ") px JOIN users pu ON pu.id = px.user_id) AS pic";
    }

    private List<Map<String, Object>> backlogRows(long productId, Timestamp start, Timestamp end, LocalDate lateBefore) {
        // PIC from the assignee table; the legacy single assignee column only when the table has nobody.
        String pic = picJson(
            "SELECT a.user_id, a.is_primary FROM backlog_item_assignees a WHERE a.backlog_item_id = bi.id " +
            "UNION SELECT bi.assignee_id, TRUE WHERE bi.assignee_id IS NOT NULL " +
            "  AND NOT EXISTS (SELECT 1 FROM backlog_item_assignees a2 WHERE a2.backlog_item_id = bi.id)");
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT bi.id, bi.product_id, bi.parent_id, bi.type, bi.code, bi.title, bi.deadline, bi.story_points, " +
            "  COALESCE(ev.to_status, CASE WHEN bi.created_at < ? AND NOT EXISTS " +
            "    (SELECT 1 FROM backlog_status_events x WHERE x.backlog_item_id = bi.id) THEN bi.status END) AS status, " +
            "  COALESCE((SELECT MAX(d.changed_at) FROM backlog_status_events d " +
            "    WHERE d.backlog_item_id = bi.id AND d.to_status = 'done' AND d.changed_at < ?), bi.completed_at) AS done_at, " +
            pic + " " +
            "FROM backlog_items bi " +
            "LEFT JOIN LATERAL (SELECT e.to_status FROM backlog_status_events e " +
            "  WHERE e.backlog_item_id = bi.id AND e.changed_at < ? ORDER BY e.changed_at DESC, e.id DESC LIMIT 1) ev ON TRUE " +
            "WHERE bi.product_id = ? ORDER BY bi.id",
            end, end, end, productId);
        rows.removeIf(r -> r.get("status") == null);   // did not exist yet at the end of the week

        // Progress from the as-of statuses, over everything that existed then (a story needs its tasks).
        ProgressSupport.Snapshot progress = ProgressSupport.fromRows(rows);

        Map<Long, Map<String, Object>> listed = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            String type = str(r.get("type")), status = str(r.get("status"));
            if ("epic".equals(type) || "backlog".equals(status)) continue;
            boolean done = "done".equals(status);
            if (done && !after(r.get("done_at"), start)) continue;   // finished before this week
            long id = num(r.get("id"));
            Map<String, Object> row = row("backlog", id, type, str(r.get("code")), str(r.get("title")), str(r.get("pic")),
                status, r.get("deadline"), progress.itemPct(id), done);
            row.put("is_late", isLate(r.get("deadline"), lateBefore, done || "in_review".equals(status)));
            row.put("parent_id", r.get("parent_id") == null ? null : num(r.get("parent_id")));
            listed.put(id, row);
        }
        return withChildrenUnderParents(listed);
    }

    /**
     * Orders backlog rows: open before finished, then by id; a row whose parent is also listed goes right below the
     * parent (one level). parent_id is kept only for those rows, so the table knows which ones to indent.
     */
    private static List<Map<String, Object>> withChildrenUnderParents(Map<Long, Map<String, Object>> listed) {
        Comparator<Map<String, Object>> order = Comparator
            .comparing((Map<String, Object> r) -> Boolean.TRUE.equals(r.get("done_in_week")))
            .thenComparingLong(r -> num(r.get("id")));
        Map<Long, List<Map<String, Object>>> children = new HashMap<>();
        List<Map<String, Object>> top = new ArrayList<>();
        for (Map<String, Object> r : listed.values()) {
            Object parent = r.get("parent_id");
            if (parent != null && listed.containsKey(num(parent)) && !parent.equals(r.get("id"))) {
                children.computeIfAbsent(num(parent), k -> new ArrayList<>()).add(r);
            } else {
                r.put("parent_id", null);
                top.add(r);
            }
        }
        top.sort(order);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : top) {
            out.add(r);
            List<Map<String, Object>> kids = children.get(num(r.get("id")));
            if (kids == null) continue;
            kids.sort(order);
            out.addAll(kids);
        }
        return out;
    }

    private List<Map<String, Object>> personalTaskRows(long productId, Timestamp start, Timestamp end, LocalDate lateBefore) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT pt.id, pt.title, pt.deadline, ev.to_status AS status, " +
            "  (SELECT MAX(d.changed_at) FROM personal_task_status_events d " +
            "    WHERE d.personal_task_id = pt.id AND d.to_status = 'done' AND d.changed_at < ?) AS done_at, " +
            "  json_build_array(json_build_object('id', u.id, 'name', u.name, 'color', u.avatar_color))::text AS pic " +
            "FROM personal_tasks pt " +
            "JOIN users u ON u.id = pt.owner_id " +
            "JOIN LATERAL (SELECT e.to_status FROM personal_task_status_events e " +
            "  WHERE e.personal_task_id = pt.id AND e.changed_at < ? ORDER BY e.changed_at DESC, e.id DESC LIMIT 1) ev ON TRUE " +
            "WHERE pt.product_id = ? ORDER BY pt.id",
            end, end, productId);
        List<Map<String, Object>> out = new ArrayList<>();
        List<Map<String, Object>> finished = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String status = str(r.get("status"));
            boolean done = "done".equals(status);
            if (done && !after(r.get("done_at"), start)) continue;
            Map<String, Object> row = row("mytask", num(r.get("id")), "personal", null, str(r.get("title")), str(r.get("pic")),
                status, r.get("deadline"), ProgressSupport.statusPct(status), done);
            row.put("is_late", isLate(r.get("deadline"), lateBefore, done || "in_review".equals(status)));
            (done ? finished : out).add(row);
        }
        out.addAll(finished);
        return out;
    }

    private List<Map<String, Object>> qaRows(long productId, Timestamp start, Timestamp end, LocalDate lateBefore) {
        // PIC: whoever ran the latest test, else whoever wrote the test case (test cases have no assignee).
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT tc.id, tc.code, tc.title, tc.deadline, tc.status AS tc_status, lr.result, lr.run_at, " +
            "  COALESCE((SELECT json_build_array(json_build_object('id', u.id, 'name', u.name, 'color', u.avatar_color)) " +
            "    FROM users u WHERE u.id = COALESCE(lr.tester_id, tc.created_by)), '[]'::json)::text AS pic " +
            "FROM qa_test_cases tc " +
            "LEFT JOIN LATERAL (SELECT r.result, COALESCE(r.executed_at, r.created_at) AS run_at, r.tester_id " +
            "  FROM qa_test_runs r WHERE r.test_case_id = tc.id AND COALESCE(r.executed_at, r.created_at) < ? " +
            "  ORDER BY COALESCE(r.executed_at, r.created_at) DESC, r.id DESC LIMIT 1) lr ON TRUE " +
            "WHERE tc.product_id = ? AND tc.status <> 'deprecated' AND tc.created_at < ? ORDER BY tc.id",
            end, productId, end);
        List<Map<String, Object>> out = new ArrayList<>();
        List<Map<String, Object>> finished = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String result = str(r.get("result"));
            boolean passed = "pass".equals(result);
            if (passed && !after(r.get("run_at"), start)) continue;   // passed before this week
            Map<String, Object> row = row("qa", num(r.get("id")), str(r.get("tc_status")), str(r.get("code")),
                str(r.get("title")), str(r.get("pic")), result == null ? "not_run" : result, r.get("deadline"),
                ProgressSupport.testCasePct(r.get("tc_status"), result), passed);
            row.put("is_late", isLate(r.get("deadline"), lateBefore, passed));
            (passed ? finished : out).add(row);
        }
        out.addAll(finished);
        return out;
    }

    private List<Map<String, Object>> bugRows(long productId, Timestamp start, Timestamp end, LocalDate lateBefore) {
        Map<String, boolean[]> stages = new HashMap<>();   // code -> {is_closed, not_late}
        for (Map<String, Object> s : jdbc.queryForList("SELECT code, is_closed, not_late FROM bug_stages")) {
            stages.put(str(s.get("code")), new boolean[] {
                Boolean.TRUE.equals(s.get("is_closed")), Boolean.TRUE.equals(s.get("not_late")) });
        }
        String pic = picJson("SELECT a.user_id, a.is_primary FROM bug_assignees a WHERE a.bug_id = b.id");
        // Stage as of the end of the week: the latest progress update before it. A bug with updates but none yet
        // by then was still in its starting stage (open); a bug without any update has only its current stage.
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT b.id, b.code, b.title, b.type, b.deadline, b.closed_at, " +
            "  COALESCE(up.stage, CASE WHEN EXISTS (SELECT 1 FROM bug_progress_updates x WHERE x.bug_id = b.id) " +
            "    THEN 'open' ELSE b.stage END) AS stage, " +
            "  (SELECT MAX(c.created_at) FROM bug_progress_updates c JOIN bug_stages cs ON cs.code = c.stage AND cs.is_closed " +
            "    WHERE c.bug_id = b.id AND c.created_at < ?) AS closed_update, " +
            pic + " " +
            "FROM bugs b " +
            "LEFT JOIN LATERAL (SELECT u.stage FROM bug_progress_updates u WHERE u.bug_id = b.id AND u.created_at < ? " +
            "  ORDER BY u.created_at DESC, u.id DESC LIMIT 1) up ON TRUE " +
            "WHERE b.product_id = ? AND b.created_at < ? AND b.converted_backlog_id IS NULL ORDER BY b.id",
            end, end, productId, end);
        List<Map<String, Object>> out = new ArrayList<>();
        List<Map<String, Object>> finished = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String stage = str(r.get("stage"));
            boolean[] flags = stages.getOrDefault(stage, new boolean[] { false, false });   // unknown stage: still open
            boolean closed = flags[0];
            if (closed) {
                Object closedAt = r.get("closed_update") != null ? r.get("closed_update") : r.get("closed_at");
                if (!after(closedAt, start)) continue;   // closed before this week (or with no known time)
            }
            Map<String, Object> row = row("bug", num(r.get("id")), str(r.get("type")), str(r.get("code")),
                str(r.get("title")), str(r.get("pic")), stage, r.get("deadline"), null, closed);
            row.put("is_late", isLate(r.get("deadline"), lateBefore, closed || flags[1]));
            (closed ? finished : out).add(row);
        }
        out.addAll(finished);
        return out;
    }

    private static Map<String, Object> row(String source, long id, String type, String code, String title, String picJson,
                                           String status, Object deadline, Integer progress, boolean doneInWeek) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("source", source);
        m.put("id", id);
        m.put("parent_id", null);
        m.put("type", type);
        m.put("code", code);
        m.put("title", title);
        m.put("pic", parsePic(picJson));
        m.put("status", status);
        m.put("deadline", deadline == null ? null : deadline.toString().substring(0, 10));
        m.put("is_late", false);
        m.put("progress", progress);
        m.put("done_in_week", doneInWeek);
        return m;
    }

    private static boolean isLate(Object deadline, LocalDate lateBefore, boolean neverLate) {
        if (neverLate || deadline == null) return false;
        return LocalDate.parse(deadline.toString().substring(0, 10)).isBefore(lateBefore);
    }

    /** true when the timestamp is at or after the bound (null = unknown = not after). */
    private static boolean after(Object ts, Timestamp bound) {
        return ts instanceof Timestamp && !((Timestamp) ts).before(bound);
    }

    private static List<Map<String, Object>> parsePic(String json) {
        if (json == null) return List.of();
        try {
            return JSON.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    // ── Freezing ─────────────────────────────────────────────────────────────

    /**
     * Freezes one finished week of one product. Returns false when it was already frozen: a frozen week is never
     * rewritten. Header and rows go in one transaction, so a week is either complete or absent.
     */
    public boolean captureWeek(long productId, LocalDate weekStart, String source) {
        if (weekStart.getDayOfWeek() != DayOfWeek.MONDAY) throw new IllegalArgumentException("week_start harus hari Senin");
        if (weekStart.plusDays(7).isAfter(today())) throw new IllegalArgumentException("Minggu ini belum selesai");
        List<Map<String, Object>> items = buildItems(productId, weekStart);
        Boolean captured = tx.execute(status -> {
            List<Long> ids = jdbc.queryForList(
                "INSERT INTO weekly_snapshots (week_start, product_id, source) VALUES (?,?,?) " +
                "ON CONFLICT (week_start, product_id) DO NOTHING RETURNING id",
                Long.class, Date.valueOf(weekStart), productId, source);
            if (ids.isEmpty()) return false;
            long snapshotId = ids.get(0);
            List<Object[]> batch = new ArrayList<>();
            for (Map<String, Object> r : items) {
                batch.add(new Object[] {
                    snapshotId, r.get("source"), r.get("id"), r.get("parent_id"), r.get("type"), r.get("code"),
                    r.get("title"), toJson(r.get("pic")), r.get("status"),
                    r.get("deadline") == null ? null : Date.valueOf(r.get("deadline").toString()),
                    r.get("is_late"), r.get("progress"), r.get("done_in_week"), r.get("sort_order") });
            }
            if (!batch.isEmpty()) {
                jdbc.batchUpdate(
                    "INSERT INTO weekly_snapshot_items (snapshot_id, item_source, item_id, parent_item_id, item_type, code, " +
                    "  title, pic, status, deadline, is_late, progress, done_in_week, sort_order) " +
                    "VALUES (?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?)", batch);
            }
            return true;
        });
        return Boolean.TRUE.equals(captured);
    }

    private static String toJson(Object v) {
        try { return JSON.writeValueAsString(v); } catch (Exception e) { return "[]"; }
    }

    @Scheduled(cron = "0 5 * * * *")
    public void scheduledCatchUp() { catchUp(); }

    @EventListener(ApplicationReadyEvent.class)
    public void catchUpOnStartup() { catchUp(); }

    /**
     * Freezes every missing week among the last {@link #CATCH_UP_WEEKS} complete weeks, from the tracking start on,
     * for every product that existed by the end of that week. Never throws (it also runs on the startup thread): a
     * database without migration v33 just logs a warning, and any other failure is logged and retried on the next
     * hourly run. Returns how many (product, week) pairs were frozen.
     */
    public synchronized int catchUp() {
        try {
            LocalDate start = trackingStart();
            LocalDate current = currentWeekStart();
            ZonedDateTime now = ZonedDateTime.now(weekZone);
            List<Map<String, Object>> products = jdbc.queryForList("SELECT id, created_at FROM products ORDER BY id");
            int captured = 0;
            for (int k = CATCH_UP_WEEKS; k >= 1; k--) {   // oldest first, so ids follow the calendar
                LocalDate week = current.minusWeeks(k);
                if (week.isBefore(start)) continue;   // before tracking began: left empty, never estimated
                Timestamp end = dbTime(week.plusDays(7));
                boolean onTime = k == 1
                    && Duration.between(week.plusDays(7).atStartOfDay(weekZone), now).compareTo(ON_TIME) < 0;
                for (Map<String, Object> p : products) {
                    Object created = p.get("created_at");
                    if (created instanceof Timestamp && !((Timestamp) created).before(end)) continue;   // product came later
                    long productId = num(p.get("id"));
                    if (frozenWeek(productId, week) != null) continue;   // the usual hourly case: nothing to do
                    if (captureWeek(productId, week, onTime ? "scheduled" : "backfill")) captured++;
                }
            }
            if (captured > 0) log.info("Snapshot mingguan: {} minggu-produk dibekukan", captured);
            return captured;
        } catch (DataAccessException e) {
            log.warn("Snapshot mingguan dilewati (migration v33 sudah dijalankan?): {}", e.getMostSpecificCause().getMessage());
            return 0;
        } catch (RuntimeException e) {
            // Runs on the startup thread: a bug here must never keep the whole backend from starting.
            log.error("Snapshot mingguan gagal", e);
            return 0;
        }
    }

    // ── Reading frozen weeks ─────────────────────────────────────────────────

    /** Frozen weeks of a product, newest first: week_start, source, captured_at. */
    public List<Map<String, Object>> frozenWeeks(long productId) {
        return jdbc.queryForList(
            "SELECT week_start, source, captured_at FROM weekly_snapshots WHERE product_id = ? ORDER BY week_start DESC",
            productId);
    }

    /** The header of a frozen week (null when that week is not frozen). */
    public Map<String, Object> frozenWeek(long productId, LocalDate weekStart) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, week_start, source, captured_at FROM weekly_snapshots WHERE product_id = ? AND week_start = ?",
            productId, Date.valueOf(weekStart));
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** The rows of a frozen week, in the same shape as {@link #buildItems}. */
    public List<Map<String, Object>> frozenItems(long snapshotId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT item_source, item_id, parent_item_id, item_type, code, title, pic::text AS pic, status, deadline, " +
            "  is_late, progress, done_in_week, sort_order " +
            "FROM weekly_snapshot_items WHERE snapshot_id = ? ORDER BY sort_order, id", snapshotId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = row(str(r.get("item_source")), num(r.get("item_id")), str(r.get("item_type")),
                str(r.get("code")), str(r.get("title")), str(r.get("pic")), str(r.get("status")), r.get("deadline"),
                r.get("progress") == null ? null : ((Number) r.get("progress")).intValue(),
                Boolean.TRUE.equals(r.get("done_in_week")));
            m.put("parent_id", r.get("parent_item_id") == null ? null : num(r.get("parent_item_id")));
            m.put("is_late", Boolean.TRUE.equals(r.get("is_late")));
            m.put("sort_order", r.get("sort_order"));
            out.add(m);
        }
        return out;
    }

    // ── Small helpers ────────────────────────────────────────────────────────

    private static String str(Object o) { return o == null ? null : o.toString(); }

    private static long num(Object o) { return ((Number) o).longValue(); }
}
