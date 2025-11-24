const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const { getSyncCursor, updateSyncState, markSyncError } = require("../sync_state");

const SOURCE = "trip";
const DEFAULT_FROM = "2000-01-01T00:00:00Z";

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

  let processed = 0;
  for (const t of batch) {
    const idle = durationToSeconds(t.idlingDuration ?? t.idleDuration);
    const drive = durationToSeconds(t.drivingDuration ?? t.driveDuration);
    const stop = durationToSeconds(t.stopDuration);

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
        ${idle},
        ${drive},
        ${stop},
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

    processed += 1;
    if (processed % 100 === 0) {
      console.log(`2.6 Trip - batch upserted ${processed}/${batch.length}`);
    }
  }
}


/* -------------------------------------------
   Main Sync Function
------------------------------------------- */
async function syncTrip(api) {
  console.log("2.6 Trip - fetching from Geotab");

  try {
    let fromDate = await getSyncCursor(SOURCE, DEFAULT_FROM);
    if (!fromDate) fromDate = DEFAULT_FROM;
    console.log(`2.6 Trip - fromDate ${fromDate}`);

    const BATCH = 500;
    const SAFETY_LIMIT = 5000;
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

      await insertTripsBatch(trips);
      total += trips.length;

      for (const t of trips) {
        if (t.stop) {
          const d = new Date(t.stop);
          if (!maxDate || d > maxDate) maxDate = d;
        }
      }

      if (maxDate) {
        const iso = maxDate.toISOString();
        fromDate = iso;
        await updateSyncState(SOURCE, {
          lastTimestamp: iso,
          recordsCount: total,
          lastError: null
        });
      }

      if (total >= SAFETY_LIMIT) {
        console.log("2.6 Trip - Safety stop at 5000 rows (serverless protection)");
        break;
      }
    }

    const finalTimestamp = maxDate ? maxDate.toISOString() : fromDate;
    await updateSyncState(SOURCE, {
      lastTimestamp: finalTimestamp,
      recordsCount: total,
      lastError: null
    });

    console.log(`2.6 Trip - completed. Total: ${total}`);

    return {
      tripsProcessed: total,
      fromDate,
      toDate: maxDate
    };
  } catch (err) {
    await markSyncError(SOURCE, err);
    throw err;
  }
}


module.exports = { syncTrip };
