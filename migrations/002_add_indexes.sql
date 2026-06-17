-- Migration 002: Add indexes for performance
-- עטופים ב-DO blocks כדי לדלג בשקט אם הטבלה/עמודה לא קיימת
-- (Strapi מנהל את הסכמה דינמית - עמודות לפעמים שונות בשם מהמיגרציה הראשונית)

DO $$
DECLARE
    idx record;
BEGIN
    FOR idx IN
        SELECT * FROM (VALUES
            ('idx_community_users_external_id', 'community_users', 'external_id'),
            ('idx_community_users_email',       'community_users', 'email'),
            ('idx_items_user_id',               'items',           'user_id'),
            ('idx_items_city',                  'items',           'city'),
            ('idx_items_neighborhood',          'items',           'neighborhood'),
            ('idx_items_category',              'items',           'category'),
            ('idx_items_status',                'items',           'status1'),
            ('idx_profiles_user_id',            'profiles',        'user_id'),
            ('idx_news_ticker_items_active',    'news_ticker_items','active'),
            ('idx_lost_found_requests_status',  'lost_found_requests','item7_status')
        ) AS t(index_name, table_name, column_name)
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = idx.table_name AND column_name = idx.column_name
        ) THEN
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (%I)',
                idx.index_name, idx.table_name, idx.column_name);
        ELSE
            RAISE NOTICE 'דילוג על אינדקס %: עמודה %.% לא קיימת',
                idx.index_name, idx.table_name, idx.column_name;
        END IF;
    END LOOP;
END $$;
