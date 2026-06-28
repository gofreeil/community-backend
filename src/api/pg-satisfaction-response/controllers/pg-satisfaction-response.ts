import { factories } from '@strapi/strapi';

// Override: רק super_admin רשאי לעדכן/למחוק תגובות (פין, לייק, תשובת אדמין, מחיקה).
// יוזרים אנונימיים יכולים ליצור (.create) ולקרוא (.find/findOne) דרך הרשאות ה-public ב-bootstrap.
export default factories.createCoreController(
    'api::pg-satisfaction-response.pg-satisfaction-response',
    ({ strapi }) => ({
        async delete(ctx) {
            const user = ctx.state?.user;
            if (!user || user.app_role !== 'super_admin') {
                return ctx.forbidden('רק super_admin רשאי למחוק תגובות');
            }
            return super.delete(ctx);
        },
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

        // לייק ציבורי — כל משתמש מחובר יכול לסמן/לבטל לייק על תגובה (toggle).
        // ההרשאה מוגבלת ל-role authenticated (מחובר); הזיהוי לפי user.id.
        async toggleLike(ctx) {
            const user = ctx.state?.user;
            if (!user) return ctx.unauthorized('נדרשת התחברות');
            const { documentId } = ctx.params;
            const uid = 'api::pg-satisfaction-response.pg-satisfaction-response' as const;
            const entry = await strapi.documents(uid).findOne({ documentId });
            if (!entry) return ctx.notFound();

            const key = String(user.id);
            const likedBy: string[] = Array.isArray((entry as any).liked_by)
                ? (entry as any).liked_by.map(String)
                : [];
            const i = likedBy.indexOf(key);
            let liked: boolean;
            if (i >= 0) { likedBy.splice(i, 1); liked = false; }
            else { likedBy.push(key); liked = true; }

            await strapi.documents(uid).update({
                documentId,
                data: { liked_by: likedBy, likes: likedBy.length } as any,
            });
            ctx.body = { likes: likedBy.length, liked };
        },

        // תגובה ציבורית לתגובה — כל משתמש מחובר יכול להוסיף; נשמרות כמערך JSON.
        async addReply(ctx) {
            const user = ctx.state?.user;
            if (!user) return ctx.unauthorized('נדרשת התחברות');
            const { documentId } = ctx.params;
            const body = (ctx.request.body?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
            const text = String(body.text ?? '').trim();
            if (!text) return ctx.badRequest('text required');

            const uid = 'api::pg-satisfaction-response.pg-satisfaction-response' as const;
            const entry = await strapi.documents(uid).findOne({ documentId });
            if (!entry) return ctx.notFound();

            const replies: any[] = Array.isArray((entry as any).replies) ? (entry as any).replies : [];
            const reply = {
                text: text.slice(0, 2000),
                user_id: String(user.id),
                user_name: String(body.user_name ?? user.name ?? user.username ?? '').slice(0, 80),
                user_city: String(body.user_city ?? '').slice(0, 80),
                is_admin: user.app_role === 'super_admin',
                created_at: new Date().toISOString(),
            };
            replies.push(reply);

            await strapi.documents(uid).update({
                documentId,
                data: { replies } as any,
            });
            ctx.body = { replies };
        },
    }),
);
