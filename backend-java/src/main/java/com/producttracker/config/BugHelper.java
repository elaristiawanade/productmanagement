package com.producttracker.config;

import org.springframework.stereotype.Component;

/**
 * Access rules for the Bugs Incident module. Access is driven entirely by the
 * `bugs.access` permission in the module x action matrix (Users & Roles →
 * Roles & Permissions) — super_admin always bypasses via PermissionHelper.can().
 */
@Component
public class BugHelper {

    /** True if this principal may view or write anything in the Bugs Incident module. */
    public boolean canAccess(Object principal) {
        return PermissionHelper.can(principal, "bugs", "access");
    }
}
