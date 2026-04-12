-- ============================================================
-- מיגרציה 003: העתקת נתוני פרופיל מ-community_users ל-up_users
-- רץ פעם אחת בלבד (מנוהל ע"י _custom_migrations)
-- ============================================================

UPDATE up_users u
SET
    external_id       = cu.external_id,
    city              = COALESCE(NULLIF(cu.city, ''),              u.city),
    neighborhood      = COALESCE(NULLIF(cu.neighborhood, ''),      u.neighborhood),
    phone             = COALESCE(NULLIF(cu.phone, ''),             u.phone),
    nickname          = COALESCE(NULLIF(cu.name, ''),              u.nickname),
    business          = COALESCE(NULLIF(cu.business, ''),          u.business),
    family_status     = COALESCE(NULLIF(cu.family_status, ''),     u.family_status),
    gender            = COALESCE(NULLIF(cu.gender, ''),            u.gender),
    birth_date        = COALESCE(NULLIF(cu.birth_date, ''),        u.birth_date),
    avatar_url        = COALESCE(NULLIF(cu.avatar_url, ''),        u.avatar_url),
    balance           = COALESCE(cu.balance::integer,              u.balance),
    notifications     = COALESCE(cu.notifications,                 u.notifications),
    app_role          = COALESCE(NULLIF(cu.role::text, 'user'),    u.app_role),
    blocked           = COALESCE(cu.banned,                        u.blocked)
FROM community_users cu
WHERE
    -- התאמה לפי אימייל
    LOWER(u.email) = LOWER(cu.email)
    -- רק אם לא כבר הועתקו (external_id ריק)
    AND (u.external_id IS NULL OR u.external_id = '');
