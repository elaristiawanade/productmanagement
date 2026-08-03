package com.producttracker.config;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Shared access rules for the C-Level Dashboard (Leader Notes / Leader Task / My Task).
 *
 * View scope: a user with a `department` sees only that department; Manager/PO/SME/Commissioner/
 * Super Admin see every department (cross-functional council). Write scope: only those same
 * write roles may create/edit Leader Notes & Leader Task — everyone else (e.g. Developer/QA) is
 * view-only within their own department.
 */
public class DepartmentHelper {

    public static final List<String> DEPARTMENTS = List.of("HC", "Sales", "PMG", "IT", "Finance", "Product");

    private static final Set<String> WRITE_ROLES =
        Set.of("super_admin", "manager", "po", "sme", "commissioner");

    private static final Map<String, String> CODE_PREFIX = Map.of(
        "HC", "HC", "Sales", "SLS", "PMG", "PMG", "IT", "IT", "Finance", "FIN", "Product", "PRD"
    );

    public static boolean isValidDepartment(String department) {
        return department != null && DEPARTMENTS.contains(department);
    }

    public static String codePrefix(String department) {
        return CODE_PREFIX.getOrDefault(department, "LT");
    }

    /** True if this principal may create/edit Leader Notes & Leader Task, for any department. */
    public static boolean canWrite(Object principal) {
        String rn = PermissionHelper.getRoleName(principal);
        if (WRITE_ROLES.contains(rn)) return true;
        return PermissionHelper.hasPermission(principal, "manage_leader_notes", "manage_leader_tasks");
    }

    /**
     * Departments this principal may view. Returns null when unrestricted (sees everything —
     * Super Admin and every write role), or a single-department list for a view-only user with
     * a department assigned, or an empty list if they have no department at all (sees nothing).
     */
    @SuppressWarnings("unchecked")
    public static List<String> visibleDepartments(Object principal) {
        if (canWrite(principal)) return null;
        if (!(principal instanceof Map)) return List.of();
        Object dept = ((Map<String, Object>) principal).get("department");
        return (dept == null || dept.toString().isBlank()) ? List.of() : List.of(dept.toString());
    }
}
