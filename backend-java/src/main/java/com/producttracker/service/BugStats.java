package com.producttracker.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Bug counts shared by the QA dashboard and the Bugs Incident dashboard, so both
 * "Bugs per Feature" cards always show the same numbers. Callers do their own access check.
 */
@Service
public class BugStats {

    @Autowired
    private JdbcTemplate jdbc;

    /** The configurable stage list (bug_stages), in display order: the columns of the "Bugs per Feature" card. */
    public List<Map<String, Object>> stages() {
        return jdbc.queryForList(
            "SELECT code, name, color, sort_order, is_closed, not_late FROM bug_stages ORDER BY sort_order, name");
    }

    /**
     * Bugs per product feature (Products → Features). Each row has the feature, `total`, and `counts`: a map
     * stage code → number of bugs in that stage (a stage with no bugs is simply absent). Stages are configurable,
     * so the counts are keyed by code instead of being fixed columns; the card reads its columns from stages().
     * Only features that have bugs are returned, most bugs first. Bugs without a feature
     * form a single last row whose feature_id is null ("Tanpa Feature" in the UI).
     * A bug's feature always belongs to the bug's own product (enforced on save).
     */
    public List<Map<String, Object>> bugsByFeature(Long productId) {
        String productFilter = productId != null ? "WHERE b.product_id = ? " : "";
        Object[] params = productId != null ? new Object[]{productId} : new Object[]{};
        List<Map<String, Object>> flat = jdbc.queryForList(
            "SELECT f.id AS feature_id, f.code AS feature_code, f.name AS feature_name, " +
            "  fp.code AS product_code, fp.name AS product_name, " +
            "  b.stage AS stage, COUNT(*) AS n " +
            "FROM bugs b " +
            "LEFT JOIN features f  ON f.id  = b.feature_id " +
            "LEFT JOIN products fp ON fp.id = f.product_id " +
            productFilter +
            "GROUP BY f.id, f.code, f.name, fp.code, fp.name, b.stage",
            params);

        // One row per feature (null feature_id = the "no feature" row), counts pivoted by stage code
        Map<String, Map<String, Object>> byFeature = new LinkedHashMap<>();
        for (Map<String, Object> r : flat) {
            String key = String.valueOf(r.get("feature_id"));
            Map<String, Object> row = byFeature.get(key);
            if (row == null) {
                row = new LinkedHashMap<>();
                row.put("feature_id", r.get("feature_id"));
                row.put("feature_code", r.get("feature_code"));
                row.put("feature_name", r.get("feature_name"));
                row.put("product_code", r.get("product_code"));
                row.put("product_name", r.get("product_name"));
                row.put("total", 0L);
                row.put("counts", new LinkedHashMap<String, Long>());
                byFeature.put(key, row);
            }
            long n = ((Number) r.get("n")).longValue();
            row.put("total", ((Long) row.get("total")) + n);
            @SuppressWarnings("unchecked")
            Map<String, Long> counts = (Map<String, Long>) row.get("counts");
            counts.merge(String.valueOf(r.get("stage")), n, Long::sum);
        }

        List<Map<String, Object>> rows = new ArrayList<>(byFeature.values());
        // Same order as before: features first (the null-feature row last), most bugs first, then product / feature code
        rows.sort(Comparator
            .comparing((Map<String, Object> r) -> r.get("feature_id") == null)
            .thenComparing(r -> -((Long) r.get("total")))
            .thenComparing(r -> String.valueOf(r.get("product_code")))
            .thenComparing(r -> String.valueOf(r.get("feature_code"))));
        return rows;
    }
}
