// ============================================================
// phoneOtp.ts — כניסה/הצטרפות בקוד SMS (OTP) לכל אתרי gofreeil
//
// למה בבאקאנד: ספקי ה-SMS (sms.ts) והנפקת ה-JWT כבר כאן, וכל האתרים יושבים
// על אותו Strapi. אתר הקהילה (הגשר של ה-SSO) קורא לנקודות הקצה עם
// STRAPI_TOKEN (שרת-לשרת בלבד), ומקבל JWT חי — בדיוק כמו /sso/issue-jwt.
//
// אחסון מצב הקוד: פריט ב-items תחת קטגוריה __phone_otp (label = הנייד ב-E.164).
// לא בזיכרון התהליך — יש שני מופעי Strapi מאחורי ה-nginx, והבקשה השנייה
// (אימות) עלולה להגיע למופע אחר. הקוד נשמר כ-hash בלבד, פג אחרי 10 דקות,
// 5 ניסיונות הקלדה, 5 שליחות לנייד בשעה ותקרה גלובלית למופע.
//
// זהות: משתמש קיים מזוהה לפי שדה phone (השוואה מנורמלת, בלי תלות בפורמט).
// אין כזה → נוצר משתמש חדש, מאושר, עם אימייל סינתטי <05xxxxxxxx>@phone.gofreeil.com
// ושם משתמש = הנייד. הוא יכול להשלים שם/אימייל אמיתי בפרופיל.
// ============================================================

import { createHash, randomBytes, randomInt } from 'node:crypto';
import { sendSms, smsEnabled, toMobileE164 } from './sms';

const CATEGORY = '__phone_otp';
const OTP_TTL_MS = 10 * 60_000;   // תוקף הקוד
const RESEND_MS = 60_000;         // מרווח מינימלי בין שליחות לאותו נייד
const MAX_TRIES = 5;              // ניסיונות הקלדה עד ביטול הקוד
const MAX_SENDS_PER_HOUR = 5;     // שליחות לאותו נייד בשעה
const GLOBAL_MAX_PER_HOUR = Number(process.env.PHONE_OTP_GLOBAL_MAX_PER_HOUR ?? 120) || 120;
const PHONE_EMAIL_DOMAIN = 'phone.gofreeil.com';

export type OtpError =
    | 'unavailable' | 'invalid_phone' | 'too_soon' | 'too_many' | 'sms_failed'
    | 'no_code' | 'expired' | 'wrong_code' | 'blocked' | 'server';

export type OtpRequestResult = { ok: true; masked: string } | { ok: false; error: OtpError };
export type OtpVerifyResult =
    | { ok: true; jwt: string; userId: number; created: boolean }
    | { ok: false; error: OtpError; triesLeft?: number };

interface OtpState {
    h: string;
    exp: string;
    tries: number;
    sent_at: string;
    sends: string[];
}

interface OtpItemRow {
    id: number;
    extra_fields: OtpState | null;
}

function secret(): string {
    return process.env.PHONE_OTP_SECRET || process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || '';
}

function hashCode(code: string, phone: string): string {
    return createHash('sha256').update(`${code}:${phone}:${secret()}`).digest('hex');
}

/** E.164 ‎+9725x → תצוגה מקומית 05x (הפורמט שבו הניידים שמורים ברוב הרשומות) */
function e164ToLocal(e164: string): string {
    return '0' + e164.replace(/^\+972/, '');
}

/** נרמול להשוואה: ספרות בלבד, בלי קידומת מדינה */
function normPhone(raw: string | null | undefined): string {
    let d = (raw ?? '').replace(/\D/g, '');
    if (d.startsWith('972')) d = '0' + d.slice(3);
    return d;
}

function mask(local: string): string {
    return local.slice(0, 3) + '•••' + local.slice(-3);
}

// תקרה גלובלית למופע — רשת ביטחון מול לולאה/הצפה שתרוקן חבילת SMS
let globalSent: number[] = [];
function globalAllows(now: number): boolean {
    globalSent = globalSent.filter((t) => now - t < 60 * 60_000);
    if (globalSent.length >= GLOBAL_MAX_PER_HOUR) return false;
    globalSent.push(now);
    return true;
}

async function findOtpRow(e164: string): Promise<OtpItemRow | null> {
    const row = await strapi.db.query('api::item.item').findOne({
        where: { category: CATEGORY, label: e164 },
        select: ['id', 'extra_fields'],
    });
    return (row as OtpItemRow | null) ?? null;
}

async function saveOtp(row: OtpItemRow | null, e164: string, state: OtpState): Promise<void> {
    if (row) {
        await strapi.db.query('api::item.item').update({ where: { id: row.id }, data: { extra_fields: state } });
    } else {
        await strapi.db.query('api::item.item').create({
            data: {
                label: e164,
                category: CATEGORY,
                description: 'קוד כניסה חד-פעמי (SMS)',
                icon: '📱',
                status1: 'active',
                extra_fields: state,
                publishedAt: new Date(),
            },
        });
    }
}

