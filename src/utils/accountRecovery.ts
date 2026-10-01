// ============================================================
// accountRecovery.ts — שחזור גישה לחשבון, אחיד לכל אתרי gofreeil
//
// למה כאן ולא באתרים: כל האתרים יושבים על אותם משתמשים, וה-forgotPassword של
// Strapi שולח קישור לכתובת *אחת* (email_reset_password) — כלומר משתמש שביקש
// שחזור באתר הרכישות הקבוצתיות היה נוחת בקהילה. כאן הקישור חוזר לאתר שממנו
// ביקשו (resetUrl), והמייל עצמו חכם ויפה.
//
// התנהגות:
//   • בלי resetUrl — ההתנהגות המקורית של Strapi (תאימות לאתר הקהילה הקיים).
//   • עם resetUrl — מותר רק origin תחת gofreeil.com (או localhost/הדומיינים
//     הרשומים) ורק הנתיב /reset-password. אחרת תוקף היה יכול לבקש שחזור על
//     חשבון של קורבן עם resetUrl לאתר שלו ולקבל את הטוקן.
//   • תשובה זהה (ok:true) גם כשהאימייל לא קיים — אין דליפת "מי רשום".
//   • משתמש שנרשם דרך Google/Facebook (אין לו סיסמה) מקבל במייל הסבר שאפשר
//     פשוט להיכנס עם הספק — וגם קישור לקביעת סיסמה. קביעת סיסמה הופכת אותו
//     ל-provider=local, כי Strapi מאפשר /auth/local רק ל-local. כניסה עם
//     Google ממשיכה לעבוד (connect ב-strapi-server.ts מחבר לפי אימייל).
//   • הטוקן פג אחרי RESET_TTL_MS (בקידומת של הטוקן עצמו — בלי שינוי סכמה).
//   • קירור: לא שולחים לאותו אימייל יותר מפעם ב-COOLDOWN_MS (מונע הצפת תיבה
//     של קורבן ולחיצות כפולות).
// ============================================================

import crypto from 'node:crypto';

declare const strapi: any;

const RESET_TTL_MS = 2 * 60 * 60 * 1000; // שעתיים
const COOLDOWN_MS = 45 * 1000;
const USER_UID = 'plugin::users-permissions.user';

// זיכרון-תהליך בלבד (שני מופעי Strapi מאחורי ה-nginx) — רשת ביטחון, לא חשבונאות.
const lastSentByEmail = new Map<string, number>();

/** שם האתר כפי שמופיע במייל, לפי הדומיין. לא מגיע מהלקוח — כדי שאי אפשר יהיה להזריק טקסט. */
const SITE_NAMES: Record<string, string> = {
    'gofreeil.com': 'יוצאים לחירות',
    'www.gofreeil.com': 'יוצאים לחירות',
    'community.gofreeil.com': 'קהילה בשכונה',
    'community-il.gofreeil.com': 'קהילה בשכונה',
    'groups.gofreeil.com': 'רכישות קבוצתיות',
    'chachmim.gofreeil.com': 'חכמי העדה',
    'chachmei-haeda.gofreeil.com': 'חכמי העדה',
    'avedot.gofreeil.com': 'פינת האבדות',
    'criticism.gofreeil.com': 'מבקר רשויות המדינה',
    'rating.gofreeil.com': 'דירוג ציבורי',
    'referendum.gofreeil.com': 'משאלי העם',
    'neighborhoods.gofreeil.com': 'ועדי שכונות',
    'index.gofreeil.com': 'בעלי מקצוע כשירים',
    'gemach.gofreeil.com': 'הגמ"ח הארצי',
    'experts.gofreeil.com': 'כוורת המומחים',
    'shop.gofreeil.com': 'חנות החירות',
    'investors.gofreeil.com': 'קבוצת המשקיעים',
    'investments.gofreeil.com': 'קבוצת המשקיעים',
};

const OTHER_ALLOWED_ORIGINS = new Set([
    'https://purchasing-groups.vercel.app',
    'https://community-il.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5191',
]);

const GOFREEIL_HOST = /^([a-z0-9-]+\.)*gofreeil\.com$/;

/** מחזיר {origin, host} אם ה-resetUrl חוקי: מקור מותר + נתיב /reset-password בלבד. */
export function parseResetUrl(raw: unknown): { origin: string; host: string } | null {
    if (typeof raw !== 'string' || raw.length > 300) return null;
    let u: URL;
    try {
        u = new URL(raw);
    } catch {
        return null;
    }
    if (u.username || u.password) return null;
    if (u.pathname.replace(/\/+$/, '') !== '/reset-password') return null;
    const okOrigin =
        (u.protocol === 'https:' && GOFREEIL_HOST.test(u.hostname) && !u.port) ||
        OTHER_ALLOWED_ORIGINS.has(u.origin);
    if (!okOrigin) return null;
    return { origin: u.origin, host: u.hostname };
}

