/**
 * חיבור "יוצאים לחירות" לאתרים חיצוניים (חירות TV) שאינם תלויים בדומיין ובעוגייה משותפת.
 *
 *  1. פתיחת חשבונות: האתר החיצוני מושך את הנרשמים (POST /api/external-sso/users).
 *  2. כניסה בלחיצה: המשתמש המחובר מקבל קוד חד-פעמי (POST /api/external-sso/code), והאתר מחליף אותו
 *     בפרטים (POST /api/external-sso/exchange).
 *
 * הבקשות של האתר חתומות ב-Ed25519; כאן יש רק את המפתח הציבורי, ולכן אין סוד להעתיק בין שרתים.
 * מעבר דומיין: להוסיף את כתובת החזרה החדשה ב-redirects (או ב-env) - זה השינוי היחיד בצד הזה.
 *
 * קובץ זה לוגיקה טהורה (בלי strapi), כדי שאפשר לבדוק אותו לבד.
 */
import { createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'crypto';

export interface ExternalSite {
    /** מפתח ציבורי Ed25519 (base64 של 32 בתים) */
    publicKey: string;
    /** הכתובות היחידות שאליהן מותר להחזיר קוד כניסה (התאמה מדויקת) */
    redirects: string[];
}

/** חלון הזמן לחתימה. רחב בכוונה: שעון שרת ה-TV לא מסונכרן ומפגר בכמה דקות. */
export const SIGNATURE_WINDOW_SECONDS = 900;
export const CODE_TTL_SECONDS = 120;
export const MAX_PAGE = 50;
const MAX_INLINE_AVATAR = 1_500_000;
const PHONE_EMAIL_DOMAIN = '@phone.gofreeil.com';

const DEFAULT_SITES: Record<string, ExternalSite> = {
    tv: {
        // מהמסך "מצב החיבור" של הפלאגין YotzimLeherut בשרת ה-TV (מפתח ציבורי - לא סוד)
        publicKey: 'Oy98IW+DDVOhWbiSO4Ok5z8AY5UJLmCQfNgMVLU1Emg=',
        redirects: ['https://tv.gofreeil.com/plugin/YotzimLeherut/callback.php'],
    },
};

/** env לכל אתר: EXTERNAL_SITE_<KEY>_PUBKEY, EXTERNAL_SITE_<KEY>_REDIRECTS (מופרדות בפסיק) */
export function getExternalSite(key: unknown, env: Record<string, string | undefined> = process.env): ExternalSite | null {
    if (typeof key !== 'string' || !/^[a-z0-9]{1,20}$/.test(key) || !Object.prototype.hasOwnProperty.call(DEFAULT_SITES, key)) {
        return null;
    }
    const base = DEFAULT_SITES[key];
    const prefix = `EXTERNAL_SITE_${key.toUpperCase()}_`;
    const redirects = (env[`${prefix}REDIRECTS`] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return {
        publicKey: (env[`${prefix}PUBKEY`] ?? '').trim() || base.publicKey,
        redirects: redirects.length ? redirects : base.redirects,
    };
}

export function verifySignature(
    publicKey: string,
    timestamp: unknown,
    signature: unknown,
    action: string,
    payload: unknown,
    nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
    if (typeof timestamp !== 'string' || !/^\d{9,12}$/.test(timestamp)) return false;
    if (typeof signature !== 'string' || typeof payload !== 'string' || payload.length > 4000) return false;
    if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_WINDOW_SECONDS) return false;
    const raw = Buffer.from(publicKey || '', 'base64');
    if (raw.length !== 32) return false;
    try {
        const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: raw.toString('base64url') }, format: 'jwk' });
        // אותו מבנה כמו YlLogic::signingMessage בצד ה-TV
        return verify(null, Buffer.from(`${timestamp}\n${action}\n${payload}`, 'utf8'), key, Buffer.from(signature, 'base64'));
    } catch {
        return false;
    }
}

export interface CodeData {
    userId: number;
    site: string;
    redirectUri: string;
    jti: string;
    exp: number;
}

function mac(secret: string, body: string): Buffer {
    const key = createHmac('sha256', secret).update('external-sso-code-v1').digest();
    return createHmac('sha256', key).update(body).digest();
}

