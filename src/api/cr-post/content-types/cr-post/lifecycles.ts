/**
 * חדשה שנוצרה בפאנל הניהול של Strapi (בלי כותב) מאושרת כברירת מחדל; הגשות משתמשים נכנסות
 * כ-pending_moderation מה-controller. כאן רק מסמנים תאריך פרסום לחדשה מאושרת.
 */
export default {
    beforeCreate(event: { params: { data: Record<string, unknown> } }) {
        const data = event.params.data;
        if (data.moderationStatus === undefined || data.moderationStatus === 'approved') {
            if (!data.publishDate) data.publishDate = new Date().toISOString();
        }
    },
};
