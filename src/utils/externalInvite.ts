/**
 * הזמנה ב-SMS מאתר חיצוני (חירות TV): משתמש מחובר באתר מזמין חבר, וה-SMS יוצא מכאן (utils/sms.ts),
 * כלומר מהטלפון של הרשת ולא מהמכשיר של המזמין.
 *
 * כללי בטיחות - ה-SMS יוצא ממספר אמיתי של הרשת אל מספר שמשתמש הקליד:
 *   * הטקסט והקישור נקבעים כאן (externalSso.ts, invite), לא באתר: בקשה חתומה לא יכולה לשלוח טקסט חופשי.
 *     מהאתר מגיע רק שם המזמין, והוא מנוקה: אותיות בלבד (בלי ספרות, נקודות ולוכסנים - כך שאין בו
 *     מספר טלפון או קישור), עד 20 תווים ו-3 מילים.
 *   * רק ניידים של מפעילים ישראליים (050-055, 058).
 *   * ריסון: לאותו נייד הזמנה אחת ב-7 ימים (מכל המזמינים יחד); תקרה יומית למזמין ולכתובת הרשת שלו
 *     (כמה חשבונות מאותו מקום); תקרת ניסיונות יומית (גם ניסיון שנדחה נספר, כדי שאי אפשר יהיה לבדוק
 *     מספרים בלי סוף); ותקרה גלובלית לשעה וליום.
 *   * מספרי היעד נשמרים כ-HMAC בלבד, לא כמספרים.
 *
 * קובץ זה לוגיקה טהורה (בלי strapi), כדי שאפשר לבדוק אותו לבד.
 */
import { createHmac } from 'crypto';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
const NAME_MAX = 20;
const NAME_MAX_WORDS = 3;

export interface InviteLimits {
    /** מרווח מינימלי בין שתי הזמנות לאותו נייד */
    phoneGapMs: number;
    /** הזמנות שנשלחו, למזמין אחד ב-24 שעות */
    perInviterDay: number;
    /** הזמנות שנשלחו, מכתובת רשת אחת ב-24 שעות (כמה חשבונות מאותו מקום) */
    perClientDay: number;
    /** ניסיונות (כולל כאלה שנדחו) למזמין או לכתובת רשת ב-24 שעות */
    attemptsDay: number;
    /** הזמנות מכל האתרים בשעה / ב-24 שעות */
    globalHour: number;
    globalDay: number;
}

