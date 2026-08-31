package com.producttracker.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Shared access rules for the C-Level Dashboard (Leader Notes / Leader Task / My Task).
 *
 * By default only Super Admin and Commissioner may view or write anything here — everyone
 * else is locked out entirely unless their role carries the `access_c_level` permission
 * (grantable per-role in Users & Roles → Roles & Permissions), which gives full parity with
 * Commissioner: cross-department view and write, no partial/department-scoped access tier.
 *
 * Department identities themselves (code, display name, code prefix, color) live in the
 * `departments` table — see DepartmentController for CRUD — not hardcoded here.
 */
@Component
public class DepartmentHelper {

    @Autowired
    private JdbcTemplate jdbc;

    private static final Set<String> WRITE_ROLES = Set.of("super_admin", "commissioner");

    public boolean isValidDepartment(String code) {
        if (code == null || code.isBlank()) return false;
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM departments WHERE code = ?", Integer.class, code
        );
        return count != null && count > 0;
    }

    public String codePrefix(String code) {
        List<String> rows = jdbc.queryForList(
            "SELECT code_prefix FROM departments WHERE code = ?", String.class, code
        );
        return rows.isEmpty() ? "LT" : rows.get(0);
    }

    /** True if this principal may view/create/edit Leader Notes & Leader Task, for any department. */
    public boolean canWrite(Object principal) {
        String rn = PermissionHelper.getRoleName(principal);
        if (WRITE_ROLES.contains(rn)) return true;
        return PermissionHelper.hasPermission(principal, "access_c_level");
    }

    /**
     * Departments this principal may view. Returns null when unrestricted (Super Admin,
     * Commissioner, or any role granted `access_c_level`), or an empty list otherwise —
     * there is no partial/department-scoped access tier.
     */
    public List<String> visibleDepartments(Object principal) {
        return canWrite(principal) ? null : List.of();
    }
}
