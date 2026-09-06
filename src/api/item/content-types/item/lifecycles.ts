// ─────────────────────────────────────────────────────────────
// Lifecycle hooks ל-item — האוסף המשותף של "קהילה בשכונה" ואתרי הפריטים
//
// afterCreate: item מסוג הודעה/התראה (category 'message' או 'admin_alert')
// הוא רשומה בתיבת ההודעות של user_id. כשהנמען הוא מנהל — SMS לנייד שלו
// (ראה utils/adminSms.ts). ככה כל התראת ניהול של הקהילה — בקשת פרסום, בקשת
// רכז, תקלה שהפילה עמוד, בקשת שכונה, קריאה לשדכן, משאלה חדשה... — מגיעה
// לנייד ברגע היצירה, בלי לגעת בעשרים נקודות היצירה בצד האתר.
//
// הודעות לגולשים רגילים (אישור פרסומת, השלמת פרופיל) עוברות כאן גם, אבל
// נופלות בבדיקת התפקיד ב-notifyAdminBySms — לא נשלח SMS למי שאינו מנהל.
// כל כשל נבלע — יצירת הפריט לעולם לא נופלת בגלל SMS.
// ─────────────────────────────────────────────────────────────

import { COMMUNITY_SITE_URL, extractLink, notifyAdminBySms, oneLine } from '../../../../utils/adminSms';

const INBOX_CATEGORIES = new Set(['message', 'admin_alert']);

export default {
    async afterCreate(event: any) {
        const r = event?.result as
            | { category?: string; user_id?: string | null; label?: string; description?: string; icon?: string }
            | undefined;
        if (!r || !INBOX_CATEGORIES.has(String(r.category ?? ''))) return;
        const uid = String(r.user_id ?? '').trim();
        if (!uid) return;
        try {
            const label = oneLine(r.label ?? '') || 'התראת ניהול חדשה';
            const title = `קהילה בשכונה · ${label}`;
            const link = extractLink(r.description ?? '', COMMUNITY_SITE_URL) ?? `${COMMUNITY_SITE_URL}/messages`;
            await notifyAdminBySms({ externalId: uid, title, link, source: 'item' });
        } catch (err) {
            strapi.log.warn(`[item] admin SMS hook failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    },
};
