const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function logSuccess(data) {
  console.log("3.1 logSuccess - inserting etl_logs row");
  await sql`
    INSERT INTO etl_logs (
      status,
      records_inserted,
      device_records_processed,
      user_records_processed,
      zone_records_processed,
      rule_records_processed,
      trip_records_processed,
      from_date,
      to_date,
      duration_ms,
      raw_log
    )
    VALUES (
      'success',
      ${data.recordsInserted || 0},
      ${data.devicesProcessed || 0},
      ${data.usersProcessed || 0},
      ${data.zonesProcessed || 0},
      ${data.rulesProcessed || 0},
      ${data.tripsProcessed || 0},
      ${data.fromDate || null},
      ${data.toDate || null},
      ${data.duration},
      ${JSON.stringify(data.raw || {})}
    )
  `;
  console.log("3.1 logSuccess - done");
}

async function logError(data) {
  console.log("E1.1 logError - inserting etl_logs row");
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
  console.log("E1.1 logError - done");
}

module.exports = { logSuccess, logError };
