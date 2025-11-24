const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const { updateSyncState, markSyncError } = require("../sync_state");

const SOURCE = "zone";

async function upsertZones(zones) {
  let processed = 0;
  for (const z of zones) {
    await sql`
      INSERT INTO geotab_zone (
        id, name, zone_type, color, active, raw, last_update
      )
      VALUES (
        ${z.id},
        ${z.name || null},
        ${z.zoneTypeId || null},
        ${z.color || null},
        ${z.active === true},
        ${JSON.stringify(z)},
        NOW()
      )
      ON CONFLICT(id) DO UPDATE SET
        name=EXCLUDED.name,
        zone_type=EXCLUDED.zone_type,
        color=EXCLUDED.color,
        active=EXCLUDED.active,
        raw=EXCLUDED.raw,
        last_update=NOW();
    `;
    processed += 1;
    if (processed % 100 === 0) {
      console.log(`2.4 Zone - upserted ${processed}/${zones.length}`);
    }
  }
  console.log(`2.4 Zone - upsert finished (${processed} rows)`);
}

async function syncZone(api) {
  console.log("2.4 Zone - fetching from Geotab");
  try {
    const zones = await api.call("Get", { typeName: "Zone" });
    console.log(`2.4 Zone - received ${zones.length} records, starting upsert`);
    await upsertZones(zones);
    console.log("2.4 Zone - completed");

    await updateSyncState(SOURCE, {
      lastTimestamp: new Date().toISOString(),
      recordsCount: zones.length,
      lastError: null
    });

    return { zonesProcessed: zones.length };
  } catch (err) {
    await markSyncError(SOURCE, err);
    throw err;
  }
}

module.exports = { syncZone };
