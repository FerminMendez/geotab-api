const { neon } = require('@neondatabase/serverless');
const GeotabApi = require('mg-api-js');

const sql = neon(process.env.DATABASE_URL);

/* ------------------------------------------------------------
   Helpers: Timestamp
------------------------------------------------------------ */

async function getLastTimestamp() {
  const rows = await sql`
    SELECT last_timestamp 
    FROM sync_state
    WHERE source = 'fault_data'
  `;

  if (rows.length === 0) {
    return new Date('2000-01-01T00:00:00Z').toISOString();
  }

  const ts = rows[0].last_timestamp;
  return ts instanceof Date ? ts.toISOString() : ts;
}

async function updateLastTimestamp(newTs) {
  const iso = newTs instanceof Date ? newTs.toISOString() : newTs;

  await sql`
    UPDATE sync_state
    SET last_timestamp = ${iso}
    WHERE source = 'fault_data'
  `;
}

/* ------------------------------------------------------------
   Helpers: Insert Fault Data
------------------------------------------------------------ */

async function insertFaultData(rows) {
  for (const f of rows) {
    const deviceId = f.device?.id ?? null;
    const diagnosticId = f.diagnostic?.id ?? null;
    const controllerId = f.controller?.id ?? null;

    // severity fallback
    let severity = null;
    if (typeof f.faultStates === "object") {
      severity = f.faultStates.effectiveStatus ?? null;
    } else if (f.faultState) {
      severity = f.faultState;
    }

    const isActive = f.faultState === "Active";
    const occurredAt = f.dateTime || null;

    await sql`
      INSERT INTO fault_data 
        (id, device_id, occurred_at, code, source, description, severity, controller_id, is_active)
      VALUES
        (
         ${f.id},
         ${deviceId},
         ${occurredAt},
         ${diagnosticId},
         ${null},
         ${f.description || null},
         ${severity},
         ${controllerId},
         ${isActive}
        )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

/* ------------------------------------------------------------
   Helpers: Logging persistente
------------------------------------------------------------ */

async function logSuccess(recordsInserted, fromDate, toDate) {
  await sql`
    INSERT INTO etl_logs (status, records_inserted, from_date, to_date)
    VALUES ('success', ${recordsInserted}, ${fromDate}, ${toDate})
  `;
}

async function logError(error, fromDate) {
  await sql`
    INSERT INTO etl_logs (status, error_message, from_date)
    VALUES ('error', ${String(error)}, ${fromDate})
  `;
}

/* ------------------------------------------------------------
   Main Vercel Serverless Handler
------------------------------------------------------------ */

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let lastTs = null;
  let results = [];

  try {
    /** 1. Obtener último timestamp */
    lastTs = await getLastTimestamp();

    /** 2. Autenticar Geotab */
    const authentication = {
      credentials: {
        database: process.env.GEOTAB_DATABASE,
        userName: process.env.GEOTAB_USERNAME,
        password: process.env.GEOTAB_PASSWORD
      }
    };

    const api = new GeotabApi(authentication);
    await api.authenticate();

    /** 3. Obtener datos incrementales */
    results = await api.call('Get', {
      typeName: 'FaultData',
      search: { fromDate: lastTs }
    });

    let inserted = 0;
    let maxDate = null;

    /** 4. Insertar a Neon */
    if (Array.isArray(results) && results.length > 0) {
      await insertFaultData(results);
      inserted = results.length;

      for (const r of results) {
        if (!r.dateTime) continue;
        const d = new Date(r.dateTime);
        if (!maxDate || d > maxDate) maxDate = d;
      }

      if (maxDate) await updateLastTimestamp(maxDate);
    }

    /** 5. Registrar éxito */
    await logSuccess(inserted, lastTs, maxDate);

    res.status(200).json({
      status: "ok",
      inserted,
      fromDateUsed: lastTs,
      toDate: maxDate
    });

  } catch (error) {
    console.error("sync_fault_data error:", error);

    /** 6. Registrar error en log */
    await logError(error, lastTs);

    res.status(500).json({
      error: String(error),
      fromDateUsed: lastTs
    });
  }
};
