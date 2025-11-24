const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const { updateSyncState, markSyncError } = require("../sync_state");

const SOURCE = "user";

async function upsertUsers(users) {
  let processed = 0;
  for (const u of users) {
    await sql`
      INSERT INTO geotab_user (
        id, name, first_name, last_name, email, is_active, raw, last_update
      )
      VALUES (
        ${u.id},
        ${u.name || null},
        ${u.firstName || null},
        ${u.lastName || null},
        ${u.email || null},
        ${u.active === true},
        ${JSON.stringify(u)},
        NOW()
      )
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        is_active = EXCLUDED.is_active,
        raw = EXCLUDED.raw,
        last_update = NOW();
    `;
    processed += 1;
    if (processed % 100 === 0) {
      console.log(`2.3 User - upserted ${processed}/${users.length}`);
    }
  }
  console.log(`2.3 User - upsert finished (${processed} rows)`);
}

async function syncUser(api) {
  console.log("2.3 User - fetching from Geotab");
  try {
    const users = await api.call("Get", {
      typeName: "User",
      resultsLimit: 10000
    });
    console.log(`2.3 User - received ${users.length} records, starting upsert`);

    await upsertUsers(users);
    console.log("2.3 User - completed");

    await updateSyncState(SOURCE, {
      lastTimestamp: new Date().toISOString(),
      recordsCount: users.length,
      lastError: null
    });

    return {
      usersProcessed: users.length
    };
  } catch (err) {
    await markSyncError(SOURCE, err);
    throw err;
  }
}

module.exports = { syncUser };
