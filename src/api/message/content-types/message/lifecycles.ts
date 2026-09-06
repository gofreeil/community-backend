// ─────────────────────────────────────────────────────────────
// Lifecycle hooks ל-message — אוסף ההודעות המשותף של אתרי הרשת
//
// afterCreate: SMS לנייד של הנמען אם הוא מנהל (ראה utils/adminSms.ts).
// אתרי הרשת (אבדות, בעלי מקצוע, גמ"ח ארצי, דירוג, חכמי העדה, ועוד) כותבים
// לכאן דרך adsNotify/adsCode: { receiver, content, read } — וכך התראה על
// בקשת פרסום שהאדמין של אותו אתר היה מגלה רק בכניסה מקרית לתיבה, מגיעה
// אליו לנייד ברגע היצירה.
//
// ה-relation לא זמין ב-event.result, ולכן שולפים את ההודעה מחדש עם receiver.
// כל כשל נבלע — יצירת ההודעה לעולם לא נופלת בגלל SMS.
// ─────────────────────────────────────────────────────────────

import { COMMUNITY_SITE_URL, extractLink, firstLine, notifyAdminBySms } from '../../../../utils/adminSms';

export default {
    async afterCreate(event: any) {
        const id = event?.result?.id;
        if (!id) return;
        try {
            const msg = (await strapi.db.query('api::message.message').findOne({
                where: { id },
                populate: ['receiver'],
            })) as { content?: string; receiver?: { id?: number } | null } | null;
            const receiverId = msg?.receiver?.id;
            if (!receiverId) return;

            const content = String(msg?.content ?? '');
            const title = firstLine(content) || 'הודעה חדשה בתיבת הניהול';
            const link = extractLink(content, COMMUNITY_SITE_URL) ?? `${COMMUNITY_SITE_URL}/messages`;
            await notifyAdminBySms({ userId: receiverId, title, link, source: 'message' });
        } catch (err) {
            strapi.log.warn(`[message] admin SMS hook failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    },
};
