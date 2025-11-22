-- Row Level Security (RLS) Policies for HackXplore
-- Enable RLS on all tables

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for opportunities (only active ones)
CREATE POLICY "Public read access for active opportunities" ON opportunities
    FOR SELECT USING (is_active = true);

-- Admin access for all operations on opportunities
CREATE POLICY "Admin full access to opportunities" ON opportunities
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Public read access for platforms (only active ones)
CREATE POLICY "Public read access for active platforms" ON platforms
    FOR SELECT USING (is_active = true);

-- Admin access for all operations on platforms
CREATE POLICY "Admin full access to platforms" ON platforms
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Admin access for scraping_logs (sensitive data)
CREATE POLICY "Admin full access to scraping logs" ON scraping_logs
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() ->> 'role' = 'service_role'
    );

-- No public access to scraping_logs (sensitive operational data)

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() ->> 'role' = 'service_role'
    );
END;
$$ SECURITY DEFINER;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(auth.jwt() ->> 'role', 'anonymous');
END;
$$ SECURITY DEFINER;