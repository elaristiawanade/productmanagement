package com.producttracker.officeserver.controller;

import com.producttracker.officeserver.exception.ApiException;
import com.producttracker.officeserver.service.FileStorageService;
import com.producttracker.officeserver.service.StoredFile;
import com.producttracker.officeserver.service.UploadResult;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileStorageService fileStorageService;

    public FileController(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("backlog_item_id") Long backlogItemId,
            @RequestParam("product_id") Long productId) {

        UploadResult result = fileStorageService.store(file, productId, backlogItemId);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", result.filename());
        body.put("file_path", result.filePath());
        body.put("file_size", result.fileSize());
        body.put("uploaded_at", result.uploadedAt());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/download/{*filePath}")
    public ResponseEntity<Resource> download(@PathVariable String filePath) {
        StoredFile stored = fileStorageService.resolve(filePath);

        long size;
        try {
            size = Files.size(stored.path());
        } catch (IOException e) {
            throw new ApiException(500, "Failed to read file");
        }

        Resource resource = new FileSystemResource(stored.path());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(detectContentType(stored.path())))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + stored.filename() + "\"")
                .contentLength(size)
                .body(resource);
    }

    private String detectContentType(Path path) {
        try {
            String probed = Files.probeContentType(path);
            if (probed != null) {
                return probed;
            }
        } catch (IOException ignored) {
            // fall through to extension-based detection
        }

        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".gif")) return "image/gif";
        if (name.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }
}
