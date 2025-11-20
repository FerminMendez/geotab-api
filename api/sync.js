const GeotabApi = require("mg-api-js");

const { syncFaultData } = require("./etl/fault");
const { syncDevice } = require("./etl/device");
const { syncTrip } = require("./etl/trip");
const { syncUser } = require("./etl/user");
const { syncZone } = require("./etl/zone");
const { syncRule } = require("./etl/rule");



const { logSuccess, logError } = require("./etl/utils");

module.exports = async (req, res) => {
  const start = Date.now();
  let fromDateFault = null;

  try {
    const api = new GeotabApi({
      credentials: {
        database: process.env.GEOTAB_DATABASE,
        userName: process.env.GEOTAB_USERNAME,
        password: process.env.GEOTAB_PASSWORD
      }
    });

    await api.authenticate();

    // FaultData incremental
    const faultResult = await syncFaultData(api);
    fromDateFault = faultResult.fromDate;

    // Device
    const deviceResult = await syncDevice(api);

    // User
    const userResult = await syncUser(api);

    // Zone
    const zoneResult = await syncZone(api);

    // Rule
    const ruleResult = await syncRule(api);

    // Trip
    const tripResult = await syncTrip(api);

    // Final logging
    const duration = Date.now() - start;

    await logSuccess({
      recordsInserted: faultResult.recordsInserted,
      devicesProcessed: deviceResult.devicesProcessed,
      usersProcessed: userResult.usersProcessed,
      zonesProcessed: zoneResult.zonesProcessed,
      rulesProcessed: ruleResult.rulesProcessed,
      tripsProcessed: tripResult.tripsProcessed,
      fromDate: faultResult.fromDate,
      toDate: faultResult.toDate,
      duration,
      raw: { faultResult, deviceResult, userResult, zoneResult, ruleResult, tripResult }
    });

    res.status(200).json({
      status: "ok",
      faultResult,
      deviceResult,
      userResult,
      zoneResult,
      ruleResult,
      tripResult,
      duration
    });

  } catch (err) {
    const duration = Date.now() - start;

    await logError({
      error: String(err),
      fromDate: fromDateFault,
      duration,
      raw: { message: err.message, stack: err.stack }
    });

    res.status(500).json({
      error: String(err),
      duration
    });
  }
};
