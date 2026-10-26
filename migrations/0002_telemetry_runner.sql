-- Telemetry jobs can run on the production Worker or on a local helper (`npm run backfill:local`,
-- another IP so another OpenF1 quota). Each side counts its own running jobs, and a job whose
-- claim is older than the stale delay is picked up again, whoever claimed it.
ALTER TABLE sessions ADD COLUMN telemetry_runner TEXT;
ALTER TABLE sessions ADD COLUMN telemetry_claimed_at TEXT;
