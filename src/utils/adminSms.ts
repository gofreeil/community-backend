// ============================================================
// adminSms.ts — התראת SMS לנייד של מנהל על כל התראת ניהול חדשה
//
// למה כאן ולא באתרים: כל אתרי הרשת יושבים על ה-Strapi הזה, וכל התראה
// לאדמין עוברת דרכו — הקהילה כותבת items (category message/admin_alert עם
// user_id של המנהל), ושאר האתרים (אבדות, בעלי מקצוע, גמ"ח ארצי, דירוג...)
// כותבים ל-messages (receiver). שני ה-lifecycles קוראים לפונקציה אחת כאן,
// וכך *כל* אדמין — הסופר-אדמין וכל מי שמנהל את הפלטפורמה שלו — מקבל SMS
// לנייד שבפרופיל שלו, בלי לגעת בעשרה ריפואים.
//
// המנגנון: אותו sms.ts שמאמת נייד בגמ"ח הארצי (SMSGate / Traccar / Twilio).
//
// כללי בטיחות — SMS זה ערוץ יקר ורועש, ולכן:
//   * נשלח רק למי ש-app_role שלו ברשימת התפקידים (ברירת מחדל: super_admin +
//     neighborhood_admin) או שהוא רכז שכונה (coordinator_of לא ריק;
//     ADMIN_SMS_INCLUDE_COORDINATORS=false מבטל), לא חסום, ועם נייד ישראלי תקין.
//   * ריסון: אותה הודעה לאותו נמען לא נשלחת פעמיים ב-10 דק'; לכל היותר
//     ADMIN_SMS_MAX_PER_HOUR לנמען בשעה; ותקרה גלובלית לאינסטנס — כדי שבאג
//     שמייצר התראות בלולאה לא ירוקן חבילת SMS.
//   * best-effort: כל כשל נבלע ונרשם בלוג. יצירת ההודעה עצמה לעולם לא נופלת.
//   * ADMIN_SMS_ENABLED=false מכבה את הכל בלי לגעת בקוד.
// ============================================================

import { createHash } from 'node:crypto';
import { sendSms, smsEnabled, smsProviderName, toMobileE164 } from './sms';

const DEDUPE_WINDOW_MS = 10 * 60_000;
const HOUR_MS = 60 * 60_000;
const MAX_BODY_CHARS = 320;

/** תקרות ניתנות לכיוון מה-env; ברירות המחדל שמרניות אבל לא חונקות יום עמוס */
const perUserCap = () => Number(process.env.ADMIN_SMS_MAX_PER_HOUR ?? 12) || 12;
const globalCap  = () => Number(process.env.ADMIN_SMS_GLOBAL_MAX_PER_HOUR ?? 80) || 80;

function allowedRoles(): Set<string> {
    const raw = process.env.ADMIN_SMS_ROLES ?? 'super_admin,neighborhood_admin';
    return new Set(raw.split(',').map((r) => r.trim()).filter(Boolean));
}

function enabled(): boolean {
    return process.env.ADMIN_SMS_ENABLED !== 'false' && smsEnabled();
}

/** רכזי שכונות מזוהים לפי coordinator_of (ולא לפי app_role) — גם הם מנהלים,
 *  של השכונה שלהם, ומקבלים התראות (למשל אירוע שממתין לאישור באזורם). */
function includeCoordinators(): boolean {
    return process.env.ADMIN_SMS_INCLUDE_COORDINATORS !== 'false';
}

function isCoordinator(u: AdminUserRow): boolean {
    return includeCoordinators() && Array.isArray(u.coordinator_of) && u.coordinator_of.length > 0;
}

// זיכרון-תהליך בלבד: יש שני מופעי Strapi מאחורי ה-nginx, ולכן התקרות בפועל
// יכולות להיות עד פי שניים. זה מקובל — מדובר ברשת ביטחון, לא בחשבונאות.
const lastSentByKey = new Map<string, number>();
const sentTimesByUser = new Map<number, number[]>();
let globalSentTimes: number[] = [];

function prune(times: number[], now: number): number[] {
    return times.filter((t) => now - t < HOUR_MS);
}

/** האם מותר לשלוח עכשיו לנמען הזה את הגוף הזה; אם כן — רושם את השליחה.
 *  מחזיר null כשמותר, אחרת את סיבת החסימה (ללוג). */
function reserveSlot(userId: number, body: string, now: number): string | null {
    const key = `${userId}:${createHash('sha1').update(body).digest('hex')}`;
    const last = lastSentByKey.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return 'duplicate within 10m';

    const mine = prune(sentTimesByUser.get(userId) ?? [], now);
    if (mine.length >= perUserCap()) return `per-user cap ${perUserCap()}/h`;

    globalSentTimes = prune(globalSentTimes, now);
    if (globalSentTimes.length >= globalCap()) return `global cap ${globalCap()}/h`;

    lastSentByKey.set(key, now);
    mine.push(now);
    sentTimesByUser.set(userId, mine);
    globalSentTimes.push(now);

    // המפה של הדדופ גדלה עם כל הודעה ייחודית — מנקים מפעם לפעם
    if (lastSentByKey.size > 2000) {
        for (const [k, t] of lastSentByKey) if (now - t >= DEDUPE_WINDOW_MS) lastSentByKey.delete(k);
    }
    return null;
}

