// api/sync.js
const GeotabApi = require("mg-api-js");

const { syncFaultData } = require("../lib/etl/fault");
const { syncDevice } = require("../lib/etl/device");
const { syncUser } = require("../lib/etl/user");
const { syncZone } = require("../lib/etl/zone");
const { syncRule } = require("../lib/etl/rule");

// ⚠️ Trip se sincroniza ahora por su propio job (trip_batch + sync_trip)
// const { syncTrip } = require("../lib/etl/trip");

const { logSuccess, logError } = require("../lib/etl/utils");

module.exports = async (req, res) => {
  const start = Date.now();
  let fromDateFault = null;

  try {
    console.log("1. Authenticating...");

    const api = new GeotabApi({
      credentials: {
        database: process.env.GEOTAB_DATABASE,
        userName: process.env.GEOTAB_USERNAME,
        password: process.env.GEOTAB_PASSWORD
      }
    });

    await api.authenticate();
    console.log("1.1 Auth OK");

    console.log("2. Starting parallel syncs (FaultData, Device, User, Zone, Rule)...");

    const [
      faultResult,
      deviceResult,
      userResult,
      zoneResult,
      ruleResult
    ] = await Promise.all([
      syncFaultData(api),
      syncDevice(api),
      syncUser(api),
      syncZone(api),
      syncRule(api)
    ]);

    console.log("2.1 Parallel syncs resolved");

    fromDateFault = faultResult.fromDate;

    const duration = Date.now() - start;

    console.log("3. Logging success...");
    await logSuccess({
      recordsInserted: faultResult.recordsInserted,
      devicesProcessed: deviceResult.devicesProcessed,
      usersProcessed: userResult.usersProcessed,
      zonesProcessed: zoneResult.zonesProcessed,
      rulesProcessed: ruleResult.rulesProcessed,
      // Trip is excluded from main sync now
      tripsProcessed: 0, 

      fromDate: faultResult.fromDate,
      toDate: faultResult.toDate,
      duration,
      raw: {
        faultResult,
        deviceResult,
        userResult,
        zoneResult,
        ruleResult
      }
    });

    console.log("4. Sending success response");

    res.status(200).json({
      status: "ok",
      faultResult,
      deviceResult,
      userResult,
      zoneResult,
      ruleResult,
      tripsHandledSeparately: true,
      duration
    });

  } catch (err) {
    const duration = Date.now() - start;

    console.log("E1. Logging error...");
    
    await logError({
      error: String(err),
      fromDate: fromDateFault,
      duration,
      raw: { message: err.message, stack: err.stack }
    });

    console.log("E2. Sending error response");

    res.status(500).json({
      error: String(err),
      duration
    });
  }
};
