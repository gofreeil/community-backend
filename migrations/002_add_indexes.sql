-- Migration 002: Add indexes for performance

CREATE INDEX IF NOT EXISTS idx_community_users_external_id
    ON community_users (external_id);

CREATE INDEX IF NOT EXISTS idx_community_users_email
    ON community_users (email);

CREATE INDEX IF NOT EXISTS idx_items_user_id
    ON items (user_id);

CREATE INDEX IF NOT EXISTS idx_items_city
    ON items (city);

CREATE INDEX IF NOT EXISTS idx_items_neighborhood
    ON items (neighborhood);

CREATE INDEX IF NOT EXISTS idx_items_category
    ON items (category);

CREATE INDEX IF NOT EXISTS idx_items_status
    ON items (status1);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
    ON profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_news_ticker_items_active
    ON news_ticker_items (active);

CREATE INDEX IF NOT EXISTS idx_lost_found_requests_status
    ON lost_found_requests (item7_status);
