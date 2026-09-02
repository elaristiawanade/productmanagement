-- Migration v15: Re-code bugs to use product-code-based numbering
-- Run once on existing database:
--   psql -U postgres -d product_tracker -f migration_v15.sql
--
-- Bug codes used to be a flat "BUG-001" sequence per product, which didn't tie
-- back to the product the way Backlog item codes do (e.g. "SMRT-CV-006"). New
-- bugs are now coded as {product_code}-{seq} by BugController; this migration
-- re-codes existing rows to match, numbered per product in id order.

WITH numbered AS (
  SELECT b.id, p.code AS product_code,
         ROW_NUMBER() OVER (PARTITION BY b.product_id ORDER BY b.id) AS rn
  FROM bugs b
  JOIN products p ON p.id = b.product_id
)
UPDATE bugs b
SET code = numbered.product_code || '-' || LPAD(numbered.rn::text, 3, '0')
FROM numbered
WHERE b.id = numbered.id;

SELECT 'Migration v15 selesai.' AS status;
