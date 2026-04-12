-- ============================================================
-- מיגרציה 005: תיקון external_id — מגדיר credentials_<email>
-- לכל משתמש שה-external_id שלו הוא מספר (מ-community_users)
-- ============================================================

UPDATE up_users
SET external_id = 'credentials_' || LOWER(email)
WHERE
    email IS NOT NULL
    AND external_id IS NOT NULL
    AND external_id ~ '^[0-9]+$';
