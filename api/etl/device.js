const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function upsertDevices(devices) {
  for (const d of devices) {
    await sql`
      INSERT INTO device (
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
  }
}

async function syncDevice(api) {
  const devices = await api.call("Get", { typeName: "Device", resultsLimit: 10000 });
  await upsertDevices(devices);

  return {
    devicesProcessed: devices.length
  };
}

module.exports = { syncDevice };
