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

function durationToSeconds(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Handle optional day prefix formatted as "d.hh:mm:ss"
  let days = 0;
  let timePortion = trimmed;
  const daySplit = trimmed.split(".");
  if (daySplit.length === 2 && !daySplit[0].includes(":") && daySplit[1].includes(":")) {
    days = parseInt(daySplit[0], 10) || 0;
    timePortion = daySplit[1];
  }

  const segments = timePortion.split(":");
  if (segments.length !== 3) return null;

  const hours = parseInt(segments[0], 10);
  const minutes = parseInt(segments[1], 10);
  const seconds = parseFloat(segments[2]);

  if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) {
    return null;
  }

  const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return Math.round(totalSeconds);
}

async function insertTripsBatch(batch) {
  if (batch.length === 0) return;

  const rows = batch.map(t => {
    const idle = durationToSeconds(t.idlingDuration ?? t.idleDuration);
    const drive = durationToSeconds(t.drivingDuration ?? t.driveDuration);
    const stop = durationToSeconds(t.stopDuration);

    return sql`
      (
        ${t.id},
        ${t.device?.id || null},
        ${t.driver?.id || null},
        ${t.start || null},
        ${t.stop || null},
        ${t.distance || null},
        ${t.maximumSpeed || null},
        ${idle},
        ${drive},
        ${stop},
        ${JSON.stringify(t.startPosition || null)},
        ${JSON.stringify(t.stopPosition || null)},
        ${JSON.stringify(t)},
        NOW()
      )
    `;
  });

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


/* -------------------------------------------
   Main Sync Function
------------------------------------------- */
async function syncTrip(api) {
  console.log("2.6 Trip - fetching from Geotab");

  let fromDate = await getTripTimestamp();
  console.log(`2.6 Trip - fromDate ${fromDate}`);

  const BATCH = 500;
  let total = 0;
  let maxDate = null;

  while (true) {
    console.log(`2.6 Trip - fetching batch from ${fromDate}`);

    const trips = await api.call("Get", {
      typeName: "Trip",
      search: { fromDate },
      resultsLimit: BATCH
    });

    console.log(`2.6 Trip - received batch ${trips.length}`);

    if (trips.length === 0) break;

    // Insert batch
    await insertTripsBatch(trips);
    total += trips.length;

    // Update cursor (max stop datetime)
    for (const t of trips) {
      if (t.stop) {
        const d = new Date(t.stop);
        if (!maxDate || d > maxDate) maxDate = d;
      }
    }

    if (maxDate) {
      fromDate = maxDate.toISOString();
      await updateTripTimestamp(maxDate);
    }

    // Safety break for serverless
    if (total >= 5000) {
      console.log("2.6 Trip - Safety stop at 5000 rows (serverless protection)");
      break;
    }
  }

  console.log(`2.6 Trip - completed. Total: ${total}`);

  return {
    tripsProcessed: total,
    fromDate,
    toDate: maxDate
  };
}


module.exports = { syncTrip };
