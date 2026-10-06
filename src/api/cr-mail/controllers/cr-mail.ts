import { isTrusted } from '../../../utils/crAccess';

declare const strapi: any;

// מיילים של "מבקר רשויות המדינה" (פנייה חדשה למודרטור, אישור/דחייה לפונה, בקשת מענה לנציג, מענה
// לפונה ולתומכים). האתר לא מחזיק סיסמת מייל משלו: המייל יוצא מכאן, מאותו ספק (Resend) ומאותו
// כתובת שולח (noreply@gofreeil.com) כמו שאר האתרים. הקריאה רק משרת האתר עם API Token.
const MAX_PER_HOUR = Number(process.env.CR_MAIL_MAX_PER_HOUR || 200);
const REPLY_TO = process.env.CR_MAIL_REPLY_TO || 'freedomhasbegun@gmail.com';
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

// זיכרון-תהליך בלבד: רשת ביטחון נגד לולאה/שימוש לרעה בטוקן, לא חשבונאות
let windowStart = Date.now();
let sent = 0;

export default {
    async send(ctx: any) {
        if (!isTrusted(ctx)) return ctx.forbidden('רק שרת האתר רשאי לשלוח מיילים');

        const b = (ctx.request.body ?? {}) as Record<string, unknown>;
        const to = typeof b.to === 'string' ? b.to.trim() : '';
        const subject = typeof b.subject === 'string' ? b.subject.trim().slice(0, 200) : '';
        const html = typeof b.html === 'string' ? b.html : '';
        const text = typeof b.text === 'string' ? b.text : undefined;
        if (!EMAIL_RE.test(to) || to.length > 254) return ctx.badRequest('כתובת נמען לא תקינה');
        if (!subject) return ctx.badRequest('חסר נושא');
        if (!html || html.length > 300_000) return ctx.badRequest('תוכן המייל חסר או גדול מדי');

        const now = Date.now();
        if (now - windowStart > 3_600_000) {
            windowStart = now;
            sent = 0;
        }
        if (sent >= MAX_PER_HOUR) return ctx.tooManyRequests('חריגה ממכסת המיילים לשעה');
        sent++;

        try {
            await strapi.plugin('email').service('email').send({ to, subject, html, text, replyTo: REPLY_TO });
            return { ok: true };
        } catch (e: any) {
            strapi.log.warn('[cr-mail] שליחה נכשלה: ' + (e?.message ?? e));
            return ctx.internalServerError('שליחת המייל נכשלה');
        }
    },
};
