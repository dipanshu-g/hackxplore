# HackXplore Backend API Documentation

## Overview

The HackXplore backend is built using Supabase Edge Functions and provides a comprehensive API for aggregating hackathons, internships, and scholarships from 6 major platforms. The system includes web scraping, data validation, normalization, caching, and real-time API endpoints.

## Architecture

### Database Schema

The backend uses PostgreSQL with the following main tables:

- **opportunities**: Stores all aggregated opportunities (hackathons, internships, scholarships)
- **platforms**: Platform configuration and scraping metadata
- **scraping_logs**: Tracks scraping execution and errors

### Edge Functions

Four main Supabase Edge Functions:

1. **get-opportunities**: Main API endpoint for fetching opportunities
2. **get-platform-stats**: Platform statistics and metrics
3. **scrape-platform**: Scrape individual platform data
4. **scrape-all-platforms**: Orchestrate scraping across all platforms

### Platform Scrapers

Dedicated scrapers for each platform:
- Devfolio (infinite scroll)
- Unstop (paginated)
- DoraHacks (API-like)
- Hack2Skill (card-based)
- Devpost (challenge listings)
- Internshala (internship focus)

## API Endpoints

### GET /functions/v1/get-opportunities

Fetch filtered opportunities for frontend consumption.

**Query Parameters:**
- `type` (optional): 'hackathon' | 'internship' | 'scholarship'
- `platform` (optional): Platform name
- `limit` (default: 20): Max results per page (1-100)
- `offset` (default: 0): Pagination offset
- `featured_only` (default: false): Featured opportunities only
- `deadline_after` (optional): ISO date filter
- `search` (optional): Text search in title/description

**Response:**
```json
{
  "opportunities": [
    {
      "id": "uuid",
      "title": "HackIndia 2024",
      "description": "Largest hackathon in India...",
      "type": "hackathon",
      "platform": "devfolio",
      "url": "https://devfolio.co/hacks/hackindia",
      "deadline": "2024-12-31T23:59:59Z",
      "mode": "hybrid",
      "tags": ["AI", "Web3"],
      "location": {
        "city": "Bangalore",
        "country": "India",
        "remote": true
      },
      "prize_pool": 10000,
      "platform_logo": "https://example.com/devfolio.png"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "has_more": true
  },
  "filters": {
    "types": ["hackathon", "internship", "scholarship"],
    "platforms": ["devfolio", "unstop"]
  }
}
```

### GET /functions/v1/get-platform-stats

Get statistics about data from each platform.

**Response:**
```json
{
  "platforms": [
    {
      "name": "devfolio",
      "total_opportunities": 45,
      "active_opportunities": 38,
      "hackathons": 30,
      "internships": 8,
      "scholarships": 7,
      "last_scraped": "2024-11-22T10:30:00Z",
      "logo_url": "https://example.com/devfolio.png"
    }
  ],
  "totals": {
    "opportunities": 245,
    "hackathons": 120,
    "internships": 85,
    "scholarships": 40
  }
}
```

### POST /functions/v1/scrape-platform

Scrape individual platform data.

**Request Body:**
```json
{
  "platform": "devfolio",
  "max_pages": 10,
  "force_update": false
}
```

**Response (202):**
```json
{
  "success": true,
  "message": "Scraping initiated for devfolio",
  "scraping_id": "uuid",
  "platform": "devfolio",
  "estimated_time": "50-100 seconds"
}
```

### POST /functions/v1/scrape-all-platforms

Trigger scraping of all active platforms.

**Request Body:**
```json
{
  "force": false,
  "platforms": ["devfolio", "unstop"] // Optional: specific platforms
}
```

**Response (202):**
```json
{
  "success": true,
  "message": "Scraping initiated for 6 platforms",
  "scraping_id": "uuid",
  "platforms": [
    {
      "platform": "devfolio",
      "status": "queued",
      "estimated_items": 50
    }
  ]
}
```

## Data Validation

All scraped data undergoes comprehensive validation:

- **Title**: Required, max 200 characters
- **Description**: Optional, max 2000 characters, HTML stripped
- **URL**: Required, valid URL format, unique constraint
- **Deadline**: Required, future date only
- **Prize Pool**: Positive integer, converted to USD
- **Participants**: Positive integer
- **Rating**: Number between 0-5

## Data Normalization

1. **Dates**: All converted to ISO 8601 UTC
2. **Currency**: Prize amounts converted to USD
3. **Locations**: Standardized country/city format
4. **Tags**: Lowercase, deduplicated, max 10 tags
5. **Text**: HTML stripped, whitespace normalized
6. **URLs**: Absolute URLs with UTM tracking

## Performance & Caching

### Edge Caching
- **get-opportunities**: 5-minute cache
- **get-platform-stats**: 15-minute cache
- **Static data**: 1-hour cache

### Database Optimization
- Partial indexes on active opportunities
- GIN indexes on JSON arrays
- Composite indexes for common queries
- Connection pooling via PgBouncer

### Rate Limiting
- **Public APIs**: 100 requests/IP/minute
- **Search**: 50 searches/IP/minute
- **Scraping**: 1 full scrape/day/platform

## Security

### Access Control
- Row Level Security (RLS) enabled
- Public read access for opportunities
- Admin-only write access
- Service role key for Edge Functions

### Scraping Ethics
- Respects robots.txt
- Configurable rate limits
- Clear bot identification
- Only public data aggregation

## Error Handling

Standardized error response format:
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { ... } // Optional additional context
}
```

Common error codes:
- `INVALID_REQUEST`: Malformed request
- `VALIDATION_FAILED`: Input validation failed
- `RESOURCE_NOT_FOUND`: Opportunity not found
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `PLATFORM_NOT_FOUND`: Platform not available

## Monitoring & Logging

### Structured Logging
- Request/response tracking
- Scraping progress and errors
- Database query performance
- Cache hit/miss ratios

### Metrics
- Scraping success rates
- API response times
- Data freshness indicators
- Error rate tracking

## Environment Setup

### Required Environment Variables
```bash
SUPABASE_URL=your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional Environment Variables
```bash
SCRAPING_USER_AGENT=HackXplore-Bot/1.0 (+https://hackxplore.com)
SCRAPING_CONCURRENCY=3
SCRAPING_TIMEOUT=30000
SCRAPING_RATE_LIMIT=30
EXCHANGE_RATE_API_KEY=for-currency-conversion
SLACK_WEBHOOK_URL=for-notifications
```

## Deployment

### Database Setup
1. Run migrations in order:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
   - `003_platform_data.sql`

### Edge Functions Deployment
```bash
supabase functions deploy get-opportunities
supabase functions deploy get-platform-stats
supabase functions deploy scrape-platform
supabase functions deploy scrape-all-platforms
```

### Configuration
- Set environment variables in Supabase dashboard
- Configure database roles and permissions
- Set up monitoring and alerting

## Frontend Integration

### Supabase Client Setup
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
)
```

### Example Usage
```typescript
// Fetch opportunities
const { data, error } = await supabase.functions.invoke('get-opportunities', {
  body: { type: 'hackathon', limit: 20 }
})

// Get platform stats
const { data: stats } = await supabase.functions.invoke('get-platform-stats')

// Trigger scraping (admin only)
const { data: result } = await supabase.functions.invoke('scrape-all-platforms', {
  body: { force: false }
})
```

## Testing

### Unit Tests
- Data validation functions
- Normalization algorithms
- Error handling logic

### Integration Tests
- End-to-end scraping flows
- Database operations
- API response formats

### Performance Tests
- Load testing with concurrent requests
- Scraping performance benchmarks
- Database query optimization

## Future Enhancements

### Planned Features
- Real-time notifications for new opportunities
- User bookmarks and saved searches
- Advanced filtering and search capabilities
- Machine learning for opportunity recommendations
- Mobile app API endpoints

### Platform Additions
- More internship platforms
- University-specific portals
- Company career pages
- Scholarship databases

### Performance Improvements
- Redis caching layer
- CDN for static assets
- Database read replicas
- GraphQL API alternative

---

For more details, see the individual function documentation in the `supabase/functions/` directory.