package com.producttracker.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

/**
 * Keeps `features` (Products → Produk & Features) and `product_roadmap` (Products → Roadmap) in step, and owns the
 * progress % of Features and products.
 *
 * The Feature is the master: every Feature has exactly one roadmap row (product_roadmap.source_feature_id) and every
 * roadmap row has exactly one Feature. Name, version and status always follow the Feature; the roadmap month follows
 * the Feature's target date only when that date changed (a Feature created from a roadmap item has no date, and its
 * roadmap month must not be wiped by an unrelated edit). Description and sort_order stay owned by the Roadmap tab.
 *
 * Progress is set by hand, through the status: each stage is +20% (Planned 20 … Active 100, Offline 100). It is
 * never computed from the Backlog — a Backlog item only references a roadmap row as a label ("Impacted Features").
 * On Hold keeps the last stage: the roadmap row keeps its status, so the percent stays where it was.
 * Callers run the write methods inside one transaction.
 */
@Service
public class FeatureRoadmapSync {

    @Autowired
    private JdbcTemplate jdbc;

    /** Roadmap status → progress %. */
    private static final Map<String, Integer> PCT = Map.of(
        "planned", 20, "research", 40, "on_progress", 60, "testing", 80, "active", 100, "offline", 100);

    /** Progress % of a roadmap status, null for an unknown status. */
    public static Integer pctOf(Object roadmapStatus) {
        return roadmapStatus == null ? null : PCT.get(roadmapStatus.toString());
    }

    /**
     * Feature status → roadmap status. null for on_hold: the roadmap row keeps its current status (and so its percent).
     * The old values in_progress / done (seed and import data) are read as in_development / released.
     */
    public static String roadmapStatusFor(Object featureStatus) {
        String s = featureStatus == null ? "" : featureStatus.toString();
        switch (s) {
            case "research":                           return "research";
            case "in_development": case "in_progress": return "on_progress";
            case "testing":                            return "testing";
            case "released":       case "done":        return "active";
            case "offline":                            return "offline";
            case "on_hold":                            return null;
            default:                                   return "planned";   // not_started, unknown
        }
    }

    /** Roadmap status → Feature status (used when a Feature is created from a roadmap item). */
    public static String featureStatusFor(Object roadmapStatus) {
        String s = roadmapStatus == null ? "" : roadmapStatus.toString();
        switch (s) {
            case "research":    return "research";
            case "on_progress": return "in_development";
            case "testing":     return "testing";
            case "active":      return "released";
            case "offline":     return "offline";
            default:            return "not_started";   // planned, unknown
        }
    }

    /**
     * Progress % of a Feature: the percent of its roadmap row's status. A Feature without a roadmap row (only possible
     * before migration_v34 ran) falls back to its own status, On Hold then 20.
     */
    public static int featureProgress(Object featureStatus, Object roadmapStatus) {
        Integer p = pctOf(roadmapStatus);
        if (p != null) return p;
        String rs = roadmapStatusFor(featureStatus);
        return PCT.getOrDefault(rs == null ? "planned" : rs, 20);
    }

    /** First day of the date's month (the roadmap keeps a month, the Feature a full date); null stays null. */
    public static java.sql.Date monthOf(Object date) {
        if (date == null) return null;
        LocalDate d = date instanceof java.sql.Date ? ((java.sql.Date) date).toLocalDate() : LocalDate.parse(date.toString().substring(0, 10));
        return java.sql.Date.valueOf(d.withDayOfMonth(1));
    }

    /** Next free code of the form {product code}FT-{n}, e.g. BMT → BMTFT-5. Raises IllegalArgumentException if the product is unknown. */
    public String nextFeatureCode(Long productId) {
        List<String> codes = jdbc.queryForList("SELECT code FROM products WHERE id=?", String.class, productId);
        if (codes.isEmpty()) throw new IllegalArgumentException("Produk tidak ditemukan");
        String prefix = codes.get(0) + "FT-";
        List<String> existing = jdbc.queryForList("SELECT code FROM features WHERE product_id=?", String.class, productId);
        int max = 0;
        for (String c : existing) {
            if (c != null && c.startsWith(prefix) && c.substring(prefix.length()).matches("\\d{1,9}")) {
                max = Math.max(max, Integer.parseInt(c.substring(prefix.length())));
            }
        }
        return prefix + (max + 1);
    }

    /**
     * Creates or refreshes the roadmap row linked to {@code feature} (a full `features` row). {@code dateChanged}: whether
     * the Feature's target_date changed in this save (true on create), which is when the roadmap month follows along.
     */
    public void syncRoadmap(Map<String, Object> feature, boolean dateChanged) {
        Object featureId = feature.get("id");
        String status = roadmapStatusFor(feature.get("status"));   // null = On Hold, keep the row's status
        List<Map<String, Object>> existing = jdbc.queryForList(
            "SELECT id FROM product_roadmap WHERE source_feature_id=?", featureId);
        if (existing.isEmpty()) {
            jdbc.update(
                "INSERT INTO product_roadmap (product_id, feature_name, status, product_version, month_release_target, sort_order, source_feature_id) " +
                "VALUES (?,?,?,?,?,0,?)",
                feature.get("product_id"), feature.get("name"), status == null ? "planned" : status,
                feature.get("target_release"), monthOf(feature.get("target_date")), featureId);
        } else {
            jdbc.update(
                "UPDATE product_roadmap SET feature_name=?, product_version=?, status = COALESCE(?::varchar, status), " +
                "  month_release_target = CASE WHEN ?::boolean THEN ?::date ELSE month_release_target END " +
                "WHERE source_feature_id=?",
                feature.get("name"), feature.get("target_release"), status,
                dateChanged, monthOf(feature.get("target_date")),
                featureId);
        }
    }

    /**
     * Inserts the Feature that backs a new roadmap item (code generated, status mapped back from the roadmap status).
     * target_date stays empty: the roadmap only knows a month, and a made-up exact day would show on the Management Dashboard.
     */
    public Map<String, Object> createFeatureForRoadmap(Long productId, String name, String roadmapStatus, String version) {
        return jdbc.queryForMap(
            "INSERT INTO features (product_id, code, name, status, priority, target_release, is_roadmap_item) " +
            "VALUES (?,?,?,?,'medium',?,TRUE) RETURNING *",
            productId, nextFeatureCode(productId), name, featureStatusFor(roadmapStatus), version);
    }

    /**
     * Adds "progress" to product rows (each needs id): the plain average of the progress of the product's Features,
     * null when it has no Feature yet. Not taken from the Backlog.
     */
    public void attachToProducts(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) return;
        List<Object> ids = new ArrayList<>();
        for (Map<String, Object> r : rows) ids.add(r.get("id"));
        String in = String.join(",", Collections.nCopies(ids.size(), "?"));
        Map<Long, int[]> acc = new HashMap<>();   // product id → {sum, count}
        for (Map<String, Object> f : jdbc.queryForList(
                "SELECT f.product_id, f.status, rm.status AS roadmap_status FROM features f " +
                "LEFT JOIN product_roadmap rm ON rm.source_feature_id = f.id WHERE f.product_id IN (" + in + ")", ids.toArray())) {
            int[] a = acc.computeIfAbsent(((Number) f.get("product_id")).longValue(), k -> new int[2]);
            a[0] += featureProgress(f.get("status"), f.get("roadmap_status"));
            a[1]++;
        }
        for (Map<String, Object> r : rows) {
            int[] a = acc.get(((Number) r.get("id")).longValue());
            r.put("progress", a == null ? null : (int) Math.round((double) a[0] / a[1]));
        }
    }
}
