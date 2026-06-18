-- ============================================================
-- מיגרציה 007: רענון סופר-אדמין ראשי
-- 006 רצה לפני שהמשתמש התחבר לראשונה (UPDATE on 0 rows).
-- כאן רצים שוב אחרי שהחשבון נוצר.
-- ============================================================

UPDATE up_users
SET app_role = 'super_admin'
WHERE LOWER(email) = LOWER('yahavanter@gmail.com')
  AND (app_role IS NULL OR app_role != 'super_admin');
