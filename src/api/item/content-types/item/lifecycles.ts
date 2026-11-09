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

// יעד ברירת מחדל לפי סוג ההתראה (זהה ל-MSG_TYPE_LINKS באתר) — כדי שהקישור ב-SMS יוביל ישר למסך האישור
const TYPE_LINKS: Record<string, string> = {
    coordinator_request: '/admin#coord-requests',
    location_request: '/admin#pending-neighborhoods',
    neighborhood_request: '/admin#pending-neighborhoods',
    singles_review: '/admin/singles-review',
    ad_submission: '/admin/ads-review',
    wish_request: '/admin#pending-wishes',
    design_help_request: '/admin/ads-review',
    singles_access: '/admin/singles-review',
    matchmaker_request: '/admin/singles-review',
    quiz_suggestion: '/admin/quiz-suggestions',
};

const INBOX_CATEGORIES = new Set(['message', 'admin_alert']);

export default {
    async afterCreate(event: any) {
        const r = event?.result as
            | { category?: string; user_id?: string | null; label?: string; description?: string; icon?: string; extra_fields?: unknown }
            | undefined;
        if (!r || !INBOX_CATEGORIES.has(String(r.category ?? ''))) return;
        const uid = String(r.user_id ?? '').trim();
        if (!uid) return;
        try {
            const label = oneLine(r.label ?? '') || 'התראת ניהול חדשה';
            const title = `קהילה בשכונה · ${label}`;
            let ef: { type?: unknown; link?: unknown; review_link?: unknown } | null = null;
            const rawEf = r.extra_fields;
            if (rawEf && typeof rawEf === 'object') ef = rawEf as typeof ef;
            else if (typeof rawEf === 'string') { try { ef = JSON.parse(rawEf); } catch { ef = null; } }
            const efType = ef && typeof ef.type === 'string' ? ef.type : null;
            const explicit = [ef?.link, ef?.review_link].find((l): l is string => typeof l === 'string' && l.startsWith('/'));
            const path = explicit ?? (efType ? TYPE_LINKS[efType] : undefined);
            const link = path
                ? `${COMMUNITY_SITE_URL}${path}`
                : (extractLink(r.description ?? '', COMMUNITY_SITE_URL) ?? `${COMMUNITY_SITE_URL}/messages`);
            await notifyAdminBySms({ externalId: uid, title, link, source: 'item', category: r.category, efType });
        } catch (err) {
            strapi.log.warn(`[item] admin SMS hook failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    },
};
