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
//   * נשלח רק למנהל — כל תפקיד ניהול בכל אתר ברשת: super_admin וכל app_role
//     שמסתיים ב-_admin (neighborhood_admin, idx_admin, avd_admin, ch_admin...),
//     כך שאתר חדש ברשת נכלל בלי לגעת כאן; ADMIN_SMS_ROLES מוסיף תפקידים — או
//     לרכז שכונה (coordinator_of לא ריק; ADMIN_SMS_INCLUDE_COORDINATORS=false
//     מבטל). לא חסום, ועם נייד ישראלי תקין.
//   * רק התראות חשובות ורלוונטיות לנמען (isImportantFor): מנהל — התראות שדורשות
//     טיפול; רכז — רק מה שנוגע לאזור שלו. הודעות אישיות (תגובה על פריט, התאמה,
//     תזכורת) והודעות צ'אט בין משתמשים נשארות בתיבה בלבד.
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

/** תפקידים נוספים מה-env (מעבר לכל *_admin) — מוסיף בלבד, לא מצמצם */
function extraRoles(): Set<string> {
    const raw = process.env.ADMIN_SMS_ROLES ?? '';
    return new Set(raw.split(',').map((r) => r.trim()).filter(Boolean));
}

/** האם התפקיד הוא תפקיד ניהול באחד מאתרי הרשת. כל אתר מגדיר תפקיד משלו
 *  (idx_admin, avd_admin, ch_admin, cr_admin, nc_admin, rating_admin, ref_admin,
 *  exp_admin...) — רשימה סגורה הייתה משאירה בחוץ כל אתר חדש, כמו שקרה לאינדקס. */
