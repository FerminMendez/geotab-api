const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const { updateSyncState, markSyncError } = require("../sync_state");

const SOURCE = "rule";

async function upsertRules(rules) {
  let processed = 0;
  for (const r of rules) {
    await sql`
      INSERT INTO geotab_rule (
        id, name, description, is_active, rule_type, raw, last_update
      )
      VALUES (
        ${r.id},
        ${r.name || null},
        ${r.comment || null},
        ${r.active === true},
        ${r.ruleTypeId || null},
        ${JSON.stringify(r)},
        NOW()
      )
      ON CONFLICT(id) DO UPDATE SET
        name=EXCLUDED.name,
        description=EXCLUDED.description,
        is_active=EXCLUDED.is_active,
        rule_type=EXCLUDED.rule_type,
        raw=EXCLUDED.raw,
        last_update=NOW();
    `;
    processed += 1;
    if (processed % 100 === 0) {
      console.log(`2.5 Rule - upserted ${processed}/${rules.length}`);
    }
  }
  console.log(`2.5 Rule - upsert finished (${processed} rows)`);
}

async function syncRule(api) {
  console.log("2.5 Rule - fetching from Geotab");
  try {
    const rules = await api.call("Get", { typeName: "Rule" });
    console.log(`2.5 Rule - received ${rules.length} records, starting upsert`);
    await upsertRules(rules);
    console.log("2.5 Rule - completed");

    await updateSyncState(SOURCE, {
      lastTimestamp: new Date().toISOString(),
      recordsCount: rules.length,
      lastError: null
    });

    return { rulesProcessed: rules.length };
  } catch (err) {
    await markSyncError(SOURCE, err);
    throw err;
  }
}

module.exports = { syncRule };