export function inviteLimits(env: Record<string, string | undefined> = process.env): InviteLimits {
    const num = (v: string | undefined, fallback: number): number => {
        const n = Math.trunc(Number(v));
        return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    return {
        phoneGapMs: num(env.EXTERNAL_INVITE_PHONE_GAP_DAYS, 7) * DAY_MS,
        perInviterDay: num(env.EXTERNAL_INVITE_MAX_PER_USER_DAY, 3),
        perClientDay: num(env.EXTERNAL_INVITE_MAX_PER_CLIENT_DAY, 5),
        attemptsDay: num(env.EXTERNAL_INVITE_MAX_ATTEMPTS_DAY, 12),
        globalHour: num(env.EXTERNAL_INVITE_GLOBAL_MAX_PER_HOUR, 10),
        globalDay: num(env.EXTERNAL_INVITE_GLOBAL_MAX_PER_DAY, 40),
    };
}

/**
 * שם המזמין כפי שייכתב ב-SMS: אותיות, רווח, מקף, גרש וקו תחתון בלבד. '' = בלי שם.
 * בלי ספרות: שם כמו "זכית בפרס חייג 0521234567" היה יוצא מהטלפון של הרשת עם מספר שאפשר ללחוץ עליו.
 */
export function cleanInviterName(value: unknown): string {
    if (typeof value !== 'string') return '';
    const words = value
        .normalize('NFKC')
        .replace(/[^\p{L}\p{M} '_-]/gu, ' ')
        .split(/\s+/)
        .filter((w) => /\p{L}/u.test(w))
        .slice(0, NAME_MAX_WORDS);
    return words.join(' ').slice(0, NAME_MAX).trim();
}

export function inviteText(siteName: string, inviter: string, url: string): string {
    const from = inviter ? ` מאת ${inviter}` : '';
    return `קיבלת הזמנה${from} להצטרף ל${siteName}, לשוחח בפרטיות בצ'אט מאובטח, ולהכיר וליהנות מפלטפורמת הוידאו המתקדמת בעולם:\n${url}`;
}

/**
 * נייד של מפעיל ישראלי (E.164). toMobileE164 מקבל כל 05x, כולל 056 ו-059 (מפעילים פלסטיניים,
 * בדרך כלל מחוץ לחבילת ה-SMS): להזמנות לא שולחים אליהם.
 */
export function isInvitablePhone(e164: unknown): e164 is string {
    return typeof e164 === 'string' && /^\+9725[0-58]\d{7}$/.test(e164);
}

/** מזהה כתובת הרשת של המזמין כפי שהאתר שולח אותו (hash, לא הכתובת עצמה). '' = לא נשלח או לא תקין. */
export function cleanClientId(value: unknown): string {
    return typeof value === 'string' && /^[a-f0-9]{16,64}$/.test(value) ? value : '';
}

/** מפתח אחסון לנייד: HMAC, כדי שבמאגר לא יישבו מספרי טלפון */
export function phoneKey(secret: string, e164: string): string {
    if (!secret) throw new Error('missing secret');
    return createHmac('sha256', secret).update(`external-invite-phone-v1:${e164}`).digest('base64url').slice(0, 22);
}

/** לנייד בלוג: ‎+9725•••123 */
export function maskPhone(e164: string): string {
    return `${e164.slice(0, 5)}•••${e164.slice(-3)}`;
}

export interface InviteState {
    /** מפתח נייד → מתי נשלחה אליו הזמנה */
    phones: Record<string, number>;
    /** גורם (מזמין או כתובת רשת) → זמני ההזמנות שנשלחו ביממה האחרונה */
    sends: Record<string, number[]>;
    /** גורם → זמני כל הניסיונות ביממה האחרונה, גם אלה שנדחו */
    tries: Record<string, number[]>;
    /** כל השליחות ביממה האחרונה */
    sent: number[];
}

export interface InviteKey {
    phone: string;
    /** site:u:<id> */
    inviter: string;
    /** site:c:<hash>, או '' כשהאתר לא שלח מזהה */
    client: string;
}

export type InviteDenied = 'phone_recent' | 'inviter_limit' | 'global_limit';

export type ReserveResult =
    | { ok: true; state: InviteState; changed: true }
    | { ok: false; error: InviteDenied; state: InviteState; changed: boolean };

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** מנרמל את מה שנשמר במאגר (גם אם ריק או פגום) ומוחק את מה שכבר לא משפיע על אף מגבלה */
export function loadInviteState(raw: unknown, now: number, limits: InviteLimits): InviteState {
    const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof InviteState, unknown>>;
    // מפות בלי prototype: מפתח כמו "constructor" לא נחשב בטעות לרישום קיים
    const state: InviteState = { phones: Object.create(null), sends: Object.create(null), tries: Object.create(null), sent: [] };
    const fresh = (list: unknown): number[] =>
        (Array.isArray(list) ? list : []).filter((t): t is number => isTime(t) && now - t < DAY_MS);
    const freshLists = (from: unknown, into: Record<string, number[]>) => {
        if (!from || typeof from !== 'object') return;
        for (const [k, list] of Object.entries(from as Record<string, unknown>)) {
            const times = fresh(list);
            if (times.length) into[k] = times;
        }
    };

    if (src.phones && typeof src.phones === 'object') {
        for (const [k, t] of Object.entries(src.phones as Record<string, unknown>)) {
            if (isTime(t) && now - t < limits.phoneGapMs) state.phones[k] = t;
        }
    }
    freshLists(src.sends, state.sends);
    freshLists(src.tries, state.tries);
    state.sent = fresh(src.sent);
    return state;
}

/**
 * בודק את כל המגבלות ואם מותר - רושם את השליחה. changed אומר אם צריך לשמור את המצב שחזר.
 * סדר הבדיקות: קודם המזמין (ניסיונות ואז שליחות), ורק אחר כך הנייד - כך מי שמיצה את המכסה לא לומד
 * דבר על מספרים. כל ניסיון שעבר את תקרת הניסיונות נרשם, גם אם נדחה בהמשך.
 */
export function reserveInvite(raw: unknown, key: InviteKey, now: number, limits: InviteLimits): ReserveResult {
    const state = loadInviteState(raw, now, limits);
    const actors = key.client ? [key.inviter, key.client] : [key.inviter];
    const count = (map: Record<string, number[]>, actor: string): number => (map[actor] ?? []).length;

    if (actors.some((a) => count(state.tries, a) >= limits.attemptsDay)) {
        return { ok: false, error: 'inviter_limit', state, changed: false };
    }
    for (const a of actors) state.tries[a] = [...(state.tries[a] ?? []), now];

    if (count(state.sends, key.inviter) >= limits.perInviterDay || (key.client && count(state.sends, key.client) >= limits.perClientDay)) {
        return { ok: false, error: 'inviter_limit', state, changed: true };
    }
    if (state.phones[key.phone] !== undefined) return { ok: false, error: 'phone_recent', state, changed: true };
    if (state.sent.length >= limits.globalDay || state.sent.filter((t) => now - t < HOUR_MS).length >= limits.globalHour) {
        return { ok: false, error: 'global_limit', state, changed: true };
    }
    state.phones[key.phone] = now;
    for (const a of actors) state.sends[a] = [...(state.sends[a] ?? []), now];
    state.sent.push(now);
    return { ok: true, state, changed: true };
}

/**
 * השליחה נכשלה: מבטל את רישום השליחה שנעשה ב-at, כדי שהמזמין יוכל לנסות שוב.
 * הניסיון עצמו נשאר רשום - כך גם בזמן תקלה אצל ספק ה-SMS אי אפשר לנסות בלי סוף.
 */
export function releaseInvite(raw: unknown, key: InviteKey, at: number, now: number, limits: InviteLimits): InviteState {
    const state = loadInviteState(raw, now, limits);
    const dropOne = (list: number[]): number[] => {
        const i = list.indexOf(at);
        return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
    };
    if (state.phones[key.phone] === at) delete state.phones[key.phone];
    for (const a of key.client ? [key.inviter, key.client] : [key.inviter]) {
        const left = dropOne(state.sends[a] ?? []);
        if (left.length) state.sends[a] = left;
        else delete state.sends[a];
    }
    state.sent = dropOne(state.sent);
    return state;
}