export function isAdminRole(role: string | null | undefined): boolean {
    const r = String(role ?? '').trim();
    if (!r) return false;
    return r === 'super_admin' || /^[a-z0-9]+(?:_[a-z0-9]+)*_admin$/.test(r) || extraRoles().has(r);
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

// ------------------------------------------------------------
// קבוצות התראה — מה שהמנהל בוחר בפרופיל ("התראות לנייד"). הרשימה חייבת
// להישאר זהה ל-my_new_project/src/lib/smsPrefs.ts. העדפה חסרה = הכל.
// ------------------------------------------------------------
export type SmsGroup = 'ads' | 'coordinators' | 'locations' | 'content' | 'errors' | 'other';

/** סיווג לפי extra_fields.type של ה-item בקהילה */
const GROUP_BY_TYPE: Record<string, SmsGroup> = {
    ad_submission:        'ads',
    ad_landing_ready:     'ads',
    design_help_request:  'ads',
    order_failed:         'ads',
    coordinator_request:  'coordinators',
    neighborhood_request: 'locations',
    location_request:     'locations',
    location_task:        'locations',
    city_request:         'locations',
    event_pending:        'content',
    wish_request:         'content',
    singles_review:       'content',
    singles_access:       'content',
    matchmaker_request:   'content',
    quiz_suggestion:      'content',
    server_error:         'errors',
    client_error:         'errors',
    totp_reset:           'errors',
};

// ------------------------------------------------------------
// מה חשוב ורלוונטי — רשימה מותרת, לא רשימה חסומה. התיבה של מנהל מקבלת גם
// הודעות אישיות (תגובה על פריט שלו, התאמת אירוח, תזכורת פרסומת, צ'אט) —
// אלה לא סיבה להעיר אותו בנייד. סוג התראה חדש שדורש טיפול מנהל → להוסיף כאן.
// ------------------------------------------------------------

/** התראות items שדורשות החלטה/טיפול של מנהל */
const ADMIN_ITEM_TYPES = new Set<string>([
    ...Object.keys(GROUP_BY_TYPE),
    'network_contact',   // פנייה ישירה לרכז אתר מרשימת הצוות (freedom)
    'distress_alert',    // קריאת עזרה בשכונה
]);

/** התראות items שרלוונטיות לרכז שכונה. הן כבר ממוענות לפי האזור שלו
 *  (אירוע בשכונה שלו, קריאת עזרה בשכונה שלו) — כאן רק סינון החשיבות. */
const COORDINATOR_ITEM_TYPES = new Set<string>(['event_pending', 'distress_alert', 'network_contact']);

export interface ImportanceInput {
    source: string;
    category?: string | null;
    efType?: string | null;
    /** להודעות messages: האם יש שולח (= צ'אט בין משתמשים, לא התראת מערכת) */
    hasSender?: boolean;
}

/**
 * האם ההתראה חשובה ורלוונטית לנמען לפי תפקידו.
 *   messages (אתרי הרשת): רק למנהל, ורק התראת מערכת (בלי שולח) — בקשת פרסום,
 *     כרטיס עסק, בקשת בעלות, תיק/שאלה חדשים. כל אתר ממען רק את super_admin ואת
 *     תפקיד האדמין שלו, ולכן אדמין של אתר אחד לא מקבל כאן SMS של אתר אחר.
 *     רכז שכונה הוא רכז של קהילה בשכונה — הודעה אליו מאתר אחר ברשת לא מעירה
 *     אותו בנייד (תיבה בלבד). צ'אט בין משתמשים — לא.
 *   items (הקהילה): admin_alert תמיד; אחרת לפי הסוג — מנהל: ADMIN_ITEM_TYPES,
 *     רכז: COORDINATOR_ITEM_TYPES.
 */
export function isImportantFor(input: ImportanceInput, who: { admin: boolean; coordinator: boolean }): boolean {
    if (!who.admin && !who.coordinator) return false;
    if (input.source === 'message') return who.admin && !input.hasSender;
    if (input.category === 'admin_alert') return true;
    const t = String(input.efType ?? '');
    if (!t) return false;
    return (who.admin && ADMIN_ITEM_TYPES.has(t)) || (who.coordinator && COORDINATOR_ITEM_TYPES.has(t));
}

export function classifyGroup(input: { source: string; category?: string | null; efType?: string | null }): SmsGroup {
    // אוסף messages משמש את אתרי הרשת רק לבקשות פרסום
    if (input.source === 'message') return 'ads';
    const byType = GROUP_BY_TYPE[String(input.efType ?? '')];
    if (byType) return byType;
    if (input.category === 'admin_alert') return 'errors';
    return 'other';
}

interface SmsPrefs {
    enabled?: unknown;
    groups?: unknown;
}

/** האם הנמען מסכים לקבל SMS מהקבוצה הזו. בלי העדפות (null/זבל) — כן. */
function prefsAllow(raw: unknown, group: SmsGroup): boolean {
    if (!raw || typeof raw !== 'object') return true;
    const p = raw as SmsPrefs;
    if (p.enabled === false) return false;
    if (!Array.isArray(p.groups)) return true;
    return p.groups.map(String).includes(group);
}

interface AdminUserRow {
    id: number;
    email?: string | null;
    phone?: string | null;
    app_role?: string | null;
    blocked?: boolean | null;
    coordinator_of?: unknown;
    sms_prefs?: unknown;
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
        select: ['id', 'email', 'phone', 'app_role', 'blocked', 'coordinator_of', 'sms_prefs'],
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
    /** מקור: "message" (אוסף אתרי הרשת) / "item" (תיבת הקהילה). משמש גם לסיווג. */
    source: string;
    /** category של ה-item (message / admin_alert) — לסיווג */
    category?: string | null;
    /** extra_fields.type של ה-item — לסיווג */
    efType?: string | null;
    /** messages בלבד: יש שולח = צ'אט בין משתמשים */
    hasSender?: boolean;
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
        const who = { admin: isAdminRole(user.app_role), coordinator: isCoordinator(user) };
        if (!who.admin && !who.coordinator) return false;
        if (!isImportantFor(input, who)) {
            strapi.log.info(`${tag} ${user.email ?? user.id}: "${input.efType ?? input.category ?? 'message'}" לא חשובה לתפקיד — תיבה בלבד`);
            return false;
        }

        // ההעדפות שהמנהל בחר בפרופיל: כיבוי כללי או רק קבוצות מסוימות
        const group = classifyGroup(input);
        if (!prefsAllow(user.sms_prefs, group)) {
            strapi.log.info(`${tag} ${user.email ?? user.id}: קבוצה "${group}" כבויה בהעדפות — מדלג`);
            return false;
        }

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