export function siteNameFor(host: string): string {
    return SITE_NAMES[host] ?? 'יוצאים לחירות';
}

/** טוקן עם חותמת זמן בקידומת: <base36 ms>.<hex> */
export function newResetToken(now = Date.now()): string {
    return `${now.toString(36)}.${crypto.randomBytes(48).toString('hex')}`;
}

/** טוקן בפורמט החדש שפג תוקפו. טוקן ישן (בלי קידומת) — לא נחשב פג, תאימות לאחור. */
export function isResetTokenExpired(code: string, now = Date.now()): boolean {
    const m = /^([0-9a-z]{6,12})\.[0-9a-f]{64,}$/.exec(code);
    if (!m) return false;
    const issued = parseInt(m[1], 36);
    return !Number.isFinite(issued) || now - issued > RESET_TTL_MS;
}

const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', facebook: 'Facebook' };

export function buildResetEmail(opts: {
    siteName: string;
    link: string;
    provider?: string | null;
    name?: string | null;
}) {
    const { siteName, link } = opts;
    const social = opts.provider && opts.provider !== 'local' ? PROVIDER_LABEL[opts.provider] : '';
    const hours = RESET_TTL_MS / 3_600_000;
    const hello = opts.name ? `שלום ${esc(opts.name)},` : 'שלום,';

    const socialBlock = social
        ? `<tr><td style="padding:0 32px 8px">
             <div style="background:#eef6ff;border:1px solid #bcd7f7;border-radius:12px;padding:14px 16px;font-size:15px;line-height:1.7;color:#1e3a5f">
               💡 <strong>החשבון שלך נוצר דרך ${social}</strong> — אין לו סיסמה, ואין צורך בה.
               אפשר פשוט להיכנס לאתר ולהקליק על <strong>״התחבר עם ${social}״</strong>.<br>
               אם בכל זאת נוח לך להתחבר גם עם אימייל וסיסמה, אפשר לקבוע אחת בכפתור שלמטה.
             </div>
           </td></tr>`
        : '';

    const html = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>שחזור גישה לחשבון</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,'Segoe UI',Helvetica,sans-serif;direction:rtl">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08)">
    <tr><td style="background:linear-gradient(135deg,#0f172a,#1e1b4b);padding:26px 32px;text-align:right">
      <div style="font-size:13px;color:#a5b4fc;letter-spacing:.5px">יוצאים לחירות</div>
      <div style="font-size:24px;font-weight:700;color:#facc15;margin-top:4px">${esc(siteName)}</div>
    </td></tr>
    <tr><td style="padding:30px 32px 6px;text-align:right">
      <div style="font-size:42px;line-height:1">🔑</div>
      <h1 style="margin:12px 0 8px;font-size:22px;color:#0f172a">שחזור גישה לחשבון</h1>
      <p style="margin:0;font-size:16px;line-height:1.7;color:#334155">${hello}<br>קיבלנו בקשה לשחזר את הגישה לחשבון שלך ב${esc(siteName)}. לחץ על הכפתור, בחר סיסמה חדשה — ותהיה מחובר מיד.</p>
    </td></tr>
    ${socialBlock}
    <tr><td align="center" style="padding:22px 32px 8px">
      <a href="${esc(link)}" style="display:inline-block;background:#facc15;color:#1f2937;font-weight:700;font-size:18px;text-decoration:none;padding:15px 38px;border-radius:12px">בחירת סיסמה חדשה</a>
    </td></tr>
    <tr><td style="padding:6px 32px 4px;text-align:center;font-size:13px;color:#64748b">הקישור תקף ל-${hours} שעות ולשימוש חד-פעמי.</td></tr>
    <tr><td style="padding:18px 32px 6px;text-align:right;font-size:14px;line-height:1.7;color:#475569">
      <strong>לא ביקשת שחזור?</strong> אפשר להתעלם מהמייל בביטחה — שום דבר לא השתנה, והסיסמה הנוכחית שלך ממשיכה לעבוד.
    </td></tr>
    <tr><td style="padding:14px 32px 28px;text-align:right;font-size:12px;line-height:1.6;color:#94a3b8">
      הכפתור לא עובד? העתק את הכתובת לדפדפן:<br>
      <span style="word-break:break-all;direction:ltr;unicode-bidi:embed;color:#64748b">${esc(link)}</span>
    </td></tr>
  </table>
  <div style="max-width:560px;margin:14px auto 0;font-size:12px;color:#94a3b8;text-align:center">נשלח אוטומטית מרשת האתרים של יוצאים לחירות · gofreeil.com</div>
</td></tr></table>
</body></html>`;

    const text =
        `${hello}\n\nקיבלנו בקשה לשחזר את הגישה לחשבון שלך ב${siteName}.\n` +
        (social
            ? `\nהחשבון שלך נוצר דרך ${social} - אין לו סיסמה ואין צורך בה: אפשר פשוט ללחוץ באתר על "התחבר עם ${social}".\n` +
              `אם בכל זאת רוצה גם סיסמה, אפשר לקבוע אחת בקישור:\n`
            : `\nלבחירת סיסמה חדשה:\n`) +
        `${link}\n\nהקישור תקף ל-${hours} שעות ולשימוש חד-פעמי.\n` +
        `לא ביקשת שחזור? אפשר להתעלם מהמייל - הסיסמה הנוכחית ממשיכה לעבוד.`;

    return { subject: `שחזור גישה לחשבון - ${siteName}`, html, text };
}

/** מתקין את ה-wrappers על controllers.auth של users-permissions. */
export function installAccountRecovery(plugin: any) {
    const originalForgot = plugin.controllers.auth.forgotPassword;
    const originalReset = plugin.controllers.auth.resetPassword;

    plugin.controllers.auth.forgotPassword = async (ctx: any) => {
        const body = ctx.request?.body ?? {};
        // בלי resetUrl → התנהגות Strapi המקורית, בדיוק כמו קודם.
        if (body.resetUrl === undefined) return originalForgot(ctx);

        const target = parseResetUrl(body.resetUrl);
        if (!target) return ctx.badRequest('resetUrl לא חוקי');

        const email = String(body.email ?? '').trim().toLowerCase();
        if (!email || !email.includes('@') || email.length > 254) return ctx.badRequest('email לא חוקי');

        // תשובה אחידה בכל מקרה — לא מגלים אם האימייל רשום.
        const done = () => ctx.send({ ok: true });

        const users = strapi.db.query(USER_UID);
        const user = await users.findOne({ where: { email: { $eqi: email } } });
        if (!user || user.blocked) return done();

        const last = lastSentByEmail.get(email) ?? 0;
        if (Date.now() - last < COOLDOWN_MS) return done();
        lastSentByEmail.set(email, Date.now());
        if (lastSentByEmail.size > 5000) {
            for (const [k, t] of lastSentByEmail) if (Date.now() - t > COOLDOWN_MS) lastSentByEmail.delete(k);
        }

        const token = newResetToken();
        // קודם שומרים את הטוקן, ורק אחר כך שולחים (כמו Strapi) — כדי שאדמין יוכל לייצר קישור אם המייל נכשל.
        await users.update({ where: { id: user.id }, data: { resetPasswordToken: token } });

        const link = `${target.origin}/reset-password?code=${encodeURIComponent(token)}`;
        const { subject, html, text } = buildResetEmail({
            siteName: siteNameFor(target.host),
            link,
            provider: user.provider,
            name: user.name || user.display_name || null,
        });

        const fromEmail = process.env.EMAIL_FROM || 'noreply@gofreeil.com';
        const from = fromEmail.includes('<') ? fromEmail : `${siteNameFor(target.host)} <${fromEmail}>`;
        try {
            await strapi.plugin('email').service('email').send({ to: user.email, from, subject, html, text });
        } catch (e) {
            lastSentByEmail.delete(email); // שליחה נכשלה — שיוכל לנסות שוב מיד
            throw e;
        }
        return done();
    };

    plugin.controllers.auth.resetPassword = async (ctx: any) => {
        const code = String(ctx.request?.body?.code ?? '');
        const users = strapi.db.query(USER_UID);
        const user = code ? await users.findOne({ where: { resetPasswordToken: code } }) : null;

        if (user && isResetTokenExpired(code)) {
            await users.update({ where: { id: user.id }, data: { resetPasswordToken: null } });
            return ctx.badRequest('Incorrect code provided');
        }

        await originalReset(ctx); // זורק על קוד/סיסמה לא תקינים — ואז לא מגיעים לשורות הבאות

        if (user && (user.provider !== 'local' || user.confirmed !== true)) {
            // מי שהוכיח בעלות על המייל: מאשרים אותו, ואם נרשם דרך Google/Facebook —
            // הופכים ל-local כדי שכניסה עם אימייל+סיסמה (שרק local מורשה אליה) תעבוד.
            // כניסה דרך Google/Facebook ממשיכה לעבוד: connect מחבר חשבונות לפי אימייל.
            await users.update({ where: { id: user.id }, data: { provider: 'local', confirmed: true } });
        }
    };
}
