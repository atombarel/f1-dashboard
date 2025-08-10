# F1 API Cache Worker

A Cloudflare Worker that provides intelligent caching for the OpenF1 API using D1 database and multi-layer caching strategies.

## Features

- **Multi-layer caching**: Cache API (local edge) → D1 (global persistent) → OpenF1 API (fallback)
- **Intelligent TTL**: Smart cache durations based on data type and session status
- **Cost-effective**: Uses D1 for cheaper read operations (500x cheaper than KV)
- **Analytics**: Built-in cache hit rate monitoring and performance tracking
- **CORS support**: Ready for frontend integration
- **Auto-cleanup**: Scheduled cleanup of expired cache entries

## Architecture

```
Frontend Request → Worker → Cache API (local) → D1 Database (global) → OpenF1 API
                    ↓         ↓                  ↓                      ↓
                Response ← Cache Hit ←      Cache Hit      ←      Fresh Data
```

## Cache Strategy

### Static Data (Long TTL)
- `meetings`: 30 days
- `drivers`: 7 days

### Session Data (Medium TTL)
- `sessions`: 24 hours
- `session_result`: 24 hours
- `starting_grid`: 24 hours

### Dynamic Data (Smart TTL)
- `laps`, `stints`: 24h if completed, 5min if ongoing
- `race_control`, `pit`, `position`, `intervals`: 1h if completed, 30s if ongoing

## Deployment

### 1. Install Dependencies

```bash
cd cloudflare-worker
npm install
```

### 2. Create D1 Database

```bash
npx wrangler d1 create f1-api-cache-db
```

Copy the database ID from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "f1-api-cache-db"
database_id = "your-database-id-here"
```

### 3. Run Migrations

```bash
# For development (local)
npm run db:migrate:dev

# For production
npm run db:migrate
```

### 4. Deploy Worker

```bash
# Deploy to production
npm run deploy

# Deploy to development environment
npm run deploy:dev
```

### 5. Test Deployment

```bash
# Health check
curl https://your-worker.your-subdomain.workers.dev/health

# Test API endpoint
curl https://your-worker.your-subdomain.workers.dev/meetings?year=2024
```

## Local Development

```bash
# Start local development server
npm run dev

# Test local endpoints
curl http://localhost:8787/meetings?year=2024
curl http://localhost:8787/stats
```

## Monitoring

### Cache Statistics

```bash
curl https://your-worker.your-subdomain.workers.dev/stats
```

Returns:
```json
{
  "cache": {
    "total_entries": 1250,
    "total_size": 15680000,
    "total_hits": 45230,
    "expired_entries": 12
  },
  "analytics": [
    {
      "endpoint": "laps",
      "hits": 1500,
      "misses": 50,
      "requests": 1550,
      "avg_response_time": 45
    }
  ]
}
```

### Manual Cache Cleanup

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/cleanup
```

## Configuration

### Environment Variables

- `OPENF1_API_BASE`: OpenF1 API base URL (default: https://api.openf1.org/v1)
- `CACHE_DEBUG`: Enable detailed logging (default: false)

### Scheduled Tasks

The worker includes a scheduled event handler for daily cache cleanup at 2 AM UTC. Add this to your `wrangler.toml`:

```toml
[triggers]
crons = ["0 2 * * *"]
```

## API Endpoints

All OpenF1 API endpoints are supported:

- `GET /meetings?year=2024`
- `GET /sessions?meeting_key=1234`
- `GET /drivers?session_key=5678`
- `GET /laps?session_key=5678&driver_number=44`
- `GET /stints?session_key=5678`
- `GET /race_control?session_key=5678`
- `GET /pit?session_key=5678`
- `GET /position?session_key=5678`
- `GET /intervals?session_key=5678`
- `GET /session_result?session_key=5678`
- `GET /starting_grid?session_key=5678`
- `GET /weather?session_key=5678`

### Special Endpoints

- `GET /health` - Health check
- `GET /stats` - Cache statistics
- `POST /cleanup` - Manual cache cleanup

## Response Headers

- `x-cache-hit`: true/false indicating if response came from cache
- `x-cache-source`: local/d1/api indicating cache source
- `x-endpoint`: the API endpoint that was called

## Cost Optimization

This worker is designed for cost-effectiveness:

- **D1 reads**: $0.001 per million (vs KV's $0.50 per million)
- **Free tier**: 5M daily reads (vs KV's 100K)
- **Local caching**: Reduces D1 usage for frequently accessed data
- **Smart TTL**: Longer cache times for static data, shorter for dynamic

Expected costs for moderate usage:
- 10M API reads/month: ~$0.01
- 1M cache writes/month: ~$1.00
- 5GB storage: Free (within limit)

## Troubleshooting

### Common Issues

1. **Database not found**: Make sure you've run migrations and updated the database ID in `wrangler.toml`
2. **CORS errors**: The worker includes proper CORS headers for browser requests
3. **Cache misses**: Check the `/stats` endpoint to monitor hit rates
4. **Performance**: Monitor the `x-cache-source` header to see cache effectiveness

### Debug Mode

Enable debug logging by setting `CACHE_DEBUG=true` in your environment variables. This will:
- Log all requests to the database
- Track detailed analytics
- Provide more verbose error messages