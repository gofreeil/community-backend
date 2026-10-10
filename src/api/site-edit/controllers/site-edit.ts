/**
 * site-edit — עריכת כיתובי האתרים מתוך האתר, פעם אחת לכל הרשת.
 *
 * במקום לשכפל לכל אתר את מנגנון העריכה (אימות, אחסון, נקודות קצה) — הכול כאן, והאתרים טוענים
 * רק סקריפט אחד (public/site-editor.js, תג <script> ב-app.html). מה שנערך נשמר לפי האתר (site)
 * ולפי הטקסט המקורי: { "<הטקסט בקוד>": "<הטקסט שנערך>" }; הסקריפט מחליף בדפדפן כל text-node
 * שתוכנו זהה למפתח. הטקסטים מוצגים כ-textContent בלבד (לעולם לא HTML).
 *
 * אחסון: רשומת items אחת לכל אתר (category=site_texts, label=<site>, status1=inactive,
 * extra_fields.texts) — אותה קולקציה כמו שאר הרשת, בלי סוג תוכן חדש.
 *
 * הרשאה: זיהוי מהעוגייה המשותפת gofreeil-auth (JWT של users-permissions) או Bearer; חייב להיות
 * סופר-אדמין (isPrivilegedUser), ובנוסף קוד Google Authenticator (SUPER_ADMIN_TOTP_SECRET) שמוחלף
 * בעוגיית עריכה חתומה, httpOnly, ל-12 שעות — משותפת לכל סאב-דומיין, כך שמאמתים פעם אחת לכל האתרים.
 * כך גם עוגיית התחברות שדלפה לא מספיקה כדי לשנות אתר.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { isPrivilegedUser } from '../../../utils/crAccess';

const ITEM = 'api::item.item';
const USER = 'plugin::users-permissions.user';
const CATEGORY = 'site_texts';
const AUTH_COOKIE = 'gofreeil-auth';
const EDIT_COOKIE = 'gf-site-edit';
const EDIT_TTL_SEC = 12 * 60 * 60;
const STEP_SECONDS = 30;

const SITE_RE = /^[a-z0-9-]{1,40}$/;
const MAX_TEXT_LEN = 2000;
const MAX_ENTRIES = 500;

// ניסיונות שגויים: 5 לכל 10 דקות למשתמש (בזיכרון המופע; 6 ספרות עם חלון של 30 שניות לא נפרצות בכמה ניסיונות)
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

// מטמון קצר לקריאה הציבורית — כל כניסה לכל אתר שואלת אותה
const TEXTS_TTL_MS = 10_000;
const textsCache = new Map<string, { at: number; texts: Record<string, string> }>();

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) — הסוד base32 משותף לכל הרשת, כמו ב-Google Authenticator שכבר מוגדר
// ---------------------------------------------------------------------------

const secret = () => String(process.env.SUPER_ADMIN_TOTP_SECRET ?? '').replace(/\s+/g, '').toUpperCase();
const totpConfigured = () => secret().length >= 16;

function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, '')) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error('bad base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(buf).digest();
  const offset = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** סבילות של צעד אחד לכל כיוון (שעון לא מסונכרן) */
function checkCode(code: string): boolean {
  const clean = String(code ?? '').replace(/\D/g, '');
  if (clean.length !== 6 || !totpConfigured()) return false;
  const key = base32Decode(secret());
  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  return [0, -1, 1].some((drift) => safeEqual(hotp(key, now + drift), clean));
}

const sign = (payload: string) => createHmac('sha256', `site-edit:${secret()}`).update(payload).digest('hex');

// ---------------------------------------------------------------------------
// זיהוי
// ---------------------------------------------------------------------------

