ALTER TABLE sync_state
  ADD COLUMN IF NOT EXISTS records_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

UPDATE sync_state
SET updated_at = NOW()
WHERE updated_at IS NULL;
