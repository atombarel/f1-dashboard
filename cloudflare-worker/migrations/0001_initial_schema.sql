-- Initial schema for F1 API cache
CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    params TEXT,
    response_data JSON NOT NULL,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    hit_count INTEGER DEFAULT 0,
    response_size INTEGER DEFAULT 0,
    status_code INTEGER DEFAULT 200
);

-- Index for fast lookups by endpoint
CREATE INDEX IF NOT EXISTS idx_endpoint ON api_cache(endpoint);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_expires_at ON api_cache(expires_at);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_cached_at ON api_cache(cached_at);

-- Table for cache analytics and monitoring
CREATE TABLE IF NOT EXISTS cache_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE DEFAULT CURRENT_DATE,
    endpoint TEXT NOT NULL,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint for daily analytics per endpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_analytics ON cache_analytics(date, endpoint);

-- Table for request logs (optional, for debugging)
CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    params TEXT,
    cache_hit BOOLEAN DEFAULT FALSE,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    user_agent TEXT,
    country TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for request logs by endpoint and date
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint_date ON request_logs(endpoint, created_at);