const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

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
  const rules = await api.call("Get", { typeName: "Rule" });
  console.log(`2.5 Rule - received ${rules.length} records, starting upsert`);
  await upsertRules(rules);
  console.log("2.5 Rule - completed");
  return { rulesProcessed: rules.length };
}

module.exports = { syncRule };
