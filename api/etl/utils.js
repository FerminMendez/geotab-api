const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function logSuccess(data) {
  await sql`
    INSERT INTO etl_logs (
      status,
      records_inserted,
      device_records_processed,
      from_date,
      to_date,
      duration_ms,
      raw_log
    )
    VALUES (
      'success',
      ${data.recordsInserted || 0},
      ${data.devicesProcessed || 0},
      ${data.fromDate || null},
      ${data.toDate || null},
      ${data.duration},
      ${JSON.stringify(data.raw || {})}
    )
  `;
}

async function logError(data) {
  await sql`
    INSERT INTO etl_logs (
      status,
      error_message,
      from_date,
      duration_ms,
      raw_log
    )
    VALUES (
      'error',
      ${data.error},
      ${data.fromDate || null},
      ${data.duration},
      ${JSON.stringify(data.raw || {})}
    )
  `;
}

module.exports = { logSuccess, logError };
