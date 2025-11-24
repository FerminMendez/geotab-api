const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const { getSyncCursor, updateSyncState, markSyncError } = require("../sync_state");

const SOURCE = "fault_data";

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
  console.log("2.1 FaultData - preparing request");
  try {
    const lastTs = await getSyncCursor(SOURCE);
    console.log(`2.1 FaultData - fromDate ${lastTs}`);

    const results = await api.call("Get", {
      typeName: "FaultData",
      search: { fromDate: lastTs }
    });
    console.log(`2.1 FaultData - received ${results.length} records`);

    let count = 0;
    let maxDate = null;

    if (results.length > 0) {
      console.log("2.1 FaultData - inserting rows into Neon");
      await insertFaultData(results);
      count = results.length;

      for (const r of results) {
        if (r.dateTime) {
          const d = new Date(r.dateTime);
          if (!maxDate || d > maxDate) maxDate = d;
        }
      }
    }

    const targetTimestamp = maxDate ? maxDate.toISOString() : lastTs;
    await updateSyncState(SOURCE, {
      lastTimestamp: targetTimestamp,
      recordsCount: count,
      lastError: null
    });

    console.log("2.1 FaultData - completed");
    return {
      recordsInserted: count,
      fromDate: lastTs,
      toDate: maxDate
    };
  } catch (err) {
    await markSyncError(SOURCE, err);
    throw err;
  }
}

module.exports = { syncFaultData };
