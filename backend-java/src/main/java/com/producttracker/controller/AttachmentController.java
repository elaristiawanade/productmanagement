package com.producttracker.controller;

import com.producttracker.config.BugHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class AttachmentController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private BugHelper bugHelper;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @GetMapping("/backlog/{id}/attachments")
    public ResponseEntity<?> list(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT a.*, u.name AS uploaded_by_name " +
            "FROM backlog_attachments a " +
            "LEFT JOIN users u ON u.id = a.uploaded_by " +
            "WHERE a.backlog_item_id = ? ORDER BY a.created_at",
            id
        );
        // Add URL field for each attachment
        rows.forEach(r -> r.put("url", "/api/attachments/file/" + r.get("filename")));
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/backlog/{id}/attachments")
    public ResponseEntity<?> upload(@PathVariable Long id,
                                    @RequestParam("file") MultipartFile file,
                                    @AuthenticationPrincipal Object principal) {
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Hanya file gambar yang diperbolehkan (JPEG, PNG, GIF, WebP)"));
        }
        if (file.getSize() > 10L * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "Ukuran file maksimal 10MB"));
        }

        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath();
            Files.createDirectories(uploadPath);

            String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
            String ext = original.contains(".") ? original.substring(original.lastIndexOf(".")) : "";
            String filename = UUID.randomUUID().toString() + ext;

            Files.copy(file.getInputStream(), uploadPath.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

            @SuppressWarnings("unchecked")
            Map<String, Object> user = principal instanceof Map ? (Map<String, Object>) principal : null;
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO backlog_attachments (backlog_item_id, filename, original_name, file_size, mime_type, uploaded_by) " +
                "VALUES (?,?,?,?,?,?) RETURNING *",
                id, filename, original, file.getSize(), contentType,
                user != null ? user.get("id") : null
            );
            row.put("url", "/api/attachments/file/" + filename);
            return ResponseEntity.status(201).body(row);
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("error", "Gagal menyimpan file"));
        }
    }

    @GetMapping("/bugs/{id}/attachments")
    public ResponseEntity<?> listBugAttachments(@PathVariable Long id, @AuthenticationPrincipal Object principal) {
        if (!bugHelper.canAccess(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke modul Bugs Incident"));
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT a.*, u.name AS uploaded_by_name " +
            "FROM bug_attachments a " +
            "LEFT JOIN users u ON u.id = a.uploaded_by " +
            "WHERE a.bug_id = ? ORDER BY a.created_at",
            id
        );
        rows.forEach(r -> r.put("url", "/api/attachments/file/" + r.get("filename")));
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/bugs/{id}/attachments")
    public ResponseEntity<?> uploadBugAttachment(@PathVariable Long id,
                                    @RequestParam("file") MultipartFile file,
                                    @AuthenticationPrincipal Object principal) {
        if (!bugHelper.canAccess(principal)) {
            return ResponseEntity.status(403).body(Map.of("error", "Tidak memiliki akses ke modul Bugs Incident"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Hanya file gambar yang diperbolehkan (JPEG, PNG, GIF, WebP)"));
        }
        if (file.getSize() > 10L * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "Ukuran file maksimal 10MB"));
        }

        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath();
            Files.createDirectories(uploadPath);

            String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
            String ext = original.contains(".") ? original.substring(original.lastIndexOf(".")) : "";
            String filename = UUID.randomUUID().toString() + ext;

            Files.copy(file.getInputStream(), uploadPath.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

            @SuppressWarnings("unchecked")
            Map<String, Object> user = principal instanceof Map ? (Map<String, Object>) principal : null;
            Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO bug_attachments (bug_id, filename, original_name, file_size, mime_type, uploaded_by) " +
                "VALUES (?,?,?,?,?,?) RETURNING *",
                id, filename, original, file.getSize(), contentType,
                user != null ? user.get("id") : null
            );
            row.put("url", "/api/attachments/file/" + filename);
            return ResponseEntity.status(201).body(row);
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("error", "Gagal menyimpan file"));
        }
    }

    @DeleteMapping("/attachments/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT filename FROM backlog_attachments WHERE id = ?", id
        );
        if (!rows.isEmpty()) {
            String filename = (String) rows.get(0).get("filename");
            jdbc.update("DELETE FROM backlog_attachments WHERE id = ?", id);
            deleteFileQuietly(filename);
            return ResponseEntity.ok(Map.of("message", "Lampiran dihapus"));
        }

        rows = jdbc.queryForList("SELECT filename FROM bug_attachments WHERE id = ?", id);
        if (!rows.isEmpty()) {
            String filename = (String) rows.get(0).get("filename");
            jdbc.update("DELETE FROM bug_attachments WHERE id = ?", id);
            deleteFileQuietly(filename);
            return ResponseEntity.ok(Map.of("message", "Lampiran dihapus"));
        }

        return ResponseEntity.status(404).body(Map.of("error", "Lampiran tidak ditemukan"));
    }

    private void deleteFileQuietly(String filename) {
        try {
            Path filePath = Paths.get(uploadDir).toAbsolutePath().resolve(filename);
            Files.deleteIfExists(filePath);
        } catch (IOException ignored) {}
    }

    @GetMapping("/attachments/file/{filename:.+}")
    public ResponseEntity<Resource> serveFile(@PathVariable String filename) {
        // Security: reject path traversal attempts
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }
        Path filePath = Paths.get(uploadDir).toAbsolutePath().resolve(filename).normalize();
        Resource resource = new FileSystemResource(filePath);
        if (!resource.exists()) return ResponseEntity.notFound().build();

        String contentType = "application/octet-stream";
        try {
            String probed = Files.probeContentType(filePath);
            if (probed != null) contentType = probed;
        } catch (IOException ignored) {}

        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(contentType))
            .header(HttpHeaders.CACHE_CONTROL, "max-age=86400")
            .body(resource);
    }
}
