package com.producttracker.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import javax.mail.internet.MimeMessage;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.CompletableFuture;

/**
 * SMTP config is read live from SettingsService (app_settings table, with
 * env-var fallback) on every send, so changes made in the Notification
 * Settings page take effect immediately without a backend restart.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    @Autowired
    private SettingsService settings;

    @Value("${app.cors.origin:}")
    private String frontendOrigin;

    public void notifyAssignment(String toEmail, String moduleLabel, String code, String title,
                                  String actorName, String link) {
        Map<String, String> cfg = settings.getMailConfig();
        if (!isEnabled(cfg, toEmail)) return;
        send(cfg, toEmail, moduleLabel + " " + code + " di-assign ke kamu",
            buildBody("Kamu di-assign ke " + code, new String[][]{
                {"Modul", moduleLabel},
                {"Judul", title},
                {"Di-assign oleh", actorName},
            }, link));
    }

    public void notifyStatusChange(String toEmail, String moduleLabel, String code, String title,
                                    String oldStatus, String newStatus, String actorName, String link) {
        Map<String, String> cfg = settings.getMailConfig();
        if (!isEnabled(cfg, toEmail)) return;
        send(cfg, toEmail, moduleLabel + " " + code + " status berubah",
            buildBody("Status " + code + " berubah", new String[][]{
                {"Modul", moduleLabel},
                {"Judul", title},
                {"Status lama", oldStatus},
                {"Status baru", newStatus},
                {"Diubah oleh", actorName},
            }, link));
    }

    public void notifyMention(String toEmail, String commenterName, String snippet,
                               String moduleLabel, String code, String link) {
        Map<String, String> cfg = settings.getMailConfig();
        if (!isEnabled(cfg, toEmail)) return;
        send(cfg, toEmail, commenterName + " menyebut kamu di " + code,
            buildBody(commenterName + " menyebut kamu di " + moduleLabel + " " + code, new String[][]{
                {"Komentar", snippet},
            }, link));
    }

    /**
     * Synchronous send used by the "Kirim Email Tes" button in Notification
     * Settings — returns null on success, or the error message on failure,
     * so the API response can show the result directly instead of requiring
     * a look at the backend logs.
     */
    public String sendTest(String toEmail) {
        Map<String, String> cfg = settings.getMailConfig();
        if (toEmail == null || toEmail.isBlank()) return "Alamat tujuan wajib diisi";
        try {
            sendNow(cfg, toEmail, "Email Tes — Product Tracker",
                buildBody("Ini email tes dari Notification Settings", new String[][]{
                    {"Host", cfg.get("host")},
                    {"Port", cfg.get("port")},
                }, null));
            return null;
        } catch (Exception e) {
            return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private boolean isEnabled(Map<String, String> cfg, String toEmail) {
        return Boolean.parseBoolean(cfg.get("enabled")) && toEmail != null && !toEmail.isBlank();
    }

    private String buildBody(String heading, String[][] facts, String link) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div style=\"font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;\">");
        sb.append("<h2 style=\"margin:0 0 12px;font-size:16px;\">").append(escape(heading)).append("</h2>");
        sb.append("<table style=\"border-collapse:collapse;\">");
        for (String[] f : facts) {
            if (f[1] == null || f[1].isBlank()) continue;
            sb.append("<tr><td style=\"padding:4px 12px 4px 0;color:#64748b;\">").append(escape(f[0]))
              .append("</td><td style=\"padding:4px 0;\">").append(escape(f[1])).append("</td></tr>");
        }
        sb.append("</table>");
        String fullLink = absoluteLink(link);
        if (fullLink != null) {
            sb.append("<p style=\"margin-top:16px;\">")
              .append("<a href=\"").append(fullLink).append("\" style=\"color:#4f46e5;\">Buka di Product Tracker</a>")
              .append("</p>");
        }
        sb.append("</div>");
        return sb.toString();
    }

    private String absoluteLink(String link) {
        if (link == null || link.isBlank()) return null;
        if (link.startsWith("http://") || link.startsWith("https://")) return link;
        if (frontendOrigin == null || frontendOrigin.isBlank()) return null;
        String base = frontendOrigin.endsWith("/") ? frontendOrigin.substring(0, frontendOrigin.length() - 1) : frontendOrigin;
        String path = link.startsWith("/") ? link : "/" + link;
        return base + path;
    }

    private String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private JavaMailSenderImpl buildMailSender(Map<String, String> cfg) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(cfg.get("host"));
        sender.setPort(Integer.parseInt(cfg.get("port")));
        sender.setUsername(cfg.get("username"));
        sender.setPassword(cfg.get("password"));
        Properties props = sender.getJavaMailProperties();
        props.put("mail.smtp.auth", cfg.get("smtp_auth"));
        props.put("mail.smtp.starttls.enable", cfg.get("smtp_starttls"));
        return sender;
    }

    private void sendNow(Map<String, String> cfg, String toEmail, String subject, String htmlBody) throws Exception {
        JavaMailSenderImpl sender = buildMailSender(cfg);
        MimeMessage message = sender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
        helper.setTo(toEmail);
        String from = cfg.get("from");
        if (from != null && !from.isBlank()) helper.setFrom(from);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);
        sender.send(message);
    }

    private void send(Map<String, String> cfg, String toEmail, String subject, String htmlBody) {
        CompletableFuture.runAsync(() -> {
            try {
                sendNow(cfg, toEmail, subject, htmlBody);
                log.info("Email notifikasi terkirim ke {}", toEmail);
            } catch (Exception e) {
                // best-effort; never propagate failure to the caller
                log.warn("Gagal kirim email notifikasi ke {}: {}", toEmail, e.getMessage());
            }
        });
    }
}
