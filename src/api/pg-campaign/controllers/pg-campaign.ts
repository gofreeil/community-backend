import { factories } from '@strapi/strapi';

// קמפיין רכישות קבוצתיות. הקריאה ציבורית; הכתיבה שמורה לצוות האתר.
//
// הרשומות כאן אינן מקור האמת של התוכן: מקור האמת הוא campaigns.js בפרונט,
// והרשומה מחזיקה רק את השדות שאדמין ערך בפאנל (edited_fields). כך נפילה של
// Strapi לא מעלימה תוכן מהאתר — זו הסיבה שהתוכן הועבר לקוד מלכתחילה.
//
// ההרשאה עצמה ניתנת ב-src/index.ts (create/update ל-role authenticated),
// והסינון מי באמת מורשה נעשה כאן — אותו דפוס כמו pg-satisfaction-response.

// בעלי האתר — מנהלים גם בלי app_role בבאקאנד (רשת ביטחון, כמו ב-idx-*/ch-*)
const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);

function isPgAdmin(user: any): boolean {
    if (!user) return false;
    const email = String(user.email ?? '').trim().toLowerCase();
    if (SUPER_ADMIN_EMAILS.has(email)) return true;
    return ['super_admin', 'neighborhood_admin'].includes(user.app_role);
}

const UID = 'api::pg-campaign.pg-campaign' as const;

/**
 * ל-collection הזה יש draftAndPublish, ובStrapi 5 כתיבה דרך ה-REST נוגעת
 * בטיוטה בלבד — בעוד שקריאה ציבורית מחזירה רק פרסומים. בלי הפרסום הזה
 * עריכה בפאנל הייתה "נשמרת" ולעולם לא מופיעה באתר.
 */
async function publishAfterWrite(strapi: any, documentId?: string) {
    if (!documentId) return;
    try {
        await strapi.documents(UID).publish({ documentId });
    } catch (err) {
        strapi.log.error(`pg-campaign: publish failed for ${documentId}`, err);
    }
}

export default factories.createCoreController(UID, ({ strapi }) => ({
    async create(ctx) {
        if (!isPgAdmin(ctx.state?.user)) {
            return ctx.forbidden('רק צוות האתר רשאי לערוך תוכן עסקאות');
        }
        const response = await super.create(ctx);
        await publishAfterWrite(strapi, (response as any)?.data?.documentId);
        return response;
    },

    async update(ctx) {
        if (!isPgAdmin(ctx.state?.user)) {
            return ctx.forbidden('רק צוות האתר רשאי לערוך תוכן עסקאות');
        }
        const response = await super.update(ctx);
        await publishAfterWrite(strapi, (response as any)?.data?.documentId ?? ctx.params?.id);
        return response;
    },

    async delete(ctx) {
        // אין מסך שמוחק קמפיין — "אפס לתוכן שבקוד" בפאנל מרוקן את
        // edited_fields דרך update. חוסמים כדי שלא תישאר דלת פתוחה.
        return ctx.forbidden('מחיקת קמפיין אינה נתמכת דרך ה-API');
    },
}));
