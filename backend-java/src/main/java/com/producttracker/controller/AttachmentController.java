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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

    // Backlog attachments: images + common office/document formats
    private static final Set<String> BACKLOG_MIME_TYPES = Set.of(
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/zip", "application/x-zip-compressed",
        "text/csv", "text/plain"
    );
    private static final Set<String> BACKLOG_EXTENSIONS = Set.of(
        ".jpg", ".jpeg", ".png", ".gif", ".webp",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".zip", ".csv", ".txt"
    );
    private static final String BACKLOG_ALLOWED_MESSAGE =
        "Tipe file tidak didukung. Format yang diizinkan: gambar (JPEG, PNG, GIF, WebP), PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT";

    // Content-type sniffing is unreliable across browsers/OSes for office formats,
    // so fall back to the file extension when the declared MIME type isn't recognized.
    private boolean isAllowedBacklogFile(String contentType, String originalFilename) {
        if (contentType != null && BACKLOG_MIME_TYPES.contains(contentType.toLowerCase())) return true;
        String name = originalFilename != null ? originalFilename.toLowerCase() : "";
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot) : "";
        return BACKLOG_EXTENSIONS.contains(ext);
    }

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
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
        if (!isAllowedBacklogFile(contentType, original)) {
            return ResponseEntity.badRequest().body(Map.of("error", BACKLOG_ALLOWED_MESSAGE));
        }
        if (file.getSize() > 10L * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "Ukuran file maksimal 10MB"));
        }

        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath();
            Files.createDirectories(uploadPath);

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

        // Spring's ResourceHttpMessageConverter forces a generic "f.txt" download name (RFD
        // attack mitigation) whenever we don't set our own Content-Disposition — this hits any
        // extension outside its built-in safe list, e.g. every non-image type. Set it ourselves,
        // using the original filename recorded at upload time.
        String originalName = lookupOriginalName(filename);
        String dispositionName = originalName != null ? originalName : filename;

        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(contentType))
            .header(HttpHeaders.CACHE_CONTROL, "max-age=86400")
            .header(HttpHeaders.CONTENT_DISPOSITION, buildContentDisposition(dispositionName))
            .body(resource);
    }

    private String lookupOriginalName(String filename) {
        List<String> names = jdbc.queryForList(
            "SELECT original_name FROM backlog_attachments WHERE filename = ? " +
            "UNION ALL SELECT original_name FROM bug_attachments WHERE filename = ?",
            String.class, filename, filename
        );
        return names.isEmpty() ? null : names.get(0);
    }

    private String buildContentDisposition(String filename) {
        String asciiFallback = filename.replaceAll("[^\\x20-\\x7E]", "_").replace("\"", "'");
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        return "inline; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encoded;
    }
}
