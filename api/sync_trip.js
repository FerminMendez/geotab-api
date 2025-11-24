// api/sync_trip.js
module.exports = async (req, res) => {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const baseUrl = process.env.APP_URL || (host ? `${protocol}://${host}` : null);

    if (!baseUrl) {
      throw new Error("APP_URL/host missing for trip_batch call");
    }

    let total = 0;
    let loops = 0;

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

    res.status(200).json({
      status: "ok",
      batchesExecuted: loops,
      totalInserted: total
    });

  } catch (err) {
    console.error("sync_trip error:", err);
    res.status(500).json({ error: String(err) });
  }
};


