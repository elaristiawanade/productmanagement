package com.producttracker.security;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private JdbcTemplate jdbc;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                if (jwtUtil.isTokenValid(token)) {
                    String email = jwtUtil.extractSubject(token);
                    if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                        List<Map<String, Object>> rows = jdbc.queryForList(
                            "SELECT u.id, u.email, u.name, u.role_id, u.avatar_color, " +
                            "r.name AS role_name, r.display_name AS role_display, r.permissions " +
                            "FROM users u JOIN roles r ON u.role_id = r.id " +
                            "WHERE u.email = ? AND u.is_active = true",
                            email
                        );
                        if (!rows.isEmpty()) {
                            Map<String, Object> userMap = rows.get(0);
                            List<String> departments = jdbc.queryForList(
                                "SELECT d.code FROM departments d JOIN user_departments ud ON ud.department_id = d.id " +
                                "WHERE ud.user_id = ? ORDER BY d.sort_order, d.name",
                                String.class, userMap.get("id")
                            );
                            userMap.put("departments", departments);
                            UsernamePasswordAuthenticationToken auth =
                                new UsernamePasswordAuthenticationToken(
                                    userMap,
                                    null,
                                    List.of(new SimpleGrantedAuthority(
                                        "ROLE_" + userMap.get("role_name").toString().toUpperCase()
                                    ))
                                );
                            SecurityContextHolder.getContext().setAuthentication(auth);
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }
        chain.doFilter(request, response);
    }
}
