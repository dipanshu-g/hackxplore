// Shared types for HackXplore backend API

export type OpportunityType = 'hackathon' | 'internship' | 'scholarship';
export type PlatformName = 'devfolio' | 'unstop' | 'dorahacks' | 'hack2skill' | 'devpost' | 'internshala';
export type ScrapingStatus = 'running' | 'completed' | 'failed' | 'partial';

export interface Opportunity {
  id: string;
  title: string;
  description?: string;
  type: OpportunityType;
  platform: PlatformName;
  url: string;
  deadline?: string;
  start_date?: string;
  end_date?: string;
  duration?: string;
  mode?: string;
  tags?: string[];
  requirements?: string[];
  benefits?: string[];
  eligibility?: string;
  location?: {
    city?: string;
    country?: string;
    remote?: boolean;
  };
  prize_pool?: number;
  stipend_range?: string;
  participants_count?: number;
  rating?: number;
  is_featured: boolean;
  is_active: boolean;
  scraped_at: string;
  updated_at: string;
}

export interface Platform {
  id: string;
  name: PlatformName;
  base_url: string;
  logo_url?: string;
  scraping_config: ScrapingConfig;
  is_active: boolean;
  last_scraped?: string;
  created_at: string;
}

export interface ScrapingLog {
  id: string;
  platform_id: string;
  status: ScrapingStatus;
  items_scraped: number;
  items_updated: number;
  items_created: number;
  error_message?: string;
  metadata?: Record<string, any>;
  started_at: string;
  completed_at?: string;
}

export interface ScrapingConfig {
  selectors: {
    title: string;
    description: string;
    deadline: string;
    prize_pool?: string;
    stipend?: string;
    location?: string;
    mode?: string;
    tags?: string;
    url?: string;
  };
  pagination: {
    next_button: string;
    max_pages: number;
    infinite_scroll?: boolean;
  };
  rate_limit: {
    requests_per_minute: number;
    delay_between_requests: number;
  };
  headers?: Record<string, string>;
  endpoints?: {
    [key: string]: string;
  };
}

export interface ScrapeAllRequest {
  force?: boolean;
  platforms?: PlatformName[];
}

export interface ScrapeAllResponse {
  success: boolean;
  message: string;
  scraping_id: string;
  platforms: {
    platform: PlatformName;
    status: 'queued' | 'skipped';
    estimated_items?: number;
  }[];
}

export interface ScrapePlatformRequest {
  platform: PlatformName;
  max_pages?: number;
  force_update?: boolean;
}

export interface GetOpportunitiesRequest {
  type?: OpportunityType;
  platform?: PlatformName;
  limit?: number;
  offset?: number;
  featured_only?: boolean;
  deadline_after?: string;
  search?: string;
}

export interface GetOpportunitiesResponse {
  opportunities: (Opportunity & { platform_logo?: string })[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters: {
    types: OpportunityType[];
    platforms: PlatformName[];
  };
}

export interface PlatformStats {
  name: PlatformName;
  total_opportunities: number;
  active_opportunities: number;
  hackathons: number;
  internships: number;
  scholarships: number;
  last_scraped?: string;
  logo_url?: string;
}

export interface GetPlatformStatsResponse {
  platforms: PlatformStats[];
  totals: {
    opportunities: number;
    hackathons: number;
    internships: number;
    scholarships: number;
  };
}

export interface ScrapedData {
  title: string;
  description?: string;
  url: string;
  deadline?: string;
  start_date?: string;
  end_date?: string;
  duration?: string;
  mode?: string;
  tags?: string[];
  requirements?: string[];
  benefits?: string[];
  eligibility?: string;
  location?: {
    city?: string;
    country?: string;
    remote?: boolean;
  };
  prize_pool?: number;
  stipend_range?: string;
  participants_count?: number;
  rating?: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ScrapingError {
  platform: PlatformName;
  error: string;
  details?: any;
  timestamp: string;
}