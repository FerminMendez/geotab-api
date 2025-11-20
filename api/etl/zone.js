const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function upsertZones(zones) {
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
  }
}

async function syncZone(api) {
  const zones = await api.call("Get", { typeName: "Zone" });
  await upsertZones(zones);
  return { zonesProcessed: zones.length };
}

module.exports = { syncZone };
