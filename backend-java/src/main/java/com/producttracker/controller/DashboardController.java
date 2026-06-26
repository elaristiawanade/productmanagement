package com.producttracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private JdbcTemplate jdbc;

    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        List<Map<String, Object>> products = jdbc.queryForList(
            "SELECT " +
            "  p.id, p.code, p.name, p.color, p.status AS product_status, " +
            "  u.name AS owner_name, " +
            "  COUNT(bi.id)                                                         AS total_items, " +
            "  COUNT(CASE WHEN bi.status = 'todo'        THEN 1 END)               AS todo, " +
            "  COUNT(CASE WHEN bi.status = 'in_progress' THEN 1 END)               AS in_progress, " +
            "  COUNT(CASE WHEN bi.status = 'in_review'   THEN 1 END)               AS in_review, " +
            "  COUNT(CASE WHEN bi.status = 'done'        THEN 1 END)               AS done, " +
            "  COUNT(CASE WHEN bi.status = 'blocked'     THEN 1 END)               AS blocked, " +
            "  COUNT(CASE WHEN bi.status = 'backlog'     THEN 1 END)               AS backlog_count, " +
            "  COUNT(CASE WHEN bi.deadline < NOW() AND bi.status NOT IN ('done','backlog') THEN 1 END) AS delayed, " +
            "  COALESCE(SUM(bi.story_points), 0)                                    AS total_points, " +
            "  COALESCE(SUM(CASE WHEN bi.status = 'done' THEN bi.story_points ELSE 0 END), 0) AS done_points, " +
            "  (SELECT name FROM sprints WHERE product_id = p.id AND status = 'active' LIMIT 1) AS active_sprint " +
            "FROM products p " +
            "LEFT JOIN backlog_items bi ON bi.product_id = p.id " +
            "LEFT JOIN users u          ON u.id = p.owner_id " +
            "GROUP BY p.id, p.code, p.name, p.color, p.status, u.name " +
            "ORDER BY p.id");

        Map<String, Object> totals = jdbc.queryForMap(
            "SELECT " +
            "  COUNT(*)                                                              AS total_items, " +
            "  COUNT(CASE WHEN status = 'in_progress' THEN 1 END)                  AS in_progress, " +
            "  COUNT(CASE WHEN status = 'blocked'     THEN 1 END)                  AS blocked, " +
            "  COUNT(CASE WHEN deadline < NOW() AND status NOT IN ('done','backlog') THEN 1 END) AS delayed, " +
            "  COUNT(CASE WHEN status = 'done'        THEN 1 END)                  AS done " +
            "FROM backlog_items");

        return ResponseEntity.ok(Map.of("products", products, "totals", totals));
    }

    @GetMapping("/velocity")
    public ResponseEntity<?> velocity() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " +
            "  s.id AS sprint_id, s.name AS sprint, p.id AS product_id, p.name AS product, p.color, " +
            "  s.committed_points, s.completed_points, s.status " +
            "FROM sprints s " +
            "JOIN products p ON p.id = s.product_id " +
            "WHERE s.status IN ('active','completed') " +
            "ORDER BY p.id, s.start_date");
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/workload")
    public ResponseEntity<?> workload() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " +
            "  u.id, u.name, u.avatar_color, " +
            "  r.display_name AS role, " +
            "  COUNT(bi.id)                                                  AS total_assigned, " +
            "  COUNT(CASE WHEN bi.status = 'in_progress' THEN 1 END)        AS in_progress, " +
            "  COUNT(CASE WHEN bi.status IN ('todo','in_review') THEN 1 END) AS pending, " +
            "  COALESCE(SUM(bi.story_points), 0)                             AS total_points " +
            "FROM users u " +
            "LEFT JOIN backlog_items bi ON bi.assignee_id = u.id " +
            "  AND bi.status NOT IN ('done','backlog') " +
            "  AND bi.type NOT IN ('story','epic') " +
            "LEFT JOIN roles r ON r.id = u.role_id " +
            "WHERE u.is_active = true " +
            "  AND r.name IN ('po', 'developer') " +
            "GROUP BY u.id, u.name, u.avatar_color, r.display_name " +
            "ORDER BY total_assigned DESC");
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/occupation")
    public ResponseEntity<?> occupation() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " +
            "  u.id, u.name, u.avatar_color, " +
            "  r.display_name AS role, " +
            "  COALESCE(SUM(CASE WHEN bi.type = 'independent' THEN 0 ELSE bi.story_points END), 0) AS total_sp, " +
            "  COALESCE(SUM(CASE WHEN bi.type = 'independent' " +
            "                    THEN COALESCE(bi.estimated_hours, 0) " +
            "                    ELSE bi.story_points * 6 END), 0) AS total_hours, " +
            "  COUNT(bi.id)                            AS total_items, " +
            "  COUNT(CASE WHEN bi.status = 'done' THEN 1 END) AS done_items " +
            "FROM users u " +
            "LEFT JOIN backlog_items bi ON bi.assignee_id = u.id " +
            "  AND ( " +
            "    bi.sprint_id IN (SELECT id FROM sprints WHERE status = 'active') " +
            "    OR bi.type = 'independent' " +
            "  ) " +
            "  AND bi.status NOT IN ('backlog', 'done') " +
            "LEFT JOIN roles r ON r.id = u.role_id " +
            "WHERE u.is_active = true " +
            "GROUP BY u.id, u.name, u.avatar_color, r.display_name " +
            "ORDER BY total_hours DESC");
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/delayed")
    public ResponseEntity<?> delayed() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " +
            "  bi.id, bi.code, bi.title, bi.status, bi.priority, bi.story_points, " +
            "  bi.deadline, p.name AS product, p.color, p.code AS product_code, " +
            "  u.name AS assignee, s.name AS sprint, " +
            "  (NOW()::date - bi.deadline) AS days_overdue " +
            "FROM backlog_items bi " +
            "JOIN products p ON p.id = bi.product_id " +
            "LEFT JOIN users u   ON u.id = bi.assignee_id " +
            "LEFT JOIN sprints s ON s.id = bi.sprint_id " +
            "WHERE bi.deadline < NOW() AND bi.status NOT IN ('done','backlog') " +
            "ORDER BY bi.deadline ASC " +
            "LIMIT 20");
        return ResponseEntity.ok(rows);
    }
}
