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
     * Returns true if the principal has ANY of the given permission keys,
     * or has the 'all' permission, or is super_admin.
     */
    @SuppressWarnings("unchecked")
    public static boolean hasPermission(Object principal, String... keys) {
        if (!(principal instanceof Map)) return false;
        Map<String, Object> user = (Map<String, Object>) principal;

        if ("super_admin".equals(user.get("role_name"))) return true;

        Object permsObj = user.get("permissions");
        if (permsObj == null) return false;

        String json;
        if (permsObj instanceof PGobject) {
            json = ((PGobject) permsObj).getValue();
        } else {
            json = permsObj.toString();
        }
        if (json == null || json.isBlank()) return false;

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> perms = MAPPER.readValue(json, Map.class);
            if (Boolean.TRUE.equals(perms.get("all"))) return true;
            for (String key : keys) {
                if (Boolean.TRUE.equals(perms.get(key))) return true;
            }
        } catch (Exception ignored) {}

        return false;
    }

    /** Returns the role_name string from the principal, or empty string. */
    @SuppressWarnings("unchecked")
    public static String getRoleName(Object principal) {
        if (!(principal instanceof Map)) return "";
        Object rn = ((Map<String, Object>) principal).get("role_name");
        return rn != null ? rn.toString() : "";
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
