-- Central schema for geotab ETL storage

CREATE TABLE IF NOT EXISTS sync_state (
  source text PRIMARY KEY,
  last_timestamp timestamptz,
  records_count integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etl_logs (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  status text NOT NULL,
  records_inserted integer NOT NULL DEFAULT 0,
  device_records_processed integer NOT NULL DEFAULT 0,
  user_records_processed integer NOT NULL DEFAULT 0,
  zone_records_processed integer NOT NULL DEFAULT 0,
  rule_records_processed integer NOT NULL DEFAULT 0,
  trip_records_processed integer NOT NULL DEFAULT 0,
  from_date timestamptz,
  to_date timestamptz,
  duration_ms integer,
  raw_log jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS geotab_device (
  id text PRIMARY KEY,
  name text,
  serial_number text,
  device_type text,
  license_plate text,
  vin text,
  active_from timestamptz,
  active_to timestamptz,
  is_active boolean,
  time_zone text,
  speeding_on integer,
  speeding_off integer,
  engine_type text,
  raw jsonb NOT NULL,
  last_update timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geotab_user (
  id text PRIMARY KEY,
  name text,
  first_name text,
  last_name text,
  email text,
  is_active boolean,
  raw jsonb NOT NULL,
  last_update timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geotab_zone (
  id text PRIMARY KEY,
  name text,
  zone_type text,
  color text,
  active boolean,
  raw jsonb NOT NULL,
  last_update timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geotab_rule (
  id text PRIMARY KEY,
  name text,
  description text,
  is_active boolean,
  rule_type text,
  raw jsonb NOT NULL,
  last_update timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fault_data (
  id text PRIMARY KEY,
  device_id text,
  occurred_at timestamptz,
  code text,
  description text,
  severity text,
  controller_id text,
  is_active boolean
);

CREATE TABLE IF NOT EXISTS geotab_trip (
  id text PRIMARY KEY,
  device_id text,
  driver_id text,
  start_time timestamptz,
  end_time timestamptz,
  distance_km double precision,
  top_speed_kph double precision,
  idle_time_seconds integer,
  moving_time_seconds integer,
  stop_time_seconds integer,
  start_location jsonb,
  end_location jsonb,
  raw jsonb NOT NULL,
  last_update timestamptz NOT NULL DEFAULT NOW()
);
