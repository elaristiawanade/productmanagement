package com.producttracker.controller;

import com.producttracker.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");
        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email dan password wajib diisi"));
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT u.*, r.name AS role_name, r.display_name AS role_display, r.permissions " +
            "FROM users u LEFT JOIN roles r ON r.id = u.role_id " +
            "WHERE u.email = ?",
            email.toLowerCase().trim()
        );

        if (rows.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Email atau password salah"));
        }

        Map<String, Object> user = rows.get(0);
        Boolean isActive = (Boolean) user.get("is_active");
        if (isActive == null || !isActive) {
            return ResponseEntity.status(401).body(Map.of("error", "Email atau password salah"));
        }

        if (!passwordEncoder.matches(password, (String) user.get("password_hash"))) {
            return ResponseEntity.status(401).body(Map.of("error", "Email atau password salah"));
        }

        String token = jwtUtil.generateToken(email, Map.of("userId", user.get("id")));

        Map<String, Object> userDto = new HashMap<>();
        userDto.put("id", user.get("id"));
        userDto.put("name", user.get("name"));
        userDto.put("email", user.get("email"));
        userDto.put("role", user.get("role_name"));
        userDto.put("roleDisplay", user.get("role_display"));
        userDto.put("permissions", user.get("permissions"));
        userDto.put("avatarColor", user.get("avatar_color"));
        userDto.put("department", user.get("department"));

        return ResponseEntity.ok(Map.of("token", token, "user", userDto));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal Object principal) {
        Map<String, Object> u = currentUser(principal);
        if (u == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", u.get("id"));
        dto.put("name", u.get("name"));
        dto.put("email", u.get("email"));
        dto.put("role", u.get("role_name"));
        dto.put("permissions", u.get("permissions"));
        dto.put("avatarColor", u.get("avatar_color"));
        dto.put("department", u.get("department"));
        return ResponseEntity.ok(dto);
    }

    @PutMapping("/change-password")
    public ResponseEntity<?> changePassword(@AuthenticationPrincipal Object principal,
                                             @RequestBody Map<String, String> body) {
        Map<String, Object> u = currentUser(principal);
        if (u == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        if (currentPassword == null || newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Data tidak lengkap"));
        }
        if (newPassword.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password minimal 6 karakter"));
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT password_hash FROM users WHERE id = ?", u.get("id")
        );
        if (!passwordEncoder.matches(currentPassword, (String) rows.get(0).get("password_hash"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password lama salah"));
        }

        jdbc.update("UPDATE users SET password_hash = ? WHERE id = ?",
            passwordEncoder.encode(newPassword), u.get("id"));
        return ResponseEntity.ok(Map.of("message", "Password berhasil diubah"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> currentUser(Object principal) {
        if (principal instanceof Map) return (Map<String, Object>) principal;
        return null;
    }
}
