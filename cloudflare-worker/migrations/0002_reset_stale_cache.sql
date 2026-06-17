-- One-time reset for stale cached season data.
DELETE FROM request_logs;
DELETE FROM cache_analytics;
DELETE FROM api_cache;
