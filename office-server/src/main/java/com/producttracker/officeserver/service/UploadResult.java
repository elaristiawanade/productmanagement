package com.producttracker.officeserver.service;

public record UploadResult(String filename, String filePath, long fileSize, String uploadedAt) {
}
