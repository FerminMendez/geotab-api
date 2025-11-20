const { neon } = require("@neondatabase/serverless");

module.exports = async (_req, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1`;

    res.status(200).json({
      status: "healthy",
      neon: "connected"
    });
  } catch (err) {
    res.status(500).json({
      status: "unhealthy",
      neon: "error",
      error: String(err)
    });
  }
};
