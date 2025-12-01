// api/sync_trip.js
const { logSuccess, logError } = require("../lib/etl/utils");

module.exports = async (req, res) => {
  const start = Date.now();
  let loops = 0;
  let total = 0;

  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const baseUrl = process.env.APP_URL || (host ? `${protocol}://${host}` : null);

    if (!baseUrl) {
      throw new Error("APP_URL/host missing for trip_batch call");
    }

    while (true) {
      loops++;
      const resp = await fetch(`${baseUrl}/api/trip_batch`);
      const data = await resp.json();

      if (resp.status !== 200) {
        throw new Error("Batch error: " + JSON.stringify(data));
      }

      total += data.processed;

      if (!data.hasMore) break;
      if (loops >= 50) break; // safety guard (50 batches)
    }

    const duration = Date.now() - start;

    await logSuccess({
      tripsProcessed: total,
      fromDate: null,
      toDate: null,
      duration,
      raw: { batchesExecuted: loops, totalInserted: total }
    });

    res.status(200).json({
      status: "ok",
      batchesExecuted: loops,
      totalInserted: total
    });

  } catch (err) {
    console.error("sync_trip error:", err);
    const duration = Date.now() - start;
    await logError({
      error: String(err),
      fromDate: null,
      duration,
      raw: { message: err.message, stack: err.stack, batchesExecuted: loops, totalInserted: total }
    });
    res.status(500).json({ error: String(err) });
  }
};


