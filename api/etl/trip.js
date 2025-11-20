const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

/* -------------------------------------------
   Helpers for Sync State
------------------------------------------- */

async function getTripTimestamp() {
  const rows = await sql`
    SELECT last_timestamp
    FROM sync_state
    WHERE source = 'trip'
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
    SET last_timestamp = ${iso}
    WHERE source = 'trip'
  `;
}

/* -------------------------------------------
   Insert Trip rows
------------------------------------------- */

async function insertTrips(list) {
  for (const t of list) {
    await sql`
      INSERT INTO geotab_trip (
        id, device_id, driver_id,
        start_time, end_time,
        distance_km, top_speed_kph,
        idle_time_seconds, moving_time_seconds, stop_time_seconds,
        start_location, end_location,
        raw, last_update
      )
      VALUES (
        ${t.id},
        ${t.device?.id || null},
        ${t.driver?.id || null},
        ${t.start || null},
        ${t.stop || null},
        ${t.distance || null},
        ${t.maximumSpeed || null},
        ${t.idleDuration || null},
        ${t.driveDuration || null},
        ${t.stopDuration || null},
        ${JSON.stringify(t.startPosition || null)},
        ${JSON.stringify(t.stopPosition || null)},
        ${JSON.stringify(t)},
        NOW()
      )
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
}

/* -------------------------------------------
   Main Sync Function
------------------------------------------- */

async function syncTrip(api) {
  const lastTs = await getTripTimestamp();

  const trips = await api.call("Get", {
    typeName: "Trip",
    search: { fromDate: lastTs },
    resultsLimit: 10000
  });

  let count = trips.length;
  let maxDate = null;

  if (count > 0) {
    await insertTrips(trips);

    for (const t of trips) {
      if (!t.stop) continue;
      const d = new Date(t.stop);
      if (!maxDate || d > maxDate) maxDate = d;
    }

    if (maxDate) {
      await updateTripTimestamp(maxDate);
    }
  }

  return {
    tripsProcessed: count,
    fromDate: lastTs,
    toDate: maxDate
  };
}

module.exports = { syncTrip };
