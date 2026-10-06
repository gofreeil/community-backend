/**
 * מספר פנייה רץ (numid) — מוצג למשתמשים ומשמש בהתכתבות עם הנציגים.
 * נקבע בצד השרת בכל יצירה, גם דרך GraphQL.
 */
declare const strapi: any;

export default {
    async beforeCreate(event: { params: { data: Record<string, unknown> } }) {
        const data = event.params.data;
        if (typeof data.numid === 'number') return;
        const [last] = await strapi.db.query('api::inquiry.inquiry').findMany({
            select: ['numid'],
            orderBy: { numid: 'desc' },
            limit: 1,
        });
        data.numid = (last?.numid ?? 0) + 1;
    },
};
