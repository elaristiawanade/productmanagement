package com.producttracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

// Online / away / offline dot on avatars (table user_presence, migration v22).
// Every open tab sends a heartbeat about every 30s with state "online" (visible tab, recent activity)
// or "away" (hidden or idle tab). Status is derived when reading, so several tabs never fight:
// any active tab within ONLINE_WINDOW keeps the user online.
@RestController
@RequestMapping("/api/presence")
public class PresenceController {

    private static final int ONLINE_WINDOW_SEC = 75;
    // Browsers throttle timers in hidden tabs (down to ~1/min), so "offline" waits well past one missed beat.
    private static final int OFFLINE_AFTER_SEC = 150;

    @Autowired
    private JdbcTemplate jdbc;

    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@RequestBody(required = false) Map<String, Object> body,
                                       @AuthenticationPrincipal Object principal) {
        Long userId = currentUserId(principal);
        if (userId == null) return ResponseEntity.status(401).build();
        boolean active = body != null && "online".equals(body.get("state"));
        jdbc.update(
            "INSERT INTO user_presence (user_id, last_seen_at, last_active_at) " +
            "VALUES (?, NOW(), CASE WHEN ? THEN NOW() END) " +
            "ON CONFLICT (user_id) DO UPDATE SET last_seen_at = NOW(), " +
            "last_active_at = CASE WHEN ? THEN NOW() ELSE user_presence.last_active_at END",
            userId, active, active
        );
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // Explicit logout: show offline right away instead of waiting for the heartbeat to expire.
    @PostMapping("/offline")
    public ResponseEntity<?> offline(@AuthenticationPrincipal Object principal) {
        Long userId = currentUserId(principal);
        if (userId == null) return ResponseEntity.status(401).build();
        jdbc.update("DELETE FROM user_presence WHERE user_id = ?", userId);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // Users without a row are offline; the client treats a missing id as offline.
    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal Object principal) {
        if (currentUserId(principal) == null) return ResponseEntity.status(401).build();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id, last_seen_at, last_active_at, " +
            "CASE WHEN last_seen_at < NOW() - make_interval(secs => ?) THEN 'offline' " +
            "     WHEN last_active_at >= NOW() - make_interval(secs => ?) THEN 'online' " +
            "     ELSE 'away' END AS status " +
            "FROM user_presence",
            OFFLINE_AFTER_SEC, ONLINE_WINDOW_SEC
        );
        return ResponseEntity.ok(rows);
    }

    @SuppressWarnings("unchecked")
    private Long currentUserId(Object principal) {
        if (!(principal instanceof Map)) return null;
        Object id = ((Map<String, Object>) principal).get("id");
        if (id instanceof Number) return ((Number) id).longValue();
        try { return Long.parseLong(id.toString()); } catch (Exception e) { return null; }
    }
}
