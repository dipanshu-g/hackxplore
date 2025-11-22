import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GetOpportunitiesRequest, GetOpportunitiesResponse, OpportunityType, PlatformName } from '../../shared/types.ts'

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
    const url = new URL(req.url)
    const searchParams = url.searchParams

    // Parse query parameters
    const request: GetOpportunitiesRequest = {
      type: searchParams.get('type') as OpportunityType || undefined,
      platform: searchParams.get('platform') as PlatformName || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
      featured_only: searchParams.get('featured_only') === 'true',
      deadline_after: searchParams.get('deadline_after') || undefined,
      search: searchParams.get('search') || undefined,
    }

    // Validate parameters
    if (request.type && !['hackathon', 'internship', 'scholarship'].includes(request.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.platform && !['devfolio', 'unstop', 'dorahacks', 'hack2skill', 'devpost', 'internshala'].includes(request.platform)) {
      return new Response(
        JSON.stringify({ error: 'Invalid platform parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.limit && (request.limit < 1 || request.limit > 100)) {
      return new Response(
        JSON.stringify({ error: 'Limit must be between 1 and 100' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.offset && request.offset < 0) {
      return new Response(
        JSON.stringify({ error: 'Offset must be non-negative' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.deadline_after) {
      const deadlineDate = new Date(request.deadline_after)
      if (isNaN(deadlineDate.getTime())) {
        return new Response(
          JSON.stringify({ error: 'Invalid deadline_after date format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Build the base query
    let query = supabase
      .from('opportunities')
      .select(`
        *,
        platforms!inner (
          name,
          logo_url
        )
      `, { count: 'exact' })

    // Apply filters
    const whereConditions: string[] = []

    // Always filter for active opportunities
    query = query.eq('is_active', true)

    if (request.type) {
      query = query.eq('type', request.type)
    }

    if (request.platform) {
      query = query.eq('platform', request.platform)
    }

    if (request.featured_only) {
      query = query.eq('is_featured', true)
    }

    if (request.deadline_after) {
      query = query.gte('deadline', request.deadline_after)
    }

    if (request.search) {
      // Search in title and description
      query = query.or(`title.ilike.%${request.search}%,description.ilike.%${request.search}%`)
    }

    // Add ordering
    // Priority: Featured first, then by deadline (earliest first), then by rating (highest first)
    query = query
      .order('is_featured', { ascending: false })
      .order('deadline', { ascending: true, nullsFirst: false })
      .order('rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    // Apply pagination
    query = query.range(request.offset, request.offset + request.limit - 1)

    // Execute query
    const { data: opportunities, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch opportunities' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform data to match expected response format
    const transformedOpportunities = opportunities?.map(opp => ({
      id: opp.id,
      title: opp.title,
      description: opp.description,
      type: opp.type,
      platform: opp.platform,
      url: opp.url,
      deadline: opp.deadline,
      start_date: opp.start_date,
      end_date: opp.end_date,
      duration: opp.duration,
      mode: opp.mode,
      tags: opp.tags,
      requirements: opp.requirements,
      benefits: opp.benefits,
      eligibility: opp.eligibility,
      location: opp.location,
      prize_pool: opp.prize_pool,
      stipend_range: opp.stipend_range,
      participants_count: opp.participants_count,
      rating: opp.rating,
      is_featured: opp.is_featured,
      is_active: opp.is_active,
      scraped_at: opp.scraped_at,
      updated_at: opp.updated_at,
      platform_logo: opp.platforms?.logo_url
    })) || []

    // Get available filter options
    const { data: typesData } = await supabase
      .from('opportunities')
      .select('type')
      .eq('is_active', true)

    const { data: platformsData } = await supabase
      .from('platforms')
      .select('name')
      .eq('is_active', true)

    const types = [...new Set(typesData?.map(item => item.type))] as OpportunityType[]
    const platforms = platformsData?.map(item => item.name) as PlatformName[]

    // Build response
    const response: GetOpportunitiesResponse = {
      opportunities: transformedOpportunities,
      pagination: {
        total: count || 0,
        limit: request.limit,
        offset: request.offset,
        has_more: (request.offset + request.limit) < (count || 0)
      },
      filters: {
        types,
        platforms
      }
    }

    // Set cache headers for GET requests
    const headers = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // 5 minutes cache
      'Vary': 'Accept-Encoding'
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers }
    )

  } catch (error) {
    console.error('Error in get-opportunities function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})