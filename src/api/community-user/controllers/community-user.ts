/**
 * community-user controller
 */

import { factories } from '@strapi/strapi';
import { phoneOtpEnabled, requestPhoneOtp, verifyPhoneOtp } from '../../../utils/phoneOtp';

/** אימות שרת-לשרת בלבד (API Token) — אותו כלל כמו issueSsoJwt: fail-closed */
function requireServerToken(ctx: any): boolean {
    const strat = ctx.state?.auth?.strategy?.name;
    return !!strat && strat !== 'users-permissions';
}

/** קוד-שגיאה של phoneOtp → סטטוס HTTP (הפרונט מתרגם את הקוד למשתמש) */
const OTP_STATUS: Record<string, number> = {
    unavailable: 503, invalid_phone: 400, too_soon: 429, too_many: 429, sms_failed: 502,
    no_code: 400, expired: 400, wrong_code: 400, blocked: 403, server: 500,
};

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

    /** האם כניסה בקוד SMS זמינה (ספק SMS מוגדר) — לאתר הקהילה, להצגת הכפתור */
    async phoneOtpStatus(ctx) {
        if (!requireServerToken(ctx)) return ctx.forbidden('server-to-server token required');
        ctx.body = { enabled: phoneOtpEnabled() };
    },

    /** שליחת קוד לנייד. גוף: { phone } */
    async phoneOtpRequest(ctx) {
        if (!requireServerToken(ctx)) return ctx.forbidden('server-to-server token required');
        const phone = String((ctx.request.body as { phone?: unknown })?.phone ?? '');
        try {
            const r = await requestPhoneOtp(phone);
            // 'in' ולא r.ok: ה-tsconfig כאן בלי strictNullChecks, ושם צמצום לפי דגל בוליאני לא עובד
            ctx.status = 'error' in r ? (OTP_STATUS[r.error] ?? 400) : 200;
            ctx.body = r;
        } catch (e) {
            strapi.log.error(`[phone-otp] request failed: ${e instanceof Error ? e.message : e}`);
            ctx.status = 500;
            ctx.body = { ok: false, error: 'server' };
        }
    },

    /** אימות קוד → JWT (ויצירת משתמש אם אין). גוף: { phone, code } */
    async phoneOtpVerify(ctx) {
        if (!requireServerToken(ctx)) return ctx.forbidden('server-to-server token required');
        const body = (ctx.request.body ?? {}) as { phone?: unknown; code?: unknown };
        try {
            const r = await verifyPhoneOtp(String(body.phone ?? ''), String(body.code ?? ''));
            ctx.status = 'error' in r ? (OTP_STATUS[r.error] ?? 400) : 200;
            ctx.body = r;
        } catch (e) {
            strapi.log.error(`[phone-otp] verify failed: ${e instanceof Error ? e.message : e}`);
            ctx.status = 500;
            ctx.body = { ok: false, error: 'server' };
        }
    },
}));
