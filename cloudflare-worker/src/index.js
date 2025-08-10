import { CacheManager } from './cache-manager.js';

/**
 * Main Cloudflare Worker for F1 API caching
 * Provides a caching layer between the F1 dashboard and OpenF1 API
 */
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize cache manager
    const cacheManager = new CacheManager(env, ctx);

    try {
      // Health check endpoint
      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), {
          headers: { 'content-type': 'application/json', ...getCorsHeaders() }
        });
      }

      // Cache stats endpoint (for monitoring)
      if (path === '/stats') {
        const stats = await cacheManager.getStats();
        return new Response(JSON.stringify(stats), {
          headers: { 'content-type': 'application/json', ...getCorsHeaders() }
        });
      }

      // Cache cleanup endpoint (for maintenance)
      if (path === '/cleanup' && request.method === 'POST') {
        const cleaned = await cacheManager.cleanupExpired();
        return new Response(JSON.stringify({ cleaned }), {
          headers: { 'content-type': 'application/json', ...getCorsHeaders() }
        });
      }

      // Extract API endpoint from path
      const endpoint = path.startsWith('/') ? path.slice(1) : path;
      
      // Validate endpoint
      if (!isValidEndpoint(endpoint)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid endpoint',
          endpoint,
          valid_endpoints: getValidEndpoints()
        }), {
          status: 400,
          headers: { 'content-type': 'application/json', ...getCorsHeaders() }
        });
      }

      // Extract query parameters
      const params = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      // Gather context data for intelligent cache decisions
      const contextData = {};
      
      // Get session data if available
      if (params.session_key) {
        try {
          const sessionResult = await cacheManager.get('sessions', { 
            meeting_key: params.meeting_key 
          });
          const sessions = sessionResult.data || [];
          contextData.sessionData = sessions.find(s => s.session_key.toString() === params.session_key);
          contextData.sessionsData = sessions;
        } catch (error) {
          console.log('Could not fetch session data for caching:', error.message);
        }
      }
      
      // Get meeting data if available
      if (params.meeting_key && !contextData.sessionData) {
        try {
          const meetingsResult = await cacheManager.get('meetings', { 
            year: params.year || new Date().getFullYear()
          });
          const meetings = meetingsResult.data || [];
          contextData.meetingData = meetings.find(m => m.meeting_key.toString() === params.meeting_key);
        } catch (error) {
          console.log('Could not fetch meeting data for caching:', error.message);
        }
      }

      // Get cached or fresh data with full context
      const result = await cacheManager.get(endpoint, params, contextData);
      
      // Prepare response headers
      const headers = {
        'content-type': 'application/json',
        'x-cache-hit': result.cacheHit.toString(),
        'x-cache-source': result.source,
        'x-endpoint': endpoint,
        ...getCorsHeaders()
      };

      // Add cache control headers based on endpoint and context
      const cacheConfig = getCacheControlHeaders(endpoint, contextData.sessionData, contextData);
      Object.assign(headers, cacheConfig);

      return new Response(JSON.stringify(result.data), {
        headers,
        status: 200
      });

    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        endpoint: path,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'content-type': 'application/json', ...getCorsHeaders() }
      });
    }
  },

  // Scheduled event handler for maintenance tasks
  async scheduled(controller, env, ctx) {
    const cacheManager = new CacheManager(env, ctx);
    
    // Clean up expired cache entries daily
    if (controller.cron === '0 2 * * *') { // Daily at 2 AM
      console.log('Running daily cache cleanup...');
      const cleaned = await cacheManager.cleanupExpired();
      console.log(`Cleaned up ${cleaned} expired entries`);
    }
  }
};

/**
 * Handle CORS preflight requests
 */
function handleOptions(request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400'
  };

  return new Response(null, { headers });
}

/**
 * Get CORS headers for responses
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Expose-Headers': 'x-cache-hit, x-cache-source, x-endpoint'
  };
}

/**
 * Validate if endpoint is allowed
 */
function isValidEndpoint(endpoint) {
  const validEndpoints = getValidEndpoints();
  return validEndpoints.includes(endpoint);
}

/**
 * Get list of valid F1 API endpoints
 */
function getValidEndpoints() {
  return [
    'meetings',
    'sessions',
    'drivers',
    'laps',
    'stints',
    'weather',
    'pit',
    'race_control',
    'position',
    'intervals',
    'session_result',
    'starting_grid'
  ];
}

/**
 * Get cache control headers based on F1 data immutability rules
 */
function getCacheControlHeaders(endpoint, sessionData, contextData = {}) {
  // Note: We'll duplicate the logic here to avoid circular imports
  // This could be refactored later with better module organization
  
  // Check if this is permanent cache data (simplified logic)
  const isCompletedSession = sessionData && sessionData.date_end && 
    (new Date() - new Date(sessionData.date_end)) > (3 * 60 * 60 * 1000);
  
  const immutableEndpoints = ['laps', 'stints', 'session_result', 'starting_grid', 
                              'race_control', 'pit', 'position', 'intervals', 'weather'];
  
  // For permanent cache (completed F1 data), use very long cache times
  if (immutableEndpoints.includes(endpoint) && isCompletedSession) {
    return {
      'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable', // 1 year, immutable
      'expires': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
    };
  }
  
  // For seasonal data (meetings)
  if (endpoint === 'meetings') {
    // If past season, cache aggressively
    const year = new Date().getFullYear();
    if (contextData.year && parseInt(contextData.year) < year) {
      return {
        'cache-control': 'public, max-age=31536000, s-maxage=31536000', // 1 year for past seasons
        'expires': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
      };
    } else {
      return {
        'cache-control': 'public, max-age=86400, s-maxage=86400', // 1 day for current season
        'expires': new Date(Date.now() + 86400 * 1000).toUTCString()
      };
    }
  }
  
  // For meeting-level data (sessions)
  if (['sessions'].includes(endpoint)) {
    return {
      'cache-control': 'public, max-age=3600, s-maxage=3600', // 1 hour
      'expires': new Date(Date.now() + 3600 * 1000).toUTCString()
    };
  }
  
  // For session-level data (drivers)
  if (['drivers'].includes(endpoint)) {
    return {
      'cache-control': 'public, max-age=3600, s-maxage=3600', // 1 hour
      'expires': new Date(Date.now() + 3600 * 1000).toUTCString()
    };
  }
  
  // For immutable session data that's currently ongoing
  if (immutableEndpoints.includes(endpoint)) {
    // If session is completed, this data is immutable and can be cached permanently
    const isCompleted = sessionData && sessionData.date_end && 
      (new Date() - new Date(sessionData.date_end)) > (3 * 60 * 60 * 1000);
    
    if (isCompleted) {
      return {
        'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable', // 1 year, immutable
        'expires': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
      };
    } else {
      // For ongoing sessions, use short cache times
      const shortCacheTime = endpoint === 'race_control' || endpoint === 'position' || endpoint === 'intervals' ? 30 : 120;
      return {
        'cache-control': `public, max-age=${shortCacheTime}, s-maxage=${shortCacheTime}`,
        'expires': new Date(Date.now() + shortCacheTime * 1000).toUTCString()
      };
    }
  }

  // Default cache headers for unknown endpoints
  return {
    'cache-control': 'public, max-age=300, s-maxage=300',
    'expires': new Date(Date.now() + 300 * 1000).toUTCString()
  };
}