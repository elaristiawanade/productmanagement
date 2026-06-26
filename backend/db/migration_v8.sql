-- Migration v8: Add estimated_hours for independent backlog items
ALTER TABLE backlog_items ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,1) DEFAULT NULL;
