package com.producttracker.officeserver.service;

import java.nio.file.Path;

public record StoredFile(Path path, String filename) {
}
