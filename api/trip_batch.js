// api/trip_batch.js
const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const BATCH = 500;

function durationToSeconds(value) {
  if (!value) return null;
  const str = String(value).trim();
  const parts = str.split(":");
  if (parts.length !== 3) return null;
  const [h, m, s] = parts.map(Number);
  return Math.round(h * 3600 + m * 60 + s);
}

async function getTripTimestamp() {
  const rows = await sql`
    SELECT last_timestamp
    FROM sync_state
    WHERE source='trip'
  `;
  if (rows.length === 0) {
    return new Date("2000-01-01T00:00:00Z").toISOString();
  }
  const ts = rows[0].last_timestamp;
  return ts instanceof Date ? ts.toISOString() : ts;
}

async function updateTripTimestamp(ts) {
  const iso = ts instanceof Date ? ts.toISOString() : ts;
  await sql`
    UPDATE sync_state
    SET last_timestamp = ${iso},
        updated_at = NOW()
    WHERE source='trip'
  `;
}

async function insertTripsBatch(batch) {
  if (!batch.length) return;

  const rows = batch.map(t => sql`
    (
      ${t.id},
      ${t.device?.id || null},
      ${t.driver?.id || null},
      ${t.start || null},
      ${t.stop || null},
      ${t.distance || null},
      ${t.maximumSpeed || null},
      ${durationToSeconds(t.idleDuration)},
      ${durationToSeconds(t.driveDuration)},
      ${durationToSeconds(t.stopDuration)},
      ${JSON.stringify(t.startPosition || null)},
      ${JSON.stringify(t.stopPosition || null)},
      ${JSON.stringify(t)},
      NOW()
    )
  `);

  await sql`
    INSERT INTO geotab_trip (
      id, device_id, driver_id,
      start_time, end_time,
      distance_km, top_speed_kph,
      idle_time_seconds, moving_time_seconds, stop_time_seconds,
      start_location, end_location,
      raw, last_update
    )
    VALUES ${sql.join(rows, ",")}
    ON CONFLICT(id) DO UPDATE SET
      device_id = EXCLUDED.device_id,
      driver_id = EXCLUDED.driver_id,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      distance_km = EXCLUDED.distance_km,
      top_speed_kph = EXCLUDED.top_speed_kph,
      idle_time_seconds = EXCLUDED.idle_time_seconds,
      moving_time_seconds = EXCLUDED.moving_time_seconds,
      stop_time_seconds = EXCLUDED.stop_time_seconds,
      start_location = EXCLUDED.start_location,
      end_location = EXCLUDED.end_location,
      raw = EXCLUDED.raw,
      last_update = NOW();
  `;
}

module.exports = async (req, res) => {
  try {
    const GeotabApi = require("mg-api-js");
    const api = new GeotabApi({
      credentials: {
        database: process.env.GEOTAB_DATABASE,
        userName: process.env.GEOTAB_USERNAME,
        password: process.env.GEOTAB_PASSWORD
      }
    });

    await api.authenticate();

    const fromDate = await getTripTimestamp();

    const batch = await api.call("Get", {
      typeName: "Trip",
      search: { fromDate },
      resultsLimit: BATCH
    });

    await insertTripsBatch(batch);

    let maxDate = null;
    for (const t of batch) {
      if (t.stop) {
        const d = new Date(t.stop);
        if (!maxDate || d > maxDate) maxDate = d;
      }
    }

    if (maxDate) await updateTripTimestamp(maxDate);

    res.status(200).json({
      processed: batch.length,
      nextFromDate: maxDate,
      hasMore: batch.length === BATCH
    });

  } catch (err) {
    console.error("trip_batch error:", err);
    res.status(500).json({ error: String(err) });
  }
};
