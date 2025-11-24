const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const DEFAULT_FALLBACK = "2000-01-01T00:00:00Z";

function toIsoString(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function getSyncCursor(source, fallback = DEFAULT_FALLBACK) {
  const rows = await sql`
    SELECT last_timestamp
    FROM sync_state
    WHERE source = ${source}
  `;

  if (rows.length === 0 || !rows[0].last_timestamp) {
    return fallback;
  }

  return toIsoString(rows[0].last_timestamp) || fallback;
}

async function updateSyncState(source, { lastTimestamp = null, recordsCount = 0, lastError = null } = {}) {
  const normalized = toIsoString(lastTimestamp);

  await sql`
    INSERT INTO sync_state (source, last_timestamp, records_count, last_error, updated_at)
    VALUES (
      ${source},
      ${normalized},
      ${recordsCount ?? 0},
      ${lastError || null},
      NOW()
    )
    ON CONFLICT (source) DO UPDATE SET
      last_timestamp = COALESCE(EXCLUDED.last_timestamp, sync_state.last_timestamp),
      records_count = EXCLUDED.records_count,
      last_error = EXCLUDED.last_error,
      updated_at = NOW();
  `;
}

async function markSyncError(source, error) {
  const message = error instanceof Error ? error.message : String(error);

  await sql`
    INSERT INTO sync_state (source, last_timestamp, records_count, last_error, updated_at)
    VALUES (
      ${source},
      NULL,
      0,
      ${message},
      NOW()
    )
    ON CONFLICT (source) DO UPDATE SET
      last_error = EXCLUDED.last_error,
      updated_at = NOW();
  `;
}

module.exports = {
  getSyncCursor,
  updateSyncState,
  markSyncError
};
