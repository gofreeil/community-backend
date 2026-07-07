/**
 * community-user controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::community-user.community-user', () => ({
    /**
     * מנפיק JWT של users-permissions למשתמש קיים, לפי אימייל.
     *
     * מוגן בשתי שכבות:
     *   1. שכבת ההרשאות של Strapi — נתיב POST מותאם נגיש רק ל-API Token מסוג
     *      Full Access (read-only מוגבל ל-find/findOne, ולכן ייחסם 403 לפני שנגיע לכאן).
     *   2. בדיקה מפורשת כאן — חייב אימות דרך api-token (לא ציבורי), ואם ידוע הסוג —
     *      חייב full-access. הגנה מפני תצורה שגויה שתחשוף את הנתיב לציבור.
     *
     * מחזיר { jwt } — טוקן חתום זהה לזה שמתקבל מ-/api/auth/local, תקף לכל אתרי gofreeil.
     */
    async issueSsoJwt(ctx) {
        // אבטחה: הנתיב נגיש רק לאימות שרת-לשרת (API Token). שכבת ההרשאות של Strapi
        // כבר חוסמת ציבורי (401) ו-read-only (403 על POST מותאם); כאן חוסמים במפורש
        // גם משתמש-קצה מחובר (users-permissions) וכל מי שאינו מאומת — fail-closed,
        // בלי תלות באיות המדויק של שם אסטרטגיית ה-API token.
        const auth: any = ctx.state?.auth;
        const strat = auth?.strategy?.name;
        if (!strat || strat === 'users-permissions') {
            return ctx.forbidden('server-to-server token required');
        }

        const raw = (ctx.request.body as { email?: unknown })?.email;
        const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (!email) return ctx.badRequest('email required');

        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { email: { $eqi: email } },
        });
        if (!user) return ctx.notFound('user not found');
        if (user.blocked) return ctx.forbidden('user blocked');

        const jwt = strapi
            .plugin('users-permissions')
            .service('jwt')
            .issue({ id: user.id });

        ctx.body = { jwt, userId: user.id };
    },
}));
