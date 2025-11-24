const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const { updateSyncState, markSyncError } = require("../sync_state");

const SOURCE = "device";

async function upsertDevices(devices) {
  let processed = 0;
  for (const d of devices) {
    await sql`
      INSERT INTO geotab_device (
        id, name, serial_number, device_type, license_plate,
        vin, active_from, active_to, is_active, time_zone,
        speeding_on, speeding_off, engine_type, raw, last_update
      ) VALUES (
        ${d.id},
        ${d.name || null},
        ${d.serialNumber || null},
        ${d.deviceType || null},
        ${d.licensePlate || null},
        ${d.vehicleIdentificationNumber || null},
        ${d.activeFrom || null},
        ${d.activeTo || null},
        ${d.isActiveTrackingEnabled ?? null},
        ${d.timeZoneId || null},
        ${d.speedingOn || null},
        ${d.speedingOff || null},
        ${d.engineType || null},
        ${JSON.stringify(d)},
        NOW()
      )
      ON CONFLICT(id) DO UPDATE SET
        name=EXCLUDED.name,
        serial_number=EXCLUDED.serial_number,
        device_type=EXCLUDED.device_type,
        license_plate=EXCLUDED.license_plate,
        vin=EXCLUDED.vin,
        active_from=EXCLUDED.active_from,
        active_to=EXCLUDED.active_to,
        is_active=EXCLUDED.is_active,
        time_zone=EXCLUDED.time_zone,
        speeding_on=EXCLUDED.speeding_on,
        speeding_off=EXCLUDED.speeding_off,
        engine_type=EXCLUDED.engine_type,
        raw=EXCLUDED.raw,
        last_update=NOW();
    `;
    processed += 1;
    if (processed % 100 === 0) {
      console.log(`2.2 Device - upserted ${processed}/${devices.length}`);
    }
  }
  console.log(`2.2 Device - upsert finished (${processed} rows)`);
}

async function syncDevice(api) {
  console.log("2.2 Device - fetching from Geotab");
  try {
    const devices = await api.call("Get", { typeName: "Device", resultsLimit: 10000 });
    console.log(`2.2 Device - received ${devices.length} records, starting upsert`);
    await upsertDevices(devices);
    console.log("2.2 Device - completed");

    await updateSyncState(SOURCE, {
      lastTimestamp: new Date().toISOString(),
      recordsCount: devices.length,
      lastError: null
    });

    return {
      devicesProcessed: devices.length
    };
  } catch (err) {
    await markSyncError(SOURCE, err);
    throw err;
  }
}

module.exports = { syncDevice };
