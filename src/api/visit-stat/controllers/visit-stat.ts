import { factories } from '@strapi/strapi';

const UID = 'api::visit-stat.visit-stat';

// חודש נוכחי לפי שעון ישראל, בפורמט YYYY-MM (en-CA נותן YYYY-MM-DD)
function currentMonth(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).slice(0, 7);
}

export default factories.createCoreController(UID, () => ({
    // רישום כניסה אחת למונה של החודש הנוכחי (find-or-create + increment אטומי)
    async track(ctx) {
        const month = currentMonth();
        const existing = await strapi.db.query(UID).findOne({ where: { month } });
        if (existing) {
            // increment ברמת ה-DB - עמיד לבקשות מקבילות, בניגוד לקריאה+כתיבה
            await strapi.db.connection('visit_stats').where({ id: existing.id }).increment('count', 1);
        } else {
            await strapi.db.query(UID).create({ data: { month, count: 1 } });
        }
        ctx.body = { ok: true, month };
    },
}));
