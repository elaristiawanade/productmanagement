package com.producttracker.config;

import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Handles Spring Boot error dispatch:
 * - /api/** errors → return JSON so the caller gets a real error, not a 404 cascade
 * - everything else  → forward to index.html for React Router SPA routing
 */
@Controller
@RequestMapping("/error")
public class SpaController implements ErrorController {

    @RequestMapping
    public void handleError(HttpServletRequest request,
                            HttpServletResponse response) throws IOException, ServletException {
        Object statusAttr = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        Object uriAttr    = request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        Object msgAttr    = request.getAttribute(RequestDispatcher.ERROR_MESSAGE);
        Object exAttr     = request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);

        int    status  = statusAttr != null ? Integer.parseInt(statusAttr.toString()) : 500;
        String uri     = uriAttr    != null ? uriAttr.toString() : "";
        String message = msgAttr    != null && !msgAttr.toString().isBlank()
                         ? msgAttr.toString()
                         : (exAttr != null ? exAttr.toString() : "Internal server error");

        if (uri.startsWith("/api/")) {
            // Return proper JSON error for API routes
            response.setStatus(status);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"" + message.replace("\"", "'") + "\",\"status\":" + status + "}");
        } else {
            // SPA routing — non-API paths are handled by React Router
            request.getRequestDispatcher("/index.html").forward(request, response);
        }
    }
}