export function createCode(
    secret: string,
    data: { userId: number; site: string; redirectUri: string },
    nowSeconds = Math.floor(Date.now() / 1000),
): string {
    if (!secret) throw new Error('missing secret');
    const full: CodeData = { ...data, jti: randomBytes(12).toString('base64url'), exp: nowSeconds + CODE_TTL_SECONDS };
    const body = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
    return `${body}.${mac(secret, body).toString('base64url')}`;
}

export function readCode(secret: string, code: unknown, nowSeconds = Math.floor(Date.now() / 1000)): CodeData | null {
    if (!secret || typeof code !== 'string' || code.length > 1500) return null;
    const [body, sig, extra] = code.split('.');
    if (!body || !sig || extra !== undefined) return null;
    const expected = mac(secret, body);
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
        const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CodeData;
        return data.exp >= nowSeconds && Number.isInteger(data.userId) && data.jti ? data : null;
    } catch {
        return null;
    }
}

/** שם שמותר להציג בפומבי: לא אימייל, לא טלפון ולא מזהה-מכונה (google_123, credentials_...) */
export function isPublicName(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const v = value.trim();
    if (!v || v.includes('@') || /^[\d\s()+.-]+$/.test(v)) return false;
    return !/^(credentials|google|facebook|apple|phone)_/i.test(v) && !/^[a-z][a-z0-9]*[_-]\d{5,}$/i.test(v);
}

export function publicName(user: { nickname?: unknown; username?: unknown }): string {
    if (isPublicName(user.nickname)) return user.nickname.trim().slice(0, 60);
    if (isPublicName(user.username)) return user.username.trim().slice(0, 60);
    return '';
}

export function publicAvatar(value: unknown): string {
    if (typeof value !== 'string') return '';
    const v = value.trim();
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)) return v.length <= MAX_INLINE_AVATAR ? v : '';
    return /^https:\/\//i.test(v) && v.length <= 2000 ? v : '';
}

/** תמונת ספק-התחברות (Google/Facebook) - היחידה שאתר ברשת רשאי לשמור אוטומטית בהרשמה */
export function isProviderAvatarUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 2000) return false;
    try {
        const u = new URL(value);
        return u.protocol === 'https:' && /(^|\.)(googleusercontent\.com|fbcdn\.net|fbsbx\.com|graph\.facebook\.com)$/.test(u.hostname);
    } catch {
        return false;
    }
}

/** מה אתר חיצוני מקבל על משתמש - רק מה שדרוש לפתוח חשבון */
export function toExternalUser(user: any) {
    const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : '');
    return {
        id: user.id,
        email: String(user.email ?? '').trim().toLowerCase(),
        name: publicName(user),
        avatar: publicAvatar(user.avatar_url),
        phoneOnly: String(user.email ?? '').toLowerCase().endsWith(PHONE_EMAIL_DOMAIN),
        createdAt: iso(user.createdAt),
        updatedAt: iso(user.updatedAt),
    };
}

/** תנאי השליפה לדף אחד: נרשמים מאושרים ולא חסומים, שנוצרו מ-createdAfter ועודכנו אחרי הסמן */
export function usersQuery(input: any): { where: any; limit: number } | null {
    const date = (v: unknown): Date | null => {
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(v)) return null;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    };
    const createdAfter = date(input?.createdAfter);
    if (!createdAfter) return null;
    const limit = Math.min(Math.max(Math.trunc(Number(input?.limit)) || 25, 1), MAX_PAGE);
    const and: any[] = [
        { confirmed: true },
        { $or: [{ blocked: false }, { blocked: { $null: true } }] },
        { createdAt: { $gte: createdAfter } },
    ];
    if (input.cursorTime) {
        const at = date(input.cursorTime);
        const id = Number(input.cursorId);
        if (!at || !Number.isInteger(id) || id < 0) return null;
        const next = new Date(at.getTime() + 1);
        and.push({
            $or: [
                { updatedAt: { $gte: next } },
                { $and: [{ updatedAt: { $gte: at } }, { updatedAt: { $lt: next } }, { id: { $gt: id } }] },
            ],
        });
    }
    return { where: { $and: and }, limit };
}
