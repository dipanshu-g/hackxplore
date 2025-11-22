import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ScrapeAllRequest, ScrapeAllResponse, PlatformName } from '../../shared/types.ts'
import { v4 as uuidv4 } from 'https://deno.land/std@0.168.0/uuid/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const body: ScrapeAllRequest = await req.json()
    const force = body.force || false
    const requestedPlatforms = body.platforms || []

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get active platforms
    let platformQuery = supabase
      .from('platforms')
      .select('*')
      .eq('is_active', true)

    if (requestedPlatforms.length > 0) {
      platformQuery = platformQuery.in('name', requestedPlatforms)
    }

    const { data: platforms, error: platformError } = await platformQuery

    if (platformError || !platforms || platforms.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active platforms found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check global rate limiting
    if (!force) {
      const { data: recentScrapes } = await supabase
        .from('scraping_logs')
        .select('*')
        .gte('started_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .eq('status', 'running')

      if (recentScrapes && recentScrapes.length > 0) {
        return new Response(
          JSON.stringify({
            error: 'Scraping already in progress. Please wait or use force=true to override.',
            active_scrapes: recentScrapes.length
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create main scraping log entry
    const scrapingId = uuidv4()
    const platformsToScrape = platforms.map(platform => platform.name as PlatformName)

    // Queue individual platform scraping jobs
    const queuedPlatforms = []
    let totalEstimatedItems = 0

    for (const platform of platforms) {
      // Check individual platform rate limiting
      if (!force && platform.last_scraped) {
        const timeSinceLastScrape = new Date().getTime() - new Date(platform.last_scraped).getTime()
        const oneHourMs = 60 * 60 * 1000

        if (timeSinceLastScrape < oneHourMs) {
          queuedPlatforms.push({
            platform: platform.name,
            status: 'skipped',
            estimated_items: 0,
            reason: 'Recently scraped'
          })
          continue
        }
      }

      // Estimate items based on platform
      const estimatedItems = getEstimatedItems(platform.name)
      totalEstimatedItems += estimatedItems

      // Trigger individual platform scraping
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/scrape-platform`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            platform: platform.name,
            max_pages: 10,
            force_update: force
          })
        })

        if (response.ok) {
          queuedPlatforms.push({
            platform: platform.name,
            status: 'queued',
            estimated_items: estimatedItems
          })
        } else {
          queuedPlatforms.push({
            platform: platform.name,
            status: 'failed',
            estimated_items: 0,
            reason: 'Failed to queue'
          })
        }
      } catch (error) {
        queuedPlatforms.push({
          platform: platform.name,
          status: 'failed',
          estimated_items: 0,
          reason: error.message
        })
      }
    }

    const successfulQueues = queuedPlatforms.filter(p => p.status === 'queued').length

    if (successfulQueues === 0) {
      return new Response(
        JSON.stringify({
          error: 'No platforms queued for scraping',
          platforms: queuedPlatforms
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create master scraping log entry
    await supabase
      .from('scraping_logs')
      .insert({
        id: scrapingId,
        platform_id: platforms[0].id, // Use first platform as reference
        status: 'running',
        metadata: {
          type: 'batch_scrape',
          platforms_queued: successfulQueues,
          total_estimated_items: totalEstimatedItems
        },
        started_at: new Date().toISOString()
      })

    const response: ScrapeAllResponse = {
      success: true,
      message: `Scraping initiated for ${successfulQueues} platforms`,
      scraping_id: scrapingId,
      platforms: queuedPlatforms
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 202, // Accepted
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in scrape-all-platforms function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getEstimatedItems(platformName: string): number {
  // Estimate number of opportunities per platform based on typical volumes
  const estimates: Record<string, number> = {
    'devfolio': 50,      // Devfolio typically has 40-60 active hackathons
    'unstop': 80,        // Unstop has many competitions and challenges
    'dorahacks': 30,     // DoraHacks focuses on bounties and hackathons
    'hack2skill': 40,    // Hack2Skill moderate volume
    'devpost': 25,       // Devpost fewer but larger hackathons
    'internshala': 120   // Internshala has many internships
  }

  return estimates[platformName] || 50
}