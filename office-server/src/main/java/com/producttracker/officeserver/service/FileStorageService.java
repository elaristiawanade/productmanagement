package com.producttracker.officeserver.service;

import com.producttracker.officeserver.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;

@Service
public class FileStorageService {

    private static final String VIRTUAL_PREFIX = "/uploads/";

    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of("image/jpeg", "image/png", "image/gif", "image/webp");

    @Value("${app.upload.dir}")
    private String uploadDir;

    public UploadResult store(MultipartFile file, Long productId, Long backlogItemId) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(400, "File is required");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new ApiException(400, "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(500, "Failed to read uploaded file");
        }

        if (!hasValidImageSignature(bytes, contentType)) {
            throw new ApiException(400, "File content does not match declared image type");
        }

        String filename = sanitizeFilename(file.getOriginalFilename());
        String productDir = "prod_" + productId;
        String itemDir = "item_" + backlogItemId;

        Path targetDir = uploadRoot().resolve(productDir).resolve(itemDir).normalize();
        try {
            Files.createDirectories(targetDir);
            Files.write(targetDir.resolve(filename), bytes,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(500, "Failed to save file to disk");
        }

        String filePath = VIRTUAL_PREFIX + productDir + "/" + itemDir + "/" + filename;
        String uploadedAt = Instant.now().truncatedTo(ChronoUnit.SECONDS).toString();
        return new UploadResult(filename, filePath, bytes.length, uploadedAt);
    }

    public StoredFile resolve(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) {
            throw new ApiException(400, "File path is required");
        }

        String path = rawPath.trim();
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        if (!path.startsWith(VIRTUAL_PREFIX)) {
            throw new ApiException(400, "Invalid file path");
        }

        String relative = path.substring(VIRTUAL_PREFIX.length());
        if (relative.isBlank()) {
            throw new ApiException(400, "Invalid file path");
        }
        for (String segment : relative.split("/")) {
            if (segment.isBlank() || segment.equals(".") || segment.equals("..")) {
                throw new ApiException(400, "Invalid file path");
            }
        }

        Path root = uploadRoot();
        Path candidate = root.resolve(relative).normalize();
        if (!candidate.startsWith(root)) {
            throw new ApiException(400, "Invalid file path");
        }
        if (!Files.isRegularFile(candidate)) {
            throw new ApiException(404, "File not found");
        }

        return new StoredFile(candidate, candidate.getFileName().toString());
    }

    private Path uploadRoot() {
        return Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    private String sanitizeFilename(String original) {
        if (original == null || original.isBlank()) {
            throw new ApiException(400, "File must have a filename");
        }
        String normalized = original.replace('\\', '/');
        int lastSlash = normalized.lastIndexOf('/');
        String name = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;

        StringBuilder cleaned = new StringBuilder();
        name.codePoints().filter(c -> c >= 0x20 && c != 0x7F).forEach(cleaned::appendCodePoint);
        name = cleaned.toString().trim();

        if (name.isEmpty() || name.equals(".") || name.equals("..")) {
            throw new ApiException(400, "Invalid filename");
        }
        return name;
    }

    private boolean hasValidImageSignature(byte[] b, String contentType) {
        switch (contentType) {
            case "image/jpeg":
                return b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
            case "image/png":
                return b.length >= 8
                        && (b[0] & 0xFF) == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
                        && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A;
            case "image/gif":
                return b.length >= 6
                        && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8'
                        && (b[4] == '7' || b[4] == '9') && b[5] == 'a';
            case "image/webp":
                return b.length >= 12
                        && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                        && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
            default:
                return false;
        }
    }
}
