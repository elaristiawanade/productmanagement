package com.producttracker.config;

import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Access rules for the Bugs Incident module. Default access is Super Admin and
 * QA Engineer only — other roles must be granted the `access_bugs` permission
 * (Users & Roles → Roles & Permissions) to view or write anything here.
 */
@Component
public class BugHelper {

    private static final Set<String> DEFAULT_ROLES = Set.of("super_admin", "qa");

    /** True if this principal may view or write anything in the Bugs Incident module. */
    public boolean canAccess(Object principal) {
        String rn = PermissionHelper.getRoleName(principal);
        if (DEFAULT_ROLES.contains(rn)) return true;
        return PermissionHelper.hasPermission(principal, "access_bugs");
    }
}
