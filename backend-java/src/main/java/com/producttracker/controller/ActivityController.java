package com.producttracker.controller;

import com.producttracker.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
public class ActivityController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EmailService email;

    private static final Pattern MENTION_PATTERN = Pattern.compile("@\\[([^\\]]+)\\]");

    @GetMapping("/api/backlog/{id}/activities")
    public ResponseEntity<?> list(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT a.id, a.type, a.content, a.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_avatar_color " +
            "FROM item_activities a " +
            "LEFT JOIN users u ON u.id = a.user_id " +
            "WHERE a.backlog_item_id = ? " +
            "ORDER BY a.created_at ASC",
            id);
        return ResponseEntity.ok(rows);
    }

    @PostMapping({"/api/backlog/{id}/comments", "/api/backlog/{id}/activities"})
    public ResponseEntity<?> addComment(@PathVariable Long id,
                                         @RequestBody Map<String, Object> body,
                                         @AuthenticationPrincipal Object principal) {
        String content = (String) body.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Komentar tidak boleh kosong"));
        }
        Long userId = currentUserId(principal);

        // Verify item exists
        List<Map<String, Object>> item = jdbc.queryForList(
            "SELECT id, code FROM backlog_items WHERE id = ?", id
        );
        if (item.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Item tidak ditemukan"));

        Map<String, Object> row = jdbc.queryForMap(
            "INSERT INTO item_activities (backlog_item_id, user_id, type, content) " +
            "VALUES (?,?,?,?) RETURNING id, type, content, created_at",
            id, userId, "comment", content.trim()
        );

        notifyMentions(id, str(item.get(0).get("code")), userId, content.trim());

        // Fetch with user info
        List<Map<String, Object>> full = jdbc.queryForList(
            "SELECT a.id, a.type, a.content, a.created_at, " +
            "       u.name AS user_name, u.avatar_color AS user_avatar_color " +
            "FROM item_activities a " +
            "LEFT JOIN users u ON u.id = a.user_id " +
            "WHERE a.id = ?",
            row.get("id"));

        return ResponseEntity.status(201).body(full.get(0));
    }

    @DeleteMapping("/api/activities/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                     @AuthenticationPrincipal Object principal) {
        Long userId = currentUserId(principal);
        String roleName = currentRoleName(principal);
        boolean isSuperAdmin = "super_admin".equals(roleName);

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id, type FROM item_activities WHERE id = ?", id
        );
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Aktivitas tidak ditemukan"));

        String type = (String) rows.get(0).get("type");
        if ("change_log".equals(type)) {
            return ResponseEntity.status(403).body(Map.of("error", "Log perubahan tidak dapat dihapus"));
        }

        Object ownerId = rows.get(0).get("user_id");
        boolean isOwner = ownerId != null && ownerId.toString().equals(String.valueOf(userId));
        if (!isOwner && !isSuperAdmin) {
            return ResponseEntity.status(403).body(Map.of("error", "Hanya bisa menghapus komentar sendiri"));
        }

        jdbc.update("DELETE FROM item_activities WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Komentar dihapus"));
    }

    private void notifyMentions(Long itemId, String itemCode, Long commenterId, String content) {
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

            try {
                jdbc.update(
                    "INSERT INTO notifications (user_id, type, title, message, link) VALUES (?,?,?,?,?)",
                    mentionedId, "mention",
                    commenterName + " menyebut kamu di " + itemCode,
                    snippet,
                    "/backlog?item=" + itemId
                );
            } catch (Exception ignored) {}

            email.notifyMention(str(rows.get(0).get("email")), commenterName, snippet,
                "Backlog", itemCode, "/backlog?item=" + itemId);
        }
    }

    private String str(Object v) { return v == null ? "" : v.toString(); }

    @SuppressWarnings("unchecked")
    private Long currentUserId(Object principal) {
        if (!(principal instanceof Map)) return null;
        Object id = ((Map<String, Object>) principal).get("id");
        if (id instanceof Number) return ((Number) id).longValue();
        try { return Long.parseLong(id.toString()); } catch (Exception e) { return null; }
    }

    @SuppressWarnings("unchecked")
    private String currentRoleName(Object principal) {
        if (!(principal instanceof Map)) return "";
        Object rn = ((Map<String, Object>) principal).get("role_name");
        return rn == null ? "" : rn.toString();
    }
}
