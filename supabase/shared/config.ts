// Configuration constants and environment variable handling

export const config = {
  supabase: {
    url: Deno.env.get('SUPABASE_URL') || '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  },

  scraping: {
    userAgent: Deno.env.get('SCRAPING_USER_AGENT') || 'HackXplore-Bot/1.0 (+https://hackxplore.com)',
    concurrency: parseInt(Deno.env.get('SCRAPING_CONCURRENCY') || '3'),
    timeout: parseInt(Deno.env.get('SCRAPING_TIMEOUT') || '30000'),
    rateLimit: parseInt(Deno.env.get('SCRAPING_RATE_LIMIT') || '30'),
    maxRetries: parseInt(Deno.env.get('SCRAPING_MAX_RETRIES') || '3')
  },

  external: {
    exchangeRateApiKey: Deno.env.get('EXCHANGE_RATE_API_KEY'),
    slackWebhookUrl: Deno.env.get('SLACK_WEBHOOK_URL'),
    cloudinaryCloudName: Deno.env.get('CLOUDINARY_CLOUD_NAME')
  },

  cache: {
    defaultTTL: 300, // 5 minutes
    platformStatsTTL: 900, // 15 minutes
    staticDataTTL: 3600 // 1 hour
  },

  rateLimit: {
    publicApi: 100, // requests per IP per minute
    searchApi: 50,  // searches per IP per minute
    scrapingApi: 1  // full scrape per day per platform
  }
}

export function validateEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL environment variable is required')
  }

  if (!config.supabase.serviceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  }

  if (config.scraping.concurrency < 1 || config.scraping.concurrency > 10) {
    errors.push('SCRAPING_CONCURRENCY must be between 1 and 10')
  }

  if (config.scraping.timeout < 5000 || config.scraping.timeout > 120000) {
    errors.push('SCRAPING_TIMEOUT must be between 5000 and 120000 milliseconds')
  }

  if (config.scraping.rateLimit < 1 || config.scraping.rateLimit > 100) {
    errors.push('SCRAPING_RATE_LIMIT must be between 1 and 100 requests per minute')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}