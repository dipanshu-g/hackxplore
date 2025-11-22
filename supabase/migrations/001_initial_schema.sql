-- Database Schema for HackXplore Backend API
-- Create enums first

CREATE TYPE opportunity_type AS ENUM ('hackathon', 'internship', 'scholarship');
CREATE TYPE platform_name AS ENUM ('devfolio', 'unstop', 'dorahacks', 'hack2skill', 'devpost', 'internshala');
CREATE TYPE scraping_status AS ENUM ('running', 'completed', 'failed', 'partial');

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create platforms table
CREATE TABLE platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name platform_name UNIQUE NOT NULL,
    base_url TEXT NOT NULL,
    logo_url TEXT,
    scraping_config JSONB,
    is_active BOOLEAN DEFAULT true,
    last_scraped TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create opportunities table
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    type opportunity_type NOT NULL,
    platform platform_name NOT NULL,
    url TEXT UNIQUE NOT NULL,
    deadline TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    duration TEXT,
    mode TEXT,
    tags JSONB,
    requirements JSONB,
    benefits JSONB,
    eligibility TEXT,
    location JSONB,
    prize_pool BIGINT,
    stipend_range TEXT,
    participants_count INTEGER,
    rating DECIMAL(3,2),
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (platform) REFERENCES platforms(name) ON DELETE CASCADE
);

-- Create scraping_logs table
CREATE TABLE scraping_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID NOT NULL,
    status scraping_status DEFAULT 'running',
    items_scraped INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
);

-- Create indexes for better performance
-- Indexes on opportunities table
CREATE INDEX idx_opportunities_type_active ON opportunities (type, is_active) WHERE is_active = true;
CREATE INDEX idx_opportunities_deadline ON opportunities (deadline) WHERE deadline > NOW();
CREATE INDEX idx_opportunities_platform ON opportunities (platform);
CREATE INDEX idx_opportunities_featured ON opportunities (is_featured) WHERE is_active = true;
CREATE INDEX idx_opportunities_url ON opportunities (url);
CREATE INDEX idx_opportunities_tags ON opportunities USING GIN (tags);
CREATE INDEX idx_opportunities_composite ON opportunities (type, deadline, is_featured) WHERE is_active = true;

-- Indexes on platforms table
CREATE INDEX idx_platforms_active ON platforms (is_active) WHERE is_active = true;
CREATE INDEX idx_platforms_name ON platforms (name);

-- Indexes on scraping_logs table
CREATE INDEX idx_scraping_logs_platform ON scraping_logs (platform_id);
CREATE INDEX idx_scraping_logs_status ON scraping_logs (status);
CREATE INDEX idx_scraping_logs_started ON scraping_logs (started_at);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function for normalized text search
CREATE OR REPLACE FUNCTION normalize_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(trim(regexp_replace(input_text, E'\\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function for extracting domain from URL
CREATE OR REPLACE FUNCTION extract_domain(url_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN regexp_replace(url_text, '^https?://([^/]+).*', E'\\1');
END;
$$ LANGUAGE plpgsql IMMUTABLE;