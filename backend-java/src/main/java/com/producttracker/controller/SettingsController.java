package com.producttracker.controller;

import com.producttracker.config.PermissionHelper;
import com.producttracker.service.EmailService;
import com.producttracker.service.SettingsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    @Autowired
    private SettingsService settingsService;

    @Autowired
    private EmailService emailService;

    @GetMapping("/mail")
    public ResponseEntity<?> getMail(@AuthenticationPrincipal Object principal) {
        if (!PermissionHelper.isSuperAdmin(principal)) return forbidden();

        Map<String, String> cfg = settingsService.getMailConfig();
        Map<String, Object> body = new HashMap<>();
        body.put("enabled", Boolean.parseBoolean(cfg.get("enabled")));
        body.put("host", cfg.get("host"));
        body.put("port", cfg.get("port"));
        body.put("username", cfg.get("username"));
        body.put("from", cfg.get("from"));
        body.put("smtp_auth", Boolean.parseBoolean(cfg.get("smtp_auth")));
        body.put("smtp_starttls", Boolean.parseBoolean(cfg.get("smtp_starttls")));
        body.put("password_set", cfg.get("password") != null && !cfg.get("password").isBlank());
        return ResponseEntity.ok(body);
    }

    @PutMapping("/mail")
    public ResponseEntity<?> updateMail(@AuthenticationPrincipal Object principal,
                                         @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.isSuperAdmin(principal)) return forbidden();

        Map<String, String> values = new HashMap<>();
        values.put("enabled", String.valueOf(body.get("enabled")));
        values.put("host", str(body.get("host")));
        values.put("port", str(body.get("port")));
        values.put("username", str(body.get("username")));
        values.put("password", str(body.get("password")));
        values.put("from", str(body.get("from")));
        values.put("smtp_auth", String.valueOf(body.get("smtp_auth")));
        values.put("smtp_starttls", String.valueOf(body.get("smtp_starttls")));

        settingsService.updateMailConfig(values, PermissionHelper.getUserId(principal));
        return ResponseEntity.ok(Map.of("message", "Konfigurasi email disimpan"));
    }

    @PostMapping("/mail/test")
    public ResponseEntity<?> testMail(@AuthenticationPrincipal Object principal,
                                       @RequestBody Map<String, Object> body) {
        if (!PermissionHelper.isSuperAdmin(principal)) return forbidden();

        String to = str(body.get("to"));
        String error = emailService.sendTest(to);
        if (error == null) return ResponseEntity.ok(Map.of("success", true));
        return ResponseEntity.ok(Map.of("success", false, "error", error));
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("error", "Hanya Super Admin yang bisa mengubah pengaturan ini"));
    }

    private String str(Object v) { return v == null ? "" : v.toString(); }
}
