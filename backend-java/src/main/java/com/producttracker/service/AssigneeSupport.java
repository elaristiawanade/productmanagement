package com.producttracker.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reusable multi-assignee plumbing for any item table that keeps a legacy
 * single "primary assignee" column plus a `<table>_assignees` join table
 * (bug_id/backlog_item_id + user_id + is_primary). Used by BugController and
 * PublicBugController; BacklogController predates this and inlines the same
 * logic against backlog_item_assignees directly.
 */
@Component
public class AssigneeSupport {

    @Autowired private JdbcTemplate jdbc;

    private static final ObjectMapper JSON = new ObjectMapper();

    /** SQL fragment for a SELECT's field list: aggregates the join table into a JSON array, cast to text. */
    public String assigneesJsonSelect(String joinTable, String fkColumn, String itemAlias) {
        return "(SELECT COALESCE(json_agg(json_build_object(" +
            "'id', au.id, 'name', au.name, 'color', au.avatar_color, 'email', au.email" +
            ") ORDER BY ja.is_primary DESC, au.name), '[]'::json)::text " +
            "FROM " + joinTable + " ja JOIN users au ON au.id = ja.user_id " +
            "WHERE ja." + fkColumn + " = " + itemAlias + ".id) AS assignees_json";
    }

    /** Parses the assignees_json text column into a List<Map> under "assignees", removing the raw column. */
    public void enrich(List<Map<String, Object>> rows) {
        for (Map<String, Object> row : rows) enrich(row);
    }

    public void enrich(Map<String, Object> row) {
        Object raw = row.remove("assignees_json");
        List<Map<String, Object>> assignees;
        try {
            assignees = raw == null ? List.of()
                : JSON.readValue(raw.toString(), new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            assignees = List.of();
        }
        row.put("assignees", assignees);
    }

    /** Replaces an item's assignee set (primary + additional) in its join table. */
    public void sync(String joinTable, String fkColumn, Long itemId, Long primaryId, List<Long> additionalIds) {
        jdbc.update("DELETE FROM " + joinTable + " WHERE " + fkColumn + " = ?", itemId);
        Set<Long> all = new LinkedHashSet<>();
        if (primaryId != null) all.add(primaryId);
        if (additionalIds != null) all.addAll(additionalIds);
        for (Long uid : all) {
            boolean isPrimary = uid.equals(primaryId);
            jdbc.update("INSERT INTO " + joinTable + " (" + fkColumn + ", user_id, is_primary) VALUES (?,?,?)",
                itemId, uid, isPrimary);
        }
    }

    @SuppressWarnings("unchecked")
    public List<Long> parseIdList(Object raw) {
        List<Long> ids = new ArrayList<>();
        if (!(raw instanceof List)) return ids;
        for (Object o : (List<Object>) raw) {
            Long l = toLong(o);
            if (l != null) ids.add(l);
        }
        return ids;
    }

    @SuppressWarnings("unchecked")
    public Set<Long> extractIds(Map<String, Object> row) {
        Object a = row.get("assignees");
        Set<Long> ids = new LinkedHashSet<>();
        if (!(a instanceof List)) return ids;
        for (Object o : (List<Object>) a) {
            if (o instanceof Map) {
                Long id = toLong(((Map<String, Object>) o).get("id"));
                if (id != null) ids.add(id);
            }
        }
        return ids;
    }

    public Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }
}
