import { neon } from '@neondatabase/serverless';
import GeotabApi from 'mg-api-js';

const sql = neon(process.env.DATABASE_URL);

// Helpers DB

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

async function insertFaultData(rows) {
  for (const f of rows) {
    const deviceId = f.device?.id ?? null;
    const diagnosticId = f.diagnostic?.id ?? null;
    const controllerId = f.controller?.id ?? null;

    let severity = null;
    if (typeof f.faultStates === 'object') {
      severity = f.faultStates.effectiveStatus ?? null;
    } else {
      severity = f.faultState ?? null;
    }

    const isActive = f.faultState === 'Active';
    const occurredAt = f.dateTime || null;

    await sql`
      INSERT INTO fault_data 
        (id, device_id, occurred_at, code, source, description, severity, controller_id, is_active)
      VALUES
        (${f.id}, ${deviceId}, ${occurredAt}, ${diagnosticId}, ${null},
         ${f.description || null}, ${severity}, ${controllerId}, ${isActive})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

// Vercel serverless handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const lastTs = await getLastTimestamp();

    const authentication = {
      credentials: {
        database: process.env.GEOTAB_DATABASE,
        userName: process.env.GEOTAB_USERNAME,
        password: process.env.GEOTAB_PASSWORD
      }
    };

    const api = new GeotabApi(authentication);
    await api.authenticate();

    const results = await api.call('Get', {
      typeName: 'FaultData',
      search: {
        fromDate: lastTs
      }
    });

    if (Array.isArray(results) && results.length > 0) {
      await insertFaultData(results);

      let maxDate = null;
      for (const r of results) {
        if (!r.dateTime) continue;
        const d = r.dateTime instanceof Date ? r.dateTime : new Date(r.dateTime);
        if (!maxDate || d > maxDate) maxDate = d;
      }

      if (maxDate) {
        await updateLastTimestamp(maxDate);
      }
    }

    res.status(200).json({
      status: 'ok',
      inserted: Array.isArray(results) ? results.length : 0,
      fromDateUsed: lastTs
    });
  } catch (error) {
    console.error('sync_fault_data error:', error);
    res.status(500).json({
      error: String(error),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
