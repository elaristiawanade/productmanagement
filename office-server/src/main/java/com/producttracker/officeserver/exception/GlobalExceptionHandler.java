package com.producttracker.officeserver.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(ApiException ex) {
        return body(ex.getStatus(), ex.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleTooLarge(MaxUploadSizeExceededException ex) {
        return body(HttpStatus.PAYLOAD_TOO_LARGE.value(), "File size exceeds 10MB limit");
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MissingServletRequestPartException.class,
            MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception ex) {
        return body(HttpStatus.BAD_REQUEST.value(), "Missing or invalid required field: " + ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex) {
        log.error("Unexpected error handling file storage request", ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Internal server error");
    }

    private ResponseEntity<Map<String, Object>> body(int status, String message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("error", message);
        payload.put("status", status);
        return ResponseEntity.status(status).body(payload);
    }
}
