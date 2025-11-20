const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function upsertRules(rules) {
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
  }
}

async function syncRule(api) {
  const rules = await api.call("Get", { typeName: "Rule" });
  await upsertRules(rules);
  return { rulesProcessed: rules.length };
}

module.exports = { syncRule };
