import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ScrapedData, ScrapePlatformRequest, PlatformName } from '../../shared/types.ts'
import { DevfolioScraper } from '../../scrapers/devfolio-scraper.ts'
import { UnstopScraper } from '../../scrapers/unstop-scraper.ts'
import {
  DoraHacksScraper,
  Hack2SkillScraper,
  DevpostScraper,
  InternshalaScraper
} from '../../scrapers/additional-scrapers.ts'
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
    const body: ScrapePlatformRequest = await req.json()

    // Validate request
    if (!body.platform || !['devfolio', 'unstop', 'dorahacks', 'hack2skill', 'devpost', 'internshala'].includes(body.platform)) {
      return new Response(
        JSON.stringify({ error: 'Invalid platform specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const maxPages = body.max_pages || 10
    const forceUpdate = body.force_update || false

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get platform configuration
    const { data: platformData, error: platformError } = await supabase
      .from('platforms')
      .select('*')
      .eq('name', body.platform)
      .eq('is_active', true)
      .single()

    if (platformError || !platformData) {
      return new Response(
        JSON.stringify({ error: 'Platform not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check rate limiting - don't scrape if scraped within last hour unless force_update
    if (!forceUpdate && platformData.last_scraped) {
      const timeSinceLastScrape = new Date().getTime() - new Date(platformData.last_scraped).getTime()
      const oneHourMs = 60 * 60 * 1000

      if (timeSinceLastScrape < oneHourMs) {
        return new Response(
          JSON.stringify({
            error: 'Platform scraped too recently. Use force_update=true to override.',
            last_scraped: platformData.last_scraped
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create scraping log entry
    const scrapingId = uuidv4()
    const { data: scrapingLog, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        id: scrapingId,
        platform_id: platformData.id,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (logError) {
      console.error('Failed to create scraping log:', logError)
      return new Response(
        JSON.stringify({ error: 'Failed to initialize scraping' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Start scraping process in background
    const scrapingPromise = performScraping(
      body.platform,
      platformData.scraping_config,
      maxPages,
      supabase,
      scrapingId
    )

    // Don't wait for scraping to complete - return immediately
    scrapingPromise.catch(error => {
      console.error(`Background scraping failed for ${body.platform}:`, error)
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scraping initiated for ${body.platform}`,
        scraping_id: scrapingId,
        platform: body.platform,
        estimated_time: `${maxPages * 5}-${maxPages * 10} seconds`
      }),
      {
        status: 202, // Accepted
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in scrape-platform function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function performScraping(
  platformName: PlatformName,
  scrapingConfig: any,
  maxPages: number,
  supabase: any,
  scrapingId: string
): Promise<void> {
  let scrapedData: ScrapedData[] = []
  let itemsCreated = 0
  let itemsUpdated = 0
  let errorMessage = ''

  try {
    console.log(`Starting scraping for ${platformName} with max_pages=${maxPages}`)

    // Initialize appropriate scraper
    let scraper: any = null

    switch (platformName) {
      case 'devfolio':
        scraper = new DevfolioScraper(scrapingConfig)
        break
      case 'unstop':
        scraper = new UnstopScraper(scrapingConfig)
        break
      case 'dorahacks':
        scraper = new DoraHacksScraper(scrapingConfig)
        break
      case 'hack2skill':
        scraper = new Hack2SkillScraper(scrapingConfig)
        break
      case 'devpost':
        scraper = new DevpostScraper(scrapingConfig)
        break
      case 'internshala':
        scraper = new InternshalaScraper(scrapingConfig)
        break
      default:
        throw new Error(`Unknown platform: ${platformName}`)
    }

    // Perform scraping
    scrapedData = await scraper.scrape(maxPages)

    console.log(`Scraped ${scrapedData.length} opportunities from ${platformName}`)

    // Update database with scraped data
    for (const opportunity of scrapedData) {
      try {
        // Check if opportunity already exists
        const { data: existing } = await supabase
          .from('opportunities')
          .select('id')
          .eq('url', opportunity.url)
          .single()

        if (existing) {
          // Update existing opportunity
          const { error: updateError } = await supabase
            .from('opportunities')
            .update({
              title: opportunity.title,
              description: opportunity.description,
              deadline: opportunity.deadline,
              start_date: opportunity.start_date,
              end_date: opportunity.end_date,
              duration: opportunity.duration,
              mode: opportunity.mode,
              tags: opportunity.tags,
              requirements: opportunity.requirements,
              benefits: opportunity.benefits,
              eligibility: opportunity.eligibility,
              location: opportunity.location,
              prize_pool: opportunity.prize_pool,
              stipend_range: opportunity.stipend_range,
              participants_count: opportunity.participants_count,
              rating: opportunity.rating,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)

          if (!updateError) {
            itemsUpdated++
          }
        } else {
          // Insert new opportunity
          const { error: insertError } = await supabase
            .from('opportunities')
            .insert({
              title: opportunity.title,
              description: opportunity.description,
              type: opportunity.type,
              platform: platformName,
              url: opportunity.url,
              deadline: opportunity.deadline,
              start_date: opportunity.start_date,
              end_date: opportunity.end_date,
              duration: opportunity.duration,
              mode: opportunity.mode,
              tags: opportunity.tags,
              requirements: opportunity.requirements,
              benefits: opportunity.benefits,
              eligibility: opportunity.eligibility,
              location: opportunity.location,
              prize_pool: opportunity.prize_pool,
              stipend_range: opportunity.stipend_range,
              participants_count: opportunity.participants_count,
              rating: opportunity.rating,
              is_featured: false,
              is_active: true
            })

          if (!insertError) {
            itemsCreated++
          }
        }
      } catch (error) {
        console.warn(`Error processing opportunity ${opportunity.url}:`, error)
        continue
      }
    }

    console.log(`Database update complete: ${itemsCreated} created, ${itemsUpdated} updated`)

  } catch (error) {
    console.error(`Scraping failed for ${platformName}:`, error)
    errorMessage = error.message
  }

  // Update scraping log
  try {
    const { error: logUpdateError } = await supabase
      .from('scraping_logs')
      .update({
        status: errorMessage ? 'failed' : 'completed',
        items_scraped: scrapedData.length,
        items_created: itemsCreated,
        items_updated: itemsUpdated,
        error_message: errorMessage || null,
        completed_at: new Date().toISOString()
      })
      .eq('id', scrapingId)

    if (logUpdateError) {
      console.error('Failed to update scraping log:', logUpdateError)
    }

    // Update platform last_scraped timestamp
    if (!errorMessage) {
      await supabase
        .from('platforms')
        .update({
          last_scraped: new Date().toISOString()
        })
        .eq('name', platformName)
    }

  } catch (error) {
    console.error('Failed to update scraping completion status:', error)
  }
}