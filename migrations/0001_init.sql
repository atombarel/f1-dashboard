-- Calendar: one row per meeting (Grand Prix weekend or test), synced from OpenF1 + Jolpica.
CREATE TABLE meetings (
  meeting_key   INTEGER PRIMARY KEY,
  year          INTEGER NOT NULL,
  round         INTEGER,
  name          TEXT NOT NULL,
  official_name TEXT,
  location      TEXT,
  country_code  TEXT,
  country_name  TEXT,
  country_flag  TEXT,
  circuit_key   INTEGER,
  circuit_name  TEXT,
  circuit_image TEXT,
  gmt_offset    TEXT,
  date_start    TEXT NOT NULL,
  date_end      TEXT NOT NULL,
  is_cancelled  INTEGER NOT NULL DEFAULT 0,
  is_testing    INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL
);
CREATE INDEX meetings_year ON meetings (year, date_start);

-- Sessions and their ingestion state machine:
--   pending -> queued -> done (pass 1: provisional, pass 2: final) | error
CREATE TABLE sessions (
  session_key       INTEGER PRIMARY KEY,
  meeting_key       INTEGER NOT NULL REFERENCES meetings (meeting_key),
  year              INTEGER NOT NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,
  kind              TEXT NOT NULL,
  date_start        TEXT NOT NULL,
  date_end          TEXT NOT NULL,
  is_cancelled      INTEGER NOT NULL DEFAULT 0,
  ingest_state      TEXT NOT NULL DEFAULT 'pending',
  ingest_pass       INTEGER NOT NULL DEFAULT 0,
  ingest_attempts   INTEGER NOT NULL DEFAULT 0,
  ingest_error      TEXT,
  queued_at         TEXT,
  ingested_at       TEXT,
  version           TEXT,
  telemetry_state   TEXT NOT NULL DEFAULT 'none', -- none | queued | done | error
  telemetry_version TEXT,
  podium            TEXT,
  updated_at        TEXT NOT NULL
);
CREATE INDEX sessions_meeting ON sessions (meeting_key);
CREATE INDEX sessions_ingest ON sessions (ingest_state, date_end);

-- Small bookkeeping values (last sync times, standings versions…).
CREATE TABLE kv (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
