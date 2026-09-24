package com.producttracker.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Runtime-editable settings backed by the app_settings key-value table.
 * Falls back to the env-var defaults (application.yml) when a key has never
 * been saved via the Notification Settings page, so existing .env-only
 * deployments keep working unchanged.
 */
@Service
public class SettingsService {

    @Autowired
    private JdbcTemplate jdbc;

    @Value("${app.mail.enabled:false}")
    private boolean defaultEnabled;
    @Value("${spring.mail.host:smtp.office365.com}")
    private String defaultHost;
    @Value("${spring.mail.port:587}")
    private String defaultPort;
    @Value("${spring.mail.username:}")
    private String defaultUsername;
    @Value("${spring.mail.password:}")
    private String defaultPassword;
    @Value("${app.mail.from:}")
    private String defaultFrom;
    @Value("${spring.mail.properties.mail.smtp.auth:true}")
    private boolean defaultSmtpAuth;
    @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}")
    private boolean defaultSmtpStarttls;

    private static final String PREFIX = "mail.";

    public Map<String, String> getMailConfig() {
        Map<String, String> stored = new HashMap<>();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT key, value FROM app_settings WHERE key LIKE ?", PREFIX + "%"
        );
        for (Map<String, Object> row : rows) {
            String key = ((String) row.get("key")).substring(PREFIX.length());
            stored.put(key, (String) row.get("value"));
        }

        Map<String, String> config = new HashMap<>();
        config.put("enabled", stored.getOrDefault("enabled", String.valueOf(defaultEnabled)));
        config.put("host", stored.getOrDefault("host", defaultHost));
        config.put("port", stored.getOrDefault("port", defaultPort));
        config.put("username", stored.getOrDefault("username", defaultUsername));
        config.put("password", stored.getOrDefault("password", defaultPassword));
        config.put("from", stored.getOrDefault("from", defaultFrom));
        config.put("smtp_auth", stored.getOrDefault("smtp_auth", String.valueOf(defaultSmtpAuth)));
        config.put("smtp_starttls", stored.getOrDefault("smtp_starttls", String.valueOf(defaultSmtpStarttls)));
        return config;
    }

    public void updateMailConfig(Map<String, String> values, Long updatedBy) {
        for (Map.Entry<String, String> entry : values.entrySet()) {
            if ("password".equals(entry.getKey()) && (entry.getValue() == null || entry.getValue().isBlank())) {
                continue; // blank password = keep the existing one
            }
            upsert(PREFIX + entry.getKey(), entry.getValue(), updatedBy);
        }
    }

    private void upsert(String key, String value, Long updatedBy) {
        jdbc.update(
            "INSERT INTO app_settings (key, value, updated_by) VALUES (?,?,?) " +
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by",
            key, value, updatedBy
        );
    }
}
