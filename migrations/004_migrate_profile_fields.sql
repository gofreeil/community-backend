-- ============================================================
-- מיגרציה 004: העתקת שדות פרופיל מ-community_users ל-up_users
-- מעדכן גם משתמשים שכבר יש להם external_id
-- ============================================================

UPDATE up_users u
SET
    external_id       = COALESCE(NULLIF(cu.external_id, ''),       u.external_id),
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
WHERE LOWER(u.email) = LOWER(cu.email);
