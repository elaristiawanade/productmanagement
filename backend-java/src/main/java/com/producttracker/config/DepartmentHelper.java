package com.producttracker.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Shared access rules for the C-Level Dashboard (Leader Notes / Leader Task / My Task).
 *
 * Access is driven entirely by the `c_level.access` permission in the module x action
 * matrix (Users & Roles → Roles & Permissions) — super_admin always bypasses via
 * PermissionHelper.can(). Full parity: cross-department view and write, no
 * partial/department-scoped access tier.
 *
 * Department identities themselves (code, display name, code prefix, color) live in the
 * `departments` table — see DepartmentController for CRUD — not hardcoded here.
 */
@Component
public class DepartmentHelper {

    @Autowired
    private JdbcTemplate jdbc;

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
        return PermissionHelper.can(principal, "c_level", "access");
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
