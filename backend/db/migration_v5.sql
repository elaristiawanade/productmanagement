-- Migration v5: Product Roadmap module
-- Run once on existing database:
--   psql -U postgres -d product_tracker -f migration_v5.sql

CREATE TABLE IF NOT EXISTS product_roadmap (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  feature_name    VARCHAR(200) NOT NULL,
  description     TEXT,
  status          VARCHAR(30)  NOT NULL DEFAULT 'planned',
  product_version VARCHAR(50),
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  created_by      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN product_roadmap.status IS 'planned, research, on_progress, testing, active, offline';

CREATE INDEX IF NOT EXISTS idx_roadmap_product ON product_roadmap(product_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_status  ON product_roadmap(status);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_roadmap_updated'
  ) THEN
    CREATE TRIGGER trg_roadmap_updated
      BEFORE UPDATE ON product_roadmap
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

SELECT 'Migration v5 selesai.' AS status;
