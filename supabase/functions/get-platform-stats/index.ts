import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GetPlatformStatsResponse, PlatformStats } from '../../shared/types.ts'

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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get platform statistics
    const { data: platformData, error: platformError } = await supabase
      .from('platforms')
      .select(`
        id,
        name,
        logo_url,
        last_scraped,
        opportunities!left (
          id,
          type,
          is_active,
          deadline
        )
      `)
      .eq('is_active', true)

    if (platformError) {
      console.error('Error fetching platform stats:', platformError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch platform statistics' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process platform statistics
    const platforms: PlatformStats[] = platformData?.map(platform => {
      const opportunities = platform.opportunities || []
      const activeOpportunities = opportunities.filter(opp => opp.is_active)

      const hackathons = activeOpportunities.filter(opp => opp.type === 'hackathon')
      const internships = activeOpportunities.filter(opp => opp.type === 'internship')
      const scholarships = activeOpportunities.filter(opp => opp.type === 'scholarship')

      return {
        name: platform.name,
        total_opportunities: opportunities.length,
        active_opportunities: activeOpportunities.length,
        hackathons: hackathons.length,
        internships: internships.length,
        scholarships: scholarships.length,
        last_scraped: platform.last_scraped,
        logo_url: platform.logo_url
      }
    }) || []

    // Calculate totals
    const totals = platforms.reduce(
      (acc, platform) => ({
        opportunities: acc.opportunities + platform.total_opportunities,
        hackathons: acc.hackathons + platform.hackathons,
        internships: acc.internships + platform.internships,
        scholarships: acc.scholarships + platform.scholarships
      }),
      {
        opportunities: 0,
        hackathons: 0,
        internships: 0,
        scholarships: 0
      }
    )

    // Build response
    const response: GetPlatformStatsResponse = {
      platforms,
      totals
    }

    // Set cache headers
    const headers = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=900', // 15 minutes cache
      'Vary': 'Accept-Encoding'
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers }
    )

  } catch (error) {
    console.error('Error in get-platform-stats function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})