package com.producttracker.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Shared access rules for the C-Level Dashboard (Leader Notes / Leader Task / My Task).
 *
 * View scope: a user sees the department(s) assigned to them via `user_departments`;
 * Manager/PO/SME/Commissioner/Super Admin see every department (cross-functional council).
 * Write scope: only those same write roles may create/edit Leader Notes & Leader Task —
 * everyone else (e.g. Developer/QA) is view-only within their assigned department(s).
 *
 * Department identities themselves (code, display name, code prefix, color) live in the
 * `departments` table — see DepartmentController for CRUD — not hardcoded here.
 */
@Component
public class DepartmentHelper {

    @Autowired
    private JdbcTemplate jdbc;

    private static final Set<String> WRITE_ROLES =
        Set.of("super_admin", "manager", "po", "sme", "commissioner");

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

    /** True if this principal may create/edit Leader Notes & Leader Task, for any department. */
    public boolean canWrite(Object principal) {
        String rn = PermissionHelper.getRoleName(principal);
        if (WRITE_ROLES.contains(rn)) return true;
        return PermissionHelper.hasPermission(principal, "manage_leader_notes", "manage_leader_tasks");
    }

    /**
     * Departments this principal may view. Returns null when unrestricted (sees everything —
     * Super Admin and every write role), or the list of departments assigned to this user via
     * `user_departments` for a view-only user (possibly more than one, possibly empty if they
     * have no department assigned at all — in which case they see nothing).
     */
    @SuppressWarnings("unchecked")
    public List<String> visibleDepartments(Object principal) {
        if (canWrite(principal)) return null;
        if (!(principal instanceof Map)) return List.of();
        Object depts = ((Map<String, Object>) principal).get("departments");
        return depts instanceof List ? (List<String>) depts : List.of();
    }
}
