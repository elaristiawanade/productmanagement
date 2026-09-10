-- Migration v17: app_settings key-value store, used first for runtime-editable
-- email SMTP config (Notification Settings page) instead of restart-only env vars.

CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

SELECT 'Migration v17 selesai.' AS status;
