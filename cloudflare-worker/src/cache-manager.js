import { 
  CACHE_CONFIG, 
  CACHE_LEVELS, 
  getCacheTtl, 
  generateCacheKey, 
  isCacheExpired,
  isPermanentCache
} from './cache-config.js';

/**
 * Multi-layer cache manager for F1 API data
 * Implements Cache API (local) -> D1 (global) -> OpenF1 API (fallback)
 */
export class CacheManager {
  constructor(env, ctx) {
    this.env = env;
    this.ctx = ctx;
    this.db = env.DB;
    this.cache = caches.default;
  }

  /**
   * Get cached data with multi-layer fallback
   */
  async get(endpoint, params = {}, contextData = {}) {
    const cacheKey = generateCacheKey(endpoint, params);
    const config = CACHE_CONFIG[endpoint];
    const level = config ? CACHE_LEVELS[config.cacheLevel] : CACHE_LEVELS.session;
    const ttl = getCacheTtl(endpoint, params, contextData);
    const isPermanent = isPermanentCache(endpoint, params, contextData);

    let startTime = Date.now();
    let cacheHit = false;
    let source = 'api';

    try {
      // Layer 1: Cache API (local edge cache)
      if (level.useLocal) {
        const localData = await this.getFromCacheAPI(cacheKey, level.localTtl);
        if (localData) {
          cacheHit = true;
          source = 'local';
          await this.logRequest(endpoint, params, true, Date.now() - startTime, 200);
          return { data: localData, cacheHit, source };
        }
      }

      // Layer 2: D1 Database (global persistent cache)
      if (level.useD1) {
        const d1Data = await this.getFromD1(cacheKey, isPermanent);
        if (d1Data) {
          cacheHit = true;
          source = 'd1';
          
          // Store in local cache for future requests
          if (level.useLocal) {
            await this.storeToCacheAPI(cacheKey, d1Data, level.localTtl);
          }
          
          await this.logRequest(endpoint, params, true, Date.now() - startTime, 200);
          return { data: d1Data, cacheHit, source };
        }
      }

      // Layer 3: Fallback to OpenF1 API
      const apiData = await this.getFromAPI(endpoint, params);
      source = 'api';
      
      // Store in both cache layers
      const promises = [];
      
      if (level.useD1) {
        promises.push(this.storeToD1(cacheKey, endpoint, params, apiData, ttl, isPermanent));
      }
      
      if (level.useLocal) {
        promises.push(this.storeToCacheAPI(cacheKey, apiData, level.localTtl));
      }
      
      // Don't await cache storage to avoid slowing down response
      this.ctx.waitUntil(Promise.all(promises));
      
      await this.logRequest(endpoint, params, false, Date.now() - startTime, 200);
      return { data: apiData, cacheHit, source };

    } catch (error) {
      console.error(`Cache error for ${cacheKey}:`, error);
      await this.logRequest(endpoint, params, false, Date.now() - startTime, 500, error.message);
      throw error;
    }
  }

  /**
   * Get data from Cache API (local edge cache)
   */
  async getFromCacheAPI(cacheKey, localTtl) {
    try {
      const cacheUrl = new URL(`https://cache.local/${cacheKey}`);
      const cachedResponse = await this.cache.match(cacheUrl);
      
      if (!cachedResponse) return null;
      
      const cachedData = await cachedResponse.json();
      const cachedAt = new Date(cachedResponse.headers.get('cached-at') || 0);
      
      // Check if local cache is expired
      if (isCacheExpired(cachedAt, localTtl)) {
        await this.cache.delete(cacheUrl);
        return null;
      }
      
      return cachedData;
    } catch (error) {
      console.error('Cache API get error:', error);
      return null;
    }
  }

  /**
   * Store data to Cache API (local edge cache)
   */
  async storeToCacheAPI(cacheKey, data, localTtl) {
    try {
      const cacheUrl = new URL(`https://cache.local/${cacheKey}`);
      const response = new Response(JSON.stringify(data), {
        headers: {
          'content-type': 'application/json',
          'cached-at': new Date().toISOString(),
          'cache-control': `max-age=${localTtl}`
        }
      });
      
      await this.cache.put(cacheUrl, response);
    } catch (error) {
      console.error('Cache API store error:', error);
    }
  }

