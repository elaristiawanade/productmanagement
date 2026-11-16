package com.producttracker.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

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

    /**
     * Bugs per product feature (Products → Features), one count column per stage.
     * Only features that have bugs are returned, most bugs first. Bugs without a feature
     * form a single last row whose feature_id is null ("Tanpa Feature" in the UI).
     * A bug's feature always belongs to the bug's own product (enforced on save).
     */
    public List<Map<String, Object>> bugsByFeature(Long productId) {
        String productFilter = productId != null ? "WHERE b.product_id = ? " : "";
        Object[] params = productId != null ? new Object[]{productId} : new Object[]{};
        return jdbc.queryForList(
            "SELECT f.id AS feature_id, f.code AS feature_code, f.name AS feature_name, " +
            "  fp.code AS product_code, fp.name AS product_name, " +
            "  COUNT(*)                                                 AS total, " +
            "  COUNT(CASE WHEN b.stage = 'open'          THEN 1 END)    AS open, " +
            "  COUNT(CASE WHEN b.stage = 'in_progress'   THEN 1 END)    AS in_progress, " +
            "  COUNT(CASE WHEN b.stage = 'ready_to_test' THEN 1 END)    AS ready_to_test, " +
            "  COUNT(CASE WHEN b.stage = 'reopen'        THEN 1 END)    AS reopen, " +
            "  COUNT(CASE WHEN b.stage = 'done'          THEN 1 END)    AS done, " +
            "  COUNT(CASE WHEN b.stage = 'improvement'   THEN 1 END)    AS improvement " +
            "FROM bugs b " +
            "LEFT JOIN features f  ON f.id  = b.feature_id " +
            "LEFT JOIN products fp ON fp.id = f.product_id " +
            productFilter +
            "GROUP BY f.id, f.code, f.name, fp.code, fp.name " +
            "ORDER BY (f.id IS NULL), total DESC, fp.code, f.code",
            params);
    }
}
