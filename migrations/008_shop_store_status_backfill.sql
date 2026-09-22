-- ============================================================
-- מיגרציה 008: האישור עובר מהמוצר לחנות
--
-- עד כה כל מוצר ראשון של חנות חדשה נכנס כ-pending והמנהל אישר *מוצר*.
-- מעכשיו המנהל מאשר *חנות* אחת (shop_stores.status), וכל מוצריה עולים
-- למדף אוטומטית. השדה נוסף עם ברירת מחדל 'pending', ולכן חנויות שכבר
-- פעלו היו נחסמות - כאן מסמנים אותן כמאושרות רטרואקטיבית.
--
-- חנות ותיקה = יש לה לפחות מוצר אחד מאושר (approved) באותו מוכר.
-- ============================================================

UPDATE shop_stores s
SET status = 'approved',
    decided_at = COALESCE(s.decided_at, s.opened_at, NOW()),
    decided_by = COALESCE(s.decided_by, 'מיגרציה 008 - חנות ותיקה עם מוצר מאושר')
WHERE (s.status IS NULL OR s.status = 'pending')
  AND EXISTS (
    SELECT 1 FROM shop_seller_products p
    WHERE p.status = 'approved'
      AND (
        (p.seller_user_id IS NOT NULL AND p.seller_user_id = s.seller_user_id)
        OR LOWER(COALESCE(p.seller_email, '')) = LOWER(COALESCE(s.seller_email, ''))
      )
  );

-- מוצרים שנותרו ממתינים בחנות שאושרה עולים למדף - זה בדיוק הכלל החדש.
UPDATE shop_seller_products p
SET status = 'approved',
    decided_at = COALESCE(p.decided_at, NOW()),
    decided_by = COALESCE(p.decided_by, 'מיגרציה 008 - החנות מאושרת')
WHERE p.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM shop_stores s
    WHERE s.status = 'approved'
      AND (
        (p.seller_user_id IS NOT NULL AND p.seller_user_id = s.seller_user_id)
        OR LOWER(COALESCE(p.seller_email, '')) = LOWER(COALESCE(s.seller_email, ''))
      )
  );