/** מקצר לשורה אחת נקייה: בלי שורות ריקות, בלי רווחים כפולים */
export function oneLine(s: string): string {
    return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/** השורה הראשונה הלא-ריקה של טקסט — הכותרת הטבעית של ההודעה */
export function firstLine(s: string): string {
    const line = String(s ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    return line ?? '';
}

/**
 * מוצא קישור בגוף ההודעה. סדר העדיפויות:
 *   1. URL מלא (https://...)
 *   2. דומיין של הרשת בלי סכימה ("avedot.gofreeil.com/admin/ads")
 *   3. "קישור: /נתיב" יחסי (הפורמט של הקהילה) — מוצמד ל-base
 * הקישור *האחרון* בטקסט הוא בדרך כלל "ממתינה לאישור ב-..." — ולכן לוקחים אותו.
 */
export function extractLink(content: string, base: string): string | undefined {
    const text = String(content ?? '');
    const full = text.match(/https?:\/\/[^\s"'<>)]+/g);
    if (full?.length) return full[full.length - 1];
    const bare = text.match(/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.gofreeil\.com(?:\/[^\s"'<>)]*)?/gi);
    if (bare?.length) return `https://${bare[bare.length - 1]}`;
    const rel = text.match(/קישור:\s*(\/[^\s"'<>)]*)/g);
    if (rel?.length) {
        const path = rel[rel.length - 1].replace(/^קישור:\s*/, '');
        return `${base.replace(/\/$/, '')}${path}`;
    }
    return undefined;
}

export const COMMUNITY_SITE_URL = (process.env.COMMUNITY_SITE_URL ?? 'https://community.gofreeil.com').replace(/\/$/, '');

interface AdminUserRow {
    id: number;
    email?: string | null;
    phone?: string | null;
    app_role?: string | null;
    blocked?: boolean | null;
    coordinator_of?: unknown;
}

/** שולף את הנמען לפי מזהה Strapi מספרי או לפי external_id/אימייל (ה-user_id של items) */
async function resolveUser(ref: { userId?: number | string | null; externalId?: string | null }): Promise<AdminUserRow | null> {
    const or: Record<string, unknown>[] = [];
    if (ref.userId != null && ref.userId !== '') {
        const n = Number(ref.userId);
        if (Number.isFinite(n) && n > 0) or.push({ id: n });
    }
    const ext = (ref.externalId ?? '').trim();
    if (ext) {
        or.push({ external_id: ext });
        if (ext.includes('@')) or.push({ email: { $eqi: ext } });
        const n = Number(ext);
        if (/^\d+$/.test(ext) && Number.isFinite(n) && n > 0) or.push({ id: n });
    }
    if (or.length === 0) return null;
    const row = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: or.length === 1 ? or[0] : { $or: or },
        select: ['id', 'email', 'phone', 'app_role', 'blocked', 'coordinator_of'],
    });
    return (row as AdminUserRow | null) ?? null;
}

export interface AdminSmsInput {
    /** מזהה Strapi מספרי של הנמען (relation receiver של messages) */
    userId?: number | string | null;
    /** מזהה חיצוני / אימייל / מזהה-כמחרוזת (user_id של items) */
    externalId?: string | null;
    /** הכותרת — השורה הראשונה של ה-SMS */
    title: string;
    /** קישור מלא שהנמען יפתח; ברירת מחדל: תיבת ההודעות בקהילה */
    link?: string;
    /** מקור ללוג בלבד ("message" / "item") */
    source: string;
}

/**
 * שולח SMS לנייד של המנהל על התראה חדשה. לעולם לא זורק.
 * מחזיר true רק כשבאמת נשלח.
 */
export async function notifyAdminBySms(input: AdminSmsInput): Promise<boolean> {
    if (!enabled()) return false;
    const tag = `[admin-sms:${input.source}]`;
    try {
        const user = await resolveUser(input);
        if (!user) return false;
        if (user.blocked) return false;
        if (!allowedRoles().has(String(user.app_role ?? '')) && !isCoordinator(user)) return false;

        const to = toMobileE164(user.phone);
        if (!to) {
            strapi.log.info(`${tag} ${user.email ?? user.id}: אין נייד תקין בפרופיל — מדלג`);
            return false;
        }

        const title = oneLine(input.title);
        if (!title) return false;
        const link = input.link || `${COMMUNITY_SITE_URL}/messages`;
        let body = `${title}\n${link}`;
        if (body.length > MAX_BODY_CHARS) {
            body = `${title.slice(0, MAX_BODY_CHARS - link.length - 2)}…\n${link}`;
        }

        const blocked = reserveSlot(user.id, body, Date.now());
        if (blocked) {
            strapi.log.warn(`${tag} ${user.email ?? user.id}: לא נשלח (${blocked})`);
            return false;
        }

        await sendSms(to, body);
        strapi.log.info(`${tag} SMS via ${smsProviderName()} → ${user.email ?? user.id}: ${title.slice(0, 80)}`);
        return true;
    } catch (err) {
        strapi.log.error(`${tag} שליחה נכשלה: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}