  /**
   * Get data from D1 database
   */
  async getFromD1(cacheKey, isPermanent = false) {
    try {
      // For permanent cache, ignore expiration. For temporary cache, check expiration
      const query = isPermanent ? 
        `SELECT response_data, cached_at, hit_count 
         FROM api_cache 
         WHERE cache_key = ?` :
        `SELECT response_data, cached_at, hit_count 
         FROM api_cache 
         WHERE cache_key = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`;
      
      const result = await this.db.prepare(query).bind(cacheKey).first();

      if (!result) return null;

      // Update hit count asynchronously
      this.ctx.waitUntil(
        this.db.prepare(`
          UPDATE api_cache 
          SET hit_count = hit_count + 1 
          WHERE cache_key = ?
        `).bind(cacheKey).run()
      );

      return JSON.parse(result.response_data);
    } catch (error) {
      console.error('D1 get error:', error);
      return null;
    }
  }

  /**
   * Store data to D1 database
   */
  async storeToD1(cacheKey, endpoint, params, data, ttl, isPermanent = false) {
    try {
      const now = new Date();
      const expiresAt = isPermanent ? null : new Date(now.getTime() + (ttl * 1000));
      const responseSize = JSON.stringify(data).length;

      await this.db.prepare(`
        INSERT OR REPLACE INTO api_cache 
        (cache_key, endpoint, params, response_data, cached_at, expires_at, hit_count, response_size)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).bind(
        cacheKey,
        endpoint,
        JSON.stringify(params),
        JSON.stringify(data),
        now.toISOString(),
        expiresAt ? expiresAt.toISOString() : null,
        responseSize
      ).run();

    } catch (error) {
      console.error('D1 store error:', error);
    }
  }

  /**
   * Fetch data from OpenF1 API
   */
  async getFromAPI(endpoint, params) {
    const url = new URL(`${this.env.OPENF1_API_BASE}/${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'F1-Dashboard-Cache/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenF1 API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Log request for analytics
   */
  async logRequest(endpoint, params, cacheHit, responseTimeMs, statusCode, errorMessage = null) {
    if (!this.env.CACHE_DEBUG) return;

    try {
      const requestId = crypto.randomUUID();
      
      await this.db.prepare(`
        INSERT INTO request_logs 
        (request_id, endpoint, params, cache_hit, response_time_ms, status_code, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        requestId,
        endpoint,
        JSON.stringify(params),
        cacheHit,
        responseTimeMs,
        statusCode,
        errorMessage
      ).run();

      // Update daily analytics
      await this.updateAnalytics(endpoint, cacheHit, responseTimeMs, statusCode === 200 ? 0 : 1);
      
    } catch (error) {
      console.error('Logging error:', error);
    }
  }

  /**
   * Update daily analytics
   */
  async updateAnalytics(endpoint, cacheHit, responseTimeMs, isError) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await this.db.prepare(`
        INSERT INTO cache_analytics 
        (date, endpoint, cache_hits, cache_misses, total_requests, avg_response_time_ms, errors)
        VALUES (?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(date, endpoint) DO UPDATE SET
          cache_hits = cache_hits + ?,
          cache_misses = cache_misses + ?,
          total_requests = total_requests + 1,
          avg_response_time_ms = (avg_response_time_ms * (total_requests - 1) + ?) / total_requests,
          errors = errors + ?,
          updated_at = datetime('now')
      `).bind(
        today,
        endpoint,
        cacheHit ? 1 : 0,
        cacheHit ? 0 : 1,
        responseTimeMs,
        isError,
        cacheHit ? 1 : 0,
        cacheHit ? 0 : 1,
        responseTimeMs,
        isError
      ).run();

    } catch (error) {
      console.error('Analytics update error:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpired() {
    try {
      const result = await this.db.prepare(`
        DELETE FROM api_cache 
        WHERE expires_at < datetime('now')
      `).run();

      console.log(`Cleaned up ${result.changes} expired cache entries`);
      return result.changes;
    } catch (error) {
      console.error('Cleanup error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const stats = await this.db.prepare(`
        SELECT 
          COUNT(*) as total_entries,
          SUM(response_size) as total_size,
          SUM(hit_count) as total_hits,
          COUNT(CASE WHEN expires_at < datetime('now') THEN 1 END) as expired_entries
        FROM api_cache
      `).first();

      const analytics = await this.db.prepare(`
        SELECT 
          endpoint,
          SUM(cache_hits) as hits,
          SUM(cache_misses) as misses,
          SUM(total_requests) as requests,
          AVG(avg_response_time_ms) as avg_response_time
        FROM cache_analytics 
        WHERE date >= date('now', '-7 days')
        GROUP BY endpoint
        ORDER BY requests DESC
      `).all();

      return {
        cache: stats,
        analytics: analytics.results || []
      };
    } catch (error) {
      console.error('Stats error:', error);
      return { cache: {}, analytics: [] };
    }
  }
}