export function phoneOtpEnabled(): boolean {
    return process.env.PHONE_OTP_ENABLED !== 'false' && smsEnabled() && !!secret();
}

/** שולח קוד לנייד ושומר את מצבו (hash, תוקף, ניסיונות) */
export async function requestPhoneOtp(rawPhone: string): Promise<OtpRequestResult> {
    if (!phoneOtpEnabled()) return { ok: false, error: 'unavailable' };
    const e164 = toMobileE164(rawPhone);
    if (!e164) return { ok: false, error: 'invalid_phone' };

    const now = Date.now();
    const row = await findOtpRow(e164);
    const prev = row?.extra_fields ?? null;
    const sends = (prev?.sends ?? []).filter((s) => now - Date.parse(s) < 60 * 60_000);
    if (prev?.sent_at && now - Date.parse(prev.sent_at) < RESEND_MS) return { ok: false, error: 'too_soon' };
    if (sends.length >= MAX_SENDS_PER_HOUR) return { ok: false, error: 'too_many' };
    if (!globalAllows(now)) return { ok: false, error: 'too_many' };

    const code = String(randomInt(100000, 1000000));
    const state: OtpState = {
        h: hashCode(code, e164),
        exp: new Date(now + OTP_TTL_MS).toISOString(),
        tries: 0,
        sent_at: new Date(now).toISOString(),
        sends: [...sends, new Date(now).toISOString()],
    };

    // קודם שולחים, ואז שומרים — קוד שנכשל בשליחה לא ננעל על הנייד
    try {
        await sendSms(e164, `קוד הכניסה שלך ליוצאים לחירות: ${code}\nתקף ל-10 דקות. אם לא ביקשת — התעלם/י.`);
    } catch (e) {
        strapi.log.error(`[phone-otp] sendSms failed: ${e instanceof Error ? e.message : e}`);
        return { ok: false, error: 'sms_failed' };
    }
    await saveOtp(row, e164, state);
    return { ok: true, masked: mask(e164ToLocal(e164)) };
}

/** משתמש users-permissions לפי נייד — השוואה מנורמלת על כל מי שיש לו נייד */
async function findUserByPhone(e164: string): Promise<{ id: number; blocked: boolean } | null> {
    const target = normPhone(e164);
    const rows = (await strapi.db.query('plugin::users-permissions.user').findMany({
        where: { phone: { $notNull: true } },
        select: ['id', 'phone', 'blocked', 'createdAt'],
        orderBy: { createdAt: 'asc' },
    })) as Array<{ id: number; phone: string | null; blocked: boolean }>;
    const hit = rows.find((u) => normPhone(u.phone) === target);
    return hit ? { id: hit.id, blocked: !!hit.blocked } : null;
}

/** משתמש חדש לנייד שאומת: מאושר, תפקיד authenticated רגיל, בלי סיסמה שמישה */
async function createPhoneUser(e164: string): Promise<{ id: number }> {
    const local = e164ToLocal(e164);
    const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });
    // אימייל סינתטי ייחודי — Strapi דורש אימייל; המשתמש יוכל להחליף לאמיתי בפרופיל
    const email = `${local}@${PHONE_EMAIL_DOMAIN}`;
    const existingByEmail = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { email } });
    if (existingByEmail) return { id: existingByEmail.id };
    const user = await strapi.plugin('users-permissions').service('user').add({
        username: local,
        email,
        password: randomBytes(24).toString('hex'),
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: role?.id,
        phone: local,
        app_role: 'user',
    });
    return { id: user.id };
}

/** מאמת קוד; בהצלחה מזהה/יוצר משתמש ומנפיק JWT */
export async function verifyPhoneOtp(rawPhone: string, rawCode: string): Promise<OtpVerifyResult> {
    const e164 = toMobileE164(rawPhone);
    if (!e164) return { ok: false, error: 'invalid_phone' };
    const code = (rawCode ?? '').replace(/\D/g, '');
    if (code.length !== 6) return { ok: false, error: 'wrong_code' };

    const row = await findOtpRow(e164);
    const otp = row?.extra_fields ?? null;
    if (!row || !otp?.h) return { ok: false, error: 'no_code' };
    if (Date.now() > Date.parse(otp.exp)) return { ok: false, error: 'expired' };
    if (otp.tries >= MAX_TRIES) return { ok: false, error: 'too_many' };

    if (hashCode(code, e164) !== otp.h) {
        const tries = otp.tries + 1;
        await saveOtp(row, e164, { ...otp, tries });
        return { ok: false, error: tries >= MAX_TRIES ? 'too_many' : 'wrong_code', triesLeft: Math.max(0, MAX_TRIES - tries) };
    }

    // הקוד נצרך — מוחקים את ה-hash (השליחות נשארות לריסון)
    await saveOtp(row, e164, { ...otp, h: '', exp: new Date(0).toISOString() });

    let user = await findUserByPhone(e164);
    let created = false;
    if (user?.blocked) return { ok: false, error: 'blocked' };
    if (!user) {
        user = { ...(await createPhoneUser(e164)), blocked: false };
        created = true;
    }
    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });
    return { ok: true, jwt, userId: user.id, created };
}
