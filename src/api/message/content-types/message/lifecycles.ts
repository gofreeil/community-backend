// ─────────────────────────────────────────────────────────────
// Lifecycle hooks ל-message — אוסף ההודעות המשותף של אתרי הרשת
//
// afterCreate: SMS לנייד של הנמען אם הוא מנהל/רכז וההודעה היא התראת מערכת
// (בלי sender) — ראה utils/adminSms.ts.
// אתרי הרשת (אבדות, בעלי מקצוע, גמ"ח ארצי, דירוג, חכמי העדה, ועוד) כותבים
// לכאן דרך adsNotify/adsCode: { receiver, content, read } — וכך התראה על
// בקשת פרסום שהאדמין של אותו אתר היה מגלה רק בכניסה מקרית לתיבה, מגיעה
// אליו לנייד ברגע היצירה.
//
// inbox_only: true — האתר הכותב מבקש תיבה בלבד, בלי SMS (למשל "ביקורת" שכותב
// לרכזי השכונות של העיר: הם רכזים של קהילה בשכונה, לא של האתר הזה).
//
// ה-relation לא זמין ב-event.result, ולכן שולפים את ההודעה מחדש עם receiver.
// כל כשל נבלע — יצירת ההודעה לעולם לא נופלת בגלל SMS.
// ─────────────────────────────────────────────────────────────

import { COMMUNITY_SITE_URL, extractLink, firstLine, notifyAdminBySms } from '../../../../utils/adminSms';

export default {
    async afterCreate(event: any) {
        const id = event?.result?.id;
        if (!id) return;
        if (event?.result?.inbox_only === true) return;
        try {
            const msg = (await strapi.db.query('api::message.message').findOne({
                where: { id },
                populate: ['receiver', 'sender'],
            })) as { content?: string; inbox_only?: boolean | null; receiver?: { id?: number } | null; sender?: { id?: number } | null } | null;
            if (msg?.inbox_only === true) return;
            const receiverId = msg?.receiver?.id;
            if (!receiverId) return;

            const content = String(msg?.content ?? '');
            const title = firstLine(content) || 'הודעה חדשה בתיבת הניהול';
            const link = extractLink(content, COMMUNITY_SITE_URL) ?? `${COMMUNITY_SITE_URL}/messages`;
            // הודעה עם שולח = צ'אט בין משתמשים (/api/messages בקהילה) — לא התראת ניהול
            await notifyAdminBySms({ userId: receiverId, title, link, source: 'message', hasSender: !!msg?.sender?.id });
        } catch (err) {
            strapi.log.warn(`[message] admin SMS hook failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    },
};
