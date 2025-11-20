# SQL Assets

This directory contains everything needed to provision and evolve the Neon/PostgreSQL schema that backs the ETL endpoints.

## Structure

- `schema.sql` – idempotent definition of all ETL tables. Apply this when creating a brand-new database.
- `migrations/` – append-only SQL files for incremental changes. Each file name starts with a timestamp to preserve ordering (e.g., `2023112001_extend_sync_state.sql`).

## Usage

1. **Bootstrap a database**
   ```sh
   psql "$DATABASE_URL" -f sql/schema.sql
   ```
   Run this once for new environments to create all tables.

2. **Apply migrations**
   ```sh
   for file in sql/migrations/*.sql; do
     psql "$DATABASE_URL" -f "$file"
   done
   ```
   Execute migrations in lexical order whenever new files are added (CI/CD can automate this).

3. **Verification**
   - Inspect `sync_state` to confirm the new `records_count`, `last_error`, and `updated_at` columns exist.
   - Exercise `/api/sync` to ensure metadata rows are written for each ETL module.

> Tip: when working locally with Neon, you can set `DATABASE_URL` in `.env` so both `psql` and the Vercel functions share the same connection string.
