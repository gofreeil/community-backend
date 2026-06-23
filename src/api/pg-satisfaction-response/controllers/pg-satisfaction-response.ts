import { factories } from '@strapi/strapi';

// Override: רק super_admin רשאי לעדכן תגובות (פין, לייק, תשובת אדמין).
// יוזרים אנונימיים יכולים ליצור (.create) ולקרוא (.find/findOne) דרך הרשאות ה-public ב-bootstrap.
export default factories.createCoreController(
    'api::pg-satisfaction-response.pg-satisfaction-response',
    ({ strapi }) => ({
        async update(ctx) {
            const user = ctx.state?.user;
            if (!user || user.app_role !== 'super_admin') {
                return ctx.forbidden('רק super_admin רשאי לעדכן תגובות');
            }
            // לאדמין מאפשרים רק את שלושת השדות הללו — לא להחליף את הטקסט המקורי של המשתמש.
            const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
            const allowed: { is_featured?: boolean; admin_liked?: boolean; admin_reply?: string | null } = {};
            if ('is_featured' in body) allowed.is_featured = !!body.is_featured;
            if ('admin_liked' in body) allowed.admin_liked = !!body.admin_liked;
            if ('admin_reply' in body) allowed.admin_reply = body.admin_reply == null ? null : String(body.admin_reply);
            ctx.request.body = { data: allowed };
            return super.update(ctx);
        },
    }),
);
