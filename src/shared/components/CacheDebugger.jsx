import { useState, useEffect } from 'react';
import { API_CONFIG } from '../../constants/config.js';

/**
 * Cache Debugger Component
 * Shows cache performance metrics in development mode
 */
export function CacheDebugger({ darkMode }) {
  const [cacheStats, setCacheStats] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState(null);

  // Show in development mode, with different behavior for cache API vs direct API
  const shouldShow = API_CONFIG.SHOW_CACHE_HEADERS;

  const fetchCacheStats = async () => {
    if (!shouldShow) return;
    
    // Only try to fetch stats if we're using the cache API
    if (!API_CONFIG.USE_CACHE_API) {
      setCacheStats({
        message: 'Using direct OpenF1 API',
        mode: 'direct'
      });
      return;
    }
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/stats`);
      if (response.ok) {
        const stats = await response.json();
        setCacheStats({...stats, mode: 'cache'});
        setError(null);
      } else {
        setError(`Failed to fetch stats: ${response.status}`);
      }
    } catch (err) {
      setError(`Cache stats error: ${err.message}`);
    }
  };

  useEffect(() => {
    if (shouldShow) {
      fetchCacheStats();
      // Refresh stats every 30 seconds
      const interval = setInterval(fetchCacheStats, 30000);
      return () => clearInterval(interval);
    }
  }, [shouldShow]);

  if (!shouldShow) return null;

  const containerStyle = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 1000,
    backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
    border: `1px solid ${darkMode ? '#333333' : '#e5e5e5'}`,
    borderRadius: '8px',
    padding: '12px',
    minWidth: '300px',
    maxWidth: '400px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: darkMode ? '#ffffff' : '#000000',
    transition: 'all 0.3s ease'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isVisible ? '12px' : '0',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer'
  };

  const statRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
    padding: '2px 0'
  };

  const labelStyle = {
    color: darkMode ? '#888888' : '#666666'
  };

  const valueStyle = {
    color: darkMode ? '#00ff00' : '#007700',
    fontWeight: 'bold'
  };

  const errorStyle = {
    color: '#ff4444',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '8px'
  };

  const calculateHitRate = (hits, misses) => {
    const total = hits + misses;
    return total > 0 ? ((hits / total) * 100).toFixed(1) : '0.0';
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle} onClick={() => setIsVisible(!isVisible)}>
        <span>🚀 Cache Stats</span>
        <span>{isVisible ? '▼' : '▲'}</span>
      </div>
      
      {isVisible && (
        <>
          {error ? (
            <div style={errorStyle}>{error}</div>
          ) : cacheStats ? (
            <>
              {cacheStats.mode === 'direct' ? (
                <>
                  <div style={statRowStyle}>
                    <span style={labelStyle}>API Mode:</span>
                    <span style={valueStyle}>Direct OpenF1</span>
                  </div>
                  
                  <div style={statRowStyle}>
                    <span style={labelStyle}>Base URL:</span>
                    <span style={{...valueStyle, fontSize: '10px'}}>{API_CONFIG.DIRECT_API_URL}</span>
                  </div>
                  
                  <div style={statRowStyle}>
                    <span style={labelStyle}>Cache Time:</span>
                    <span style={valueStyle}>{API_CONFIG.CACHE_TIME / 1000}s</span>
                  </div>
                  
                  <div style={{ 
                    textAlign: 'center', 
                    marginTop: '8px',
                    fontSize: '10px',
                    color: darkMode ? '#666666' : '#999999'
                  }}>
                    Using React Query cache only
                  </div>
                </>
              ) : (
                <>
                  <div style={statRowStyle}>
                    <span style={labelStyle}>Cache Entries:</span>
                    <span style={valueStyle}>{cacheStats.cache.total_entries || 0}</span>
                  </div>
                  
                  <div style={statRowStyle}>
                    <span style={labelStyle}>Total Size:</span>
                    <span style={valueStyle}>{formatSize(cacheStats.cache.total_size)}</span>
                  </div>
                  
                  <div style={statRowStyle}>
                    <span style={labelStyle}>Total Hits:</span>
                    <span style={valueStyle}>{cacheStats.cache.total_hits || 0}</span>
                  </div>
                  
                  <div style={statRowStyle}>
                    <span style={labelStyle}>Expired:</span>
                    <span style={valueStyle}>{cacheStats.cache.expired_entries || 0}</span>
                  </div>
                  
                  {cacheStats.analytics && cacheStats.analytics.length > 0 && (
                    <>
                      <div style={{ 
                        borderTop: `1px solid ${darkMode ? '#333333' : '#e5e5e5'}`,
                        marginTop: '8px',
                        paddingTop: '8px',
                        fontSize: '11px'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                          Top Endpoints (7 days):
                        </div>
                        
                        {cacheStats.analytics.slice(0, 5).map((endpoint, index) => {
                          const hitRate = calculateHitRate(endpoint.hits, endpoint.misses);
                          return (
                            <div key={index} style={{ marginBottom: '4px' }}>
                              <div style={statRowStyle}>
                                <span style={labelStyle}>{endpoint.endpoint}:</span>
                                <span style={valueStyle}>{endpoint.requests}</span>
                              </div>
                              <div style={statRowStyle}>
                                <span style={{ ...labelStyle, paddingLeft: '12px' }}>Hit Rate:</span>
                                <span style={valueStyle}>{hitRate}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  
                  <div style={{ 
                    textAlign: 'center', 
                    marginTop: '8px',
                    fontSize: '10px',
                    color: darkMode ? '#666666' : '#999999'
                  }}>
                    Updates every 30s • Click to collapse
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: labelStyle.color }}>
              Loading...
            </div>
          )}
        </>
      )}
    </div>
  );
}