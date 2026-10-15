package com.producttracker.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.postgresql.util.PGobject;

import java.util.Map;

public class PermissionHelper {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Returns true if the principal has super_admin role. */
    @SuppressWarnings("unchecked")
    public static boolean isSuperAdmin(Object principal) {
        if (!(principal instanceof Map)) return false;
        Object rn = ((Map<String, Object>) principal).get("role_name");
        return "super_admin".equals(rn);
    }

    /**
     * Returns true if the principal may perform {@code action} on {@code module},
     * per the new module->action permission matrix (roles.permissions, nested
     * JSONB shape: {"module": {"action": true, ...}, ...}). super_admin always
     * bypasses this check (hardcoded safety net — see plan doc §3/§4).
     */
    public static boolean can(Object principal, String module, String action) {
        if (isSuperAdmin(principal)) return true;
        Map<String, Object> modulePerms = getModulePermissions(principal, module);
        return modulePerms != null && Boolean.TRUE.equals(modulePerms.get(action));
    }

    /** Returns the {action: bool} map for one module from the principal's nested permissions, or null. */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> getModulePermissions(Object principal, String module) {
        if (!(principal instanceof Map)) return null;
        Map<String, Object> user = (Map<String, Object>) principal;

        Object permsObj = user.get("permissions");
        if (permsObj == null) return null;

        String json;
        if (permsObj instanceof PGobject) {
            json = ((PGobject) permsObj).getValue();
        } else {
            json = permsObj.toString();
        }
        if (json == null || json.isBlank()) return null;

        try {
            Map<String, Object> perms = MAPPER.readValue(json, Map.class);
            Object moduleObj = perms.get(module);
            return moduleObj instanceof Map ? (Map<String, Object>) moduleObj : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    /** Returns the user id from the principal, or null. */
    @SuppressWarnings("unchecked")
    public static Long getUserId(Object principal) {
        if (!(principal instanceof Map)) return null;
        Object id = ((Map<String, Object>) principal).get("id");
        if (id instanceof Number) return ((Number) id).longValue();
        try { return Long.parseLong(id.toString()); } catch (Exception e) { return null; }
    }
}
