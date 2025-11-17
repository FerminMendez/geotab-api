const { neon } = require('@neondatabase/serverless');
const GeotabApi = require('mg-api-js');

const sql = neon(process.env.DATABASE_URL);

// Helpers DB

async function getLastTimestamp() {
  const rows = await sql`
    SELECT last_timestamp 
    FROM sync_state
    WHERE source = 'fault_data'
  `;
  if (rows.length === 0) {
    // fallback por si no existe el registro (no debería pasar, pero por si acaso)
    return new Date('2000-01-01T00:00:00Z').toISOString();
  }
  // Neon suele devolver timestamps como string ISO o Date; los normalizamos a ISO string
  const ts = rows[0].last_timestamp;
  return ts instanceof Date ? ts.toISOString() : ts;
}

async function updateLastTimestamp(newTs) {
  // newTs puede ser Date o string
  const iso = newTs instanceof Date ? newTs.toISOString() : newTs;
  await sql`
    UPDATE sync_state
    SET last_timestamp = ${iso}
    WHERE source = 'fault_data'
  `;
}

async function insertFaultData(rows) {
  for (const f of rows) {
    // device_id
    const deviceId =
      f.device && typeof f.device === 'object' ? f.device.id : null;

    // diagnostic code
    const diagnosticId =
      f.diagnostic && typeof f.diagnostic === 'object' ? f.diagnostic.id : null;

    // controller_id
    const controllerId =
      f.controller && typeof f.controller === 'object' ? f.controller.id : null;

    // severity: preferimos faultStates.effectiveStatus
    let severity = null;
    if (f.faultStates && typeof f.faultStates === 'object') {
      severity = f.faultStates.effectiveStatus || null;
    } else if (f.faultState) {
      severity = f.faultState;
    }

    // is_active
    const isActive = f.faultState === 'Active';

    // occurred_at
    const occurredAt = f.dateTime || null; // normalmente Date o string ISO

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
module.exports = async (req, res) => {
  // Solo permitir GET (útil para probar en el navegador)
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 1. Leer último timestamp de Neon
    const lastTs = await getLastTimestamp();

    // 2. Configurar Geotab API wrapper
    const authentication = {
      credentials: {
        database: process.env.GEOTAB_DATABASE,
        userName: process.env.GEOTAB_USERNAME,
        password: process.env.GEOTAB_PASSWORD
      }
      // path se puede omitir: va a my.geotab.com y redirige al servidor correcto :contentReference[oaicite:2]{index=2}
    };

    const api = new GeotabApi(authentication);

    // (opcional, pero explícito)
    await api.authenticate();

    // 3. Llamar a MyGeotab para FaultData incremental
    const results = await api.call('Get', {
      typeName: 'FaultData',
      search: {
        fromDate: lastTs // puede ser ISO string
      }
    });

    // 4. Insertar en Neon
    if (Array.isArray(results) && results.length > 0) {
      await insertFaultData(results);

      // 5. Calcular nuevo timestamp máximo
      let maxDate = null;
      for (const r of results) {
        if (!r.dateTime) continue;
        const d = r.dateTime instanceof Date ? r.dateTime : new Date(r.dateTime);
        if (!maxDate || d > maxDate) {
          maxDate = d;
        }
      }

      if (maxDate) {
        await updateLastTimestamp(maxDate);
      }
    }

    // 6. Respuesta OK
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
};
