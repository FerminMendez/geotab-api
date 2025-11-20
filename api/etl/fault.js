const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function getLastTimestamp() {
  const rows = await sql`
    SELECT last_timestamp
    FROM sync_state
    WHERE source = 'fault_data'
  `;
  if (rows.length === 0) return new Date("2000-01-01T00:00:00Z").toISOString();
  const ts = rows[0].last_timestamp;
  return ts instanceof Date ? ts.toISOString() : ts;
}

async function updateLastTimestamp(ts) {
  await sql`
    UPDATE sync_state SET last_timestamp=${ts}
    WHERE source='fault_data'
  `;
}

async function insertFaultData(rows) {
  for (const f of rows) {
    const deviceId = f.device?.id ?? null;
    const diagnosticId = f.diagnostic?.id ?? null;
    const controllerId = f.controller?.id ?? null;
    let severity = f.faultStates?.effectiveStatus ?? f.faultState ?? null;
    const isActive = f.faultState === "Active";

    await sql`
      INSERT INTO fault_data (
        id, device_id, occurred_at, code,
        description, severity, controller_id, is_active
      )
      VALUES (
        ${f.id}, ${deviceId}, ${f.dateTime || null},
        ${diagnosticId}, ${f.description || null},
        ${severity}, ${controllerId}, ${isActive}
      )
      ON CONFLICT(id) DO NOTHING
    `;
  }
}

async function syncFaultData(api) {
  const lastTs = await getLastTimestamp();

  const results = await api.call("Get", {
    typeName: "FaultData",
    search: { fromDate: lastTs }
  });

  let count = 0;
  let maxDate = null;

  if (results.length > 0) {
    await insertFaultData(results);
    count = results.length;

    for (const r of results) {
      if (r.dateTime) {
        const d = new Date(r.dateTime);
        if (!maxDate || d > maxDate) maxDate = d;
      }
    }

    if (maxDate) await updateLastTimestamp(maxDate.toISOString());
  }

  return {
    recordsInserted: count,
    fromDate: lastTs,
    toDate: maxDate
  };
}

module.exports = { syncFaultData };