/** המשתמש המחובר: עוגייה משותפת (httpOnly) או Bearer. null = אורח / טוקן פגום / חסום. */
async function currentUser(ctx: any): Promise<any | null> {
  const header = String(ctx.request.header?.authorization ?? '');
  const token = ctx.cookies.get(AUTH_COOKIE) || (header.startsWith('Bearer ') ? header.slice(7).trim() : '');
  if (!token) return null;
  try {
    const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
    if (!payload?.id) return null;
    const user = await strapi.db.query(USER).findOne({ where: { id: payload.id } });
    return user && !user.blocked ? user : null;
  } catch {
    return null;
  }
}

/** האם עוגיית העריכה (אחרי קוד Authenticator) תקפה ושייכת למשתמש הזה */
function editVerified(ctx: any, user: any): boolean {
  if (!totpConfigured()) return false;
  const [id, exp, sig] = String(ctx.cookies.get(EDIT_COOKIE) ?? '').split('.');
  if (!id || !exp || !sig || id !== String(user.id) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(`${id}.${exp}`));
}

/** עוגייה משותפת לכל *.gofreeil.com; בפיתוח (localhost) בלי Domain/Secure. נכתבת ידנית — בלי בדיקות secure של Koa. */
function setEditCookie(ctx: any, value: string, maxAgeSec: number) {
  const prod = /(^|\.)gofreeil\.com$/.test(String(ctx.request.hostname ?? ''));
  const attrs = [`${EDIT_COOKIE}=${value}`, 'Path=/', `Max-Age=${maxAgeSec}`, 'HttpOnly', 'SameSite=Strict'];
  if (prod) attrs.push('Domain=.gofreeil.com', 'Secure');
  ctx.append('Set-Cookie', attrs.join('; '));
}

function fail(ctx: any, status: number, error: string) {
  ctx.status = status;
  ctx.body = { error };
}

const noStore = (ctx: any) => ctx.set('Cache-Control', 'private, no-store');

// ---------------------------------------------------------------------------
// אחסון
// ---------------------------------------------------------------------------

