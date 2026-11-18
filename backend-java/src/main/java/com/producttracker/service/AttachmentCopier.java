package com.producttracker.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Copies attachments from one record to another (used by "Buat Backlog": bug -> Backlog card).
 *
 * Every attachment row points at a file on disk, and deleting an attachment also deletes that file
 * (AttachmentController.deleteFileQuietly). So the copy gets its OWN physical file and its own row; sharing one
 * filename between the two records would make deleting the attachment on one side break the other.
 */
@Service
public class AttachmentCopier {

    @Autowired
    private JdbcTemplate jdbc;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    /**
     * Best effort: an attachment whose file is missing on disk (or fails to copy) is skipped instead of failing the
     * whole conversion. Returns how many attachments were copied.
     */
    public int copyBugToBacklog(Long bugId, Long backlogItemId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT filename, original_name, file_size, mime_type, uploaded_by " +
            "FROM bug_attachments WHERE bug_id = ? ORDER BY id", bugId);
        if (rows.isEmpty()) return 0;

        Path dir = Paths.get(uploadDir).toAbsolutePath();
        int copied = 0;
        for (Map<String, Object> r : rows) {
            String source = (String) r.get("filename");
            Path from = dir.resolve(source).normalize();
            // The stored name is a server-made UUID + extension; still never follow a path out of the upload dir
            if (!from.startsWith(dir) || !Files.isRegularFile(from)) continue;

            String ext = source.contains(".") ? source.substring(source.lastIndexOf('.')) : "";
            String copyName = UUID.randomUUID() + ext;
            Path to = dir.resolve(copyName);
            try {
                Files.copy(from, to, StandardCopyOption.COPY_ATTRIBUTES);
                try {
                    jdbc.update(
                        "INSERT INTO backlog_attachments (backlog_item_id, filename, original_name, file_size, mime_type, uploaded_by) " +
                        "VALUES (?,?,?,?,?,?)",
                        backlogItemId, copyName, r.get("original_name"), r.get("file_size"), r.get("mime_type"), r.get("uploaded_by"));
                    copied++;
                } catch (RuntimeException dbErr) {
                    Files.deleteIfExists(to);   // no row points at the copy, so do not leave the file behind
                }
            } catch (IOException ignored) { /* skip this attachment */ }
        }
        return copied;
    }
}
