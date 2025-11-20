const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function upsertUsers(users) {
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
  }
}

async function syncUser(api) {
  const users = await api.call("Get", {
    typeName: "User",
    resultsLimit: 10000
  });

  await upsertUsers(users);

  return {
    usersProcessed: users.length
  };
}

module.exports = { syncUser };