function parseTexts(extra: unknown): Record<string, string> {
  let ef: any = extra;
  if (typeof ef === 'string') {
    try { ef = JSON.parse(ef); } catch { ef = null; }
  }
  const raw = ef?.texts;
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** הרשומה המפורסמת של האתר (לא הטיוטה) */
async function findRow(site: string) {
  return strapi.db.query(ITEM).findOne({
    where: { category: CATEGORY, label: site, publishedAt: { $notNull: true } },
  });
}

async function readTexts(site: string): Promise<Record<string, string>> {
  const hit = textsCache.get(site);
  if (hit && Date.now() - hit.at < TEXTS_TTL_MS) return hit.texts;
  const row = await findRow(site);
  const texts = row ? parseTexts(row.extra_fields) : {};
  textsCache.set(site, { at: Date.now(), texts });
  return texts;
}

// ---------------------------------------------------------------------------
// נקודות הקצה
// ---------------------------------------------------------------------------

export default {
  /** GET /site-edit/texts?site= — ציבורי */
  async texts(ctx: any) {
    const site = String(ctx.query?.site ?? '').toLowerCase();
    if (!SITE_RE.test(site)) return fail(ctx, 400, 'site לא תקין');
    try {
      ctx.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      ctx.body = { texts: await readTexts(site) };
    } catch (e) {
      strapi.log.warn(`[site-edit] texts failed for ${site}: ${(e as Error)?.message}`);
      noStore(ctx);
      ctx.body = { texts: {} };
    }
  },

  /** GET /site-edit/me — הגלגל מוצג רק לסופר-אדמין. אורח מקבל תשובה זולה בלי שאילתה. */
  async me(ctx: any) {
    noStore(ctx);
    ctx.set('Vary', 'Origin, Cookie');
    const user = await currentUser(ctx);
    if (!user || !isPrivilegedUser(user)) {
      ctx.body = { superAdmin: false, verified: false, configured: false };
      return;
    }
    ctx.body = { superAdmin: true, verified: editVerified(ctx, user), configured: totpConfigured() };
  },

  /** POST /site-edit/verify { code } — מחליף קוד Authenticator בעוגיית עריכה ל-12 שעות */
  async verify(ctx: any) {
    noStore(ctx);
    const user = await currentUser(ctx);
    if (!user || !isPrivilegedUser(user)) return fail(ctx, 403, 'אין הרשאה');
    if (!totpConfigured()) return fail(ctx, 503, 'אימות דו-שלבי לא הוגדר בשרת (SUPER_ADMIN_TOTP_SECRET)');

    const id = String(user.id);
    const now = Date.now();
    const rec = attempts.get(id);
    if (rec && rec.resetAt > now && rec.count >= MAX_ATTEMPTS) {
      return fail(ctx, 429, 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות');
    }

    const code = String((ctx.request.body as { code?: unknown })?.code ?? '');
    if (!checkCode(code)) {
      const next = rec && rec.resetAt > now ? rec : { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
      next.count += 1;
      attempts.set(id, next);
      return fail(ctx, 401, 'הקוד שגוי');
    }

    attempts.delete(id);
    const payload = `${id}.${now + EDIT_TTL_SEC * 1000}`;
    setEditCookie(ctx, `${payload}.${sign(payload)}`, EDIT_TTL_SEC);
    ctx.body = { ok: true };
  },

  /**
   * POST /site-edit/save { site, texts: { "<מקור>": "<חדש>" } } — רק מה שנשלח משתנה.
   * ערך ריק או זהה למקור מוחק את הדריסה (חזרה לקוד). מחזיר את המפה המלאה החדשה.
   */
  async save(ctx: any) {
    noStore(ctx);
    const user = await currentUser(ctx);
    if (!user || !isPrivilegedUser(user)) return fail(ctx, 403, 'אין הרשאה');
    if (!editVerified(ctx, user)) return fail(ctx, 401, 'נדרש אימות קוד');
    // כותרת מותאמת אישית כופה preflight (CORS) — מונעת שליחת טופס חוצת-אתרים בעוגיות הגולש
    if (ctx.request.header?.['x-requested-with'] !== 'gf-site-edit') return fail(ctx, 403, 'בקשה לא תקינה');

    const body = (ctx.request.body ?? {}) as { site?: unknown; texts?: unknown };
    const site = String(body.site ?? '').toLowerCase();
    if (!SITE_RE.test(site)) return fail(ctx, 400, 'site לא תקין');
    const patch = body.texts;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return fail(ctx, 400, 'נתונים לא תקינים');
    const entries = Object.entries(patch as Record<string, unknown>);
    if (entries.length > MAX_ENTRIES) return fail(ctx, 400, 'יותר מדי שינויים בבת אחת');

    try {
      const row = await findRow(site);
      const texts = row ? parseTexts(row.extra_fields) : {};
      for (const [original, raw] of entries) {
        if (!original || original.length > MAX_TEXT_LEN || typeof raw !== 'string') continue;
        const value = raw.replace(/\r\n/g, '\n').trim();
        if (!value || value === original || value.length > MAX_TEXT_LEN) delete texts[original];
        else texts[original] = value;
      }
      if (Object.keys(texts).length > MAX_ENTRIES) return fail(ctx, 400, 'יותר מדי כיתובים ערוכים');

      if (row) {
        await strapi.db.query(ITEM).update({ where: { id: row.id }, data: { extra_fields: { texts } } });
      } else {
        // Documents API — מייצר documentId ורשומה מפורסמת, כמו כל item שנוצר ברשת
        await strapi.documents(ITEM).create({
          data: { category: CATEGORY, label: site, status1: 'inactive', extra_fields: { texts } } as any,
          status: 'published',
        });
      }
      textsCache.set(site, { at: Date.now(), texts });
      ctx.body = { ok: true, texts };
    } catch (e) {
      strapi.log.error(`[site-edit] save failed for ${site}: ${(e as Error)?.message}`);
      return fail(ctx, 502, 'השמירה נכשלה. נסו שוב בעוד רגע');
    }
  },
};
