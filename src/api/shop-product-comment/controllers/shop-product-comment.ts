import { factories } from '@strapi/strapi';
import { createHash } from 'crypto';

// דירוגים ותגובות על מוצרים בחנות החירות - אותו מודל כמו pg-satisfaction-response
// בקבוצות הרכישה: דירוג 1-5 + תגובה, לייק (toggle) ותגובות-לתגובה לכל מחובר,
// ונעיצה / "אהוב על המנהל" / תשובת מנהל למנהל חנות.
// קריאה ציבורית (שדות תצוגה בלבד, בלי מזהי משתמשים); כתיבה - מחובר בלבד, והשם
// והתמונה נגזרים כאן מהמשתמש (לא מהגוף) כדי שאי אפשר יהיה להתחזות. דירוג אחד
// למשתמש למוצר - דירוג חוזר מעדכן את הקודם. מחיקה - הכותב או מנהל חנות.
const UID = 'api::shop-product-comment.shop-product-comment' as const;

const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);
function isShopAdmin(user: any): boolean {
  if (!user) return false;
  if (SUPER_ADMIN_EMAILS.has(String(user.email ?? '').trim().toLowerCase())) return true;
  return ['super_admin', 'shop_admin'].includes(user.app_role);
}

// אותו כלל שם-תצוגה כמו ב-api/_shared.js של החנות: לעולם לא username-מכונה של OAuth
function isMachineUsername(name: string): boolean {
  const n = String(name || '').trim();
  return /^(google|facebook|apple|community|local)[_-]/i.test(n) || /^[a-z][a-z0-9]*[_-]\d{5,}$/i.test(n);
}
function friendlyName(u: any): string {
  const full = [u?.firstname, u?.lastname].filter(Boolean).join(' ').trim();
  const real = String(u?.name || u?.displayName || u?.display_name || full || u?.username || '').trim();
  if (real && !real.includes('@') && !isMachineUsername(real)) return real.slice(0, 80);
  const local = String(u?.email || '').split('@')[0].trim();
  if (!local) return 'משתמש';
  return local.split(/[._-]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, 80);
}
function avatarUrl(u: any): string {
  const stored = u?.avatar_url || u?.picture || u?.avatar || u?.image || '';
  if (typeof stored === 'string' && /^https?:\/\//.test(stored)) return stored.slice(0, 500);
  const email = String(u?.email || '').trim().toLowerCase();
  if (!email) return '';
  return `https://www.gravatar.com/avatar/${createHash('md5').update(email).digest('hex')}?s=80&d=identicon`;
}
const cleanText = (v: unknown, max: number) =>
  String(v ?? '').replace(/<[^>]*>/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

function publicRow(r: any, me: any) {
  const myId = me ? String(me.id) : null;
  const mine = !!myId && String(r.user?.id ?? '') === myId;
  const likedBy: string[] = Array.isArray(r.liked_by) ? r.liked_by.map(String) : [];
  const replies = (Array.isArray(r.replies) ? r.replies : []).map((x: any) => ({
    text: x.text,
    user_name: x.user_name,
    is_admin: !!x.is_admin,
    created_at: x.created_at,
  }));
  return {
    documentId: r.documentId,
    product_id: r.product_id,
    rating: r.rating ?? null,
    body: r.body || '',
    author_name: r.author_name,
    author_avatar: r.author_avatar,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    is_featured: !!r.is_featured,
    admin_liked: !!r.admin_liked,
    admin_reply: r.admin_reply || '',
    likes: likedBy.length,
    liked: !!myId && likedBy.includes(myId),
    replies,
    mine,
    canDelete: mine || isShopAdmin(me),
  };
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // GET /shop-product-comments?product=<id> - נעוצות קודם, אחר כך החדשות
  async find(ctx) {
    const productId = Number(ctx.query?.product);
    if (!Number.isInteger(productId) || productId <= 0) return ctx.badRequest('product חסר');
    const rows: any[] = await strapi.documents(UID).findMany({
      filters: { product_id: { $eq: productId } },
      sort: { createdAt: 'desc' },
      populate: { user: { fields: ['id'] } },
      limit: 300,
    } as any);
    // נעוצות למעלה - ב-JS ולא ב-SQL, כי ב-Postgres NULL (רשומות מלפני השדה) ממוין ראשון ב-DESC
    rows.sort((a, b) => Number(!!b.is_featured) - Number(!!a.is_featured));
    const rated = rows.filter((r) => Number(r.rating) > 0);
    const avg = rated.length ? rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length : 0;
    ctx.body = {
      data: rows.map((r) => publicRow(r, ctx.state?.user)),
      meta: { average: Math.round(avg * 10) / 10, count: rated.length },
      isAdmin: isShopAdmin(ctx.state?.user),
    };
  },

  async findOne(ctx) {
    return ctx.notFound();
  },

  // GET /shop-product-comments/summary - { <product_id>: [ממוצע, מספר דירוגים] } לכרטיסי המוצרים
  async summary(ctx) {
    const rows: any[] = await strapi.documents(UID).findMany({
      filters: { rating: { $gte: 1 } },
      fields: ['product_id', 'rating'],
      limit: 20000,
    } as any);
    const acc: Record<string, [number, number]> = {};
    for (const r of rows) {
      const k = String(r.product_id);
      const a = acc[k] || (acc[k] = [0, 0]);
      a[0] += Number(r.rating);
      a[1] += 1;
    }
    const out: Record<string, [number, number]> = {};
    for (const [k, [sum, n]] of Object.entries(acc)) out[k] = [Math.round((sum / n) * 10) / 10, n];
    ctx.body = { data: out };
  },

  // דירוג + תגובה. דירוג חובה (כמו בקבוצות הרכישה); משתמש שכבר דירג את המוצר - מעדכן
  async create(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('נדרשת הרשמה כדי לדרג ולהגיב');
    const b = (ctx.request.body?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
    const productId = Number(b.product_id);
    if (!Number.isInteger(productId) || productId <= 0) return ctx.badRequest('מוצר לא תקין');
    const rating = Number(b.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return ctx.badRequest('נא לבחור דירוג (1-5 כוכבים)');
    const raw = String(b.body ?? '');
    if (raw.trim().length > 1000) return ctx.badRequest('התגובה ארוכה מדי (עד 1000 תווים)');
    const body = cleanText(raw, 1000);

    const existing: any[] = await strapi.documents(UID).findMany({
      filters: { product_id: { $eq: productId }, user: { id: user.id } },
      limit: 1,
    } as any);
    const data = { rating, body, author_name: friendlyName(user), author_avatar: avatarUrl(user) };
    let row: any;
    if (existing[0]) {
      row = await strapi.documents(UID).update({ documentId: existing[0].documentId, data, populate: { user: { fields: ['id'] } } } as any);
    } else {
      // הצפה: עד 20 דירוגים חדשים בשעה למשתמש
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = await strapi.documents(UID).count({ filters: { user: { id: user.id }, createdAt: { $gt: since } } } as any);
      if (recent >= 20) return ctx.badRequest('יותר מדי דירוגים בשעה האחרונה, נסו שוב מאוחר יותר');
      row = await strapi.documents(UID).create({
        data: { ...data, product_id: productId, user: user.id, likes: 0, liked_by: [], replies: [] },
        populate: { user: { fields: ['id'] } },
      } as any);
    }
    ctx.body = { data: publicRow(row, user), updated: !!existing[0] };
  },

  // מנהל חנות בלבד - נעיצה, "אהוב על המנהל" ותשובת מנהל. הטקסט של הכותב לא נגיע.
  async update(ctx) {
    const user = ctx.state?.user;
    if (!isShopAdmin(user)) return ctx.forbidden('רק מנהל רשאי לעדכן תגובות');
    const body = (ctx.request.body?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
    const allowed: Record<string, unknown> = {};
    if ('is_featured' in body) allowed.is_featured = !!body.is_featured;
    if ('admin_liked' in body) allowed.admin_liked = !!body.admin_liked;
    if ('admin_reply' in body) allowed.admin_reply = body.admin_reply ? cleanText(body.admin_reply, 2000) : null;
    const row: any = await strapi.documents(UID).update({
      documentId: ctx.params.documentId,
      data: allowed,
      populate: { user: { fields: ['id'] } },
    } as any);
    if (!row) return ctx.notFound();
    ctx.body = { data: publicRow(row, user) };
  },

  // לייק ציבורי (toggle) - כל משתמש מחובר; הזיהוי לפי user.id
  async toggleLike(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('נדרשת הרשמה כדי לסמן לייק');
    const entry: any = await strapi.documents(UID).findOne({ documentId: ctx.params.documentId });
    if (!entry) return ctx.notFound();
    const key = String(user.id);
    const likedBy: string[] = Array.isArray(entry.liked_by) ? entry.liked_by.map(String) : [];
    const i = likedBy.indexOf(key);
    const liked = i < 0;
    if (liked) likedBy.push(key);
    else likedBy.splice(i, 1);
    await strapi.documents(UID).update({ documentId: entry.documentId, data: { liked_by: likedBy, likes: likedBy.length } } as any);
    ctx.body = { likes: likedBy.length, liked };
  },

  // תגובה לתגובה - כל משתמש מחובר; נשמרות כמערך JSON על התגובה
  async addReply(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('נדרשת הרשמה כדי להגיב');
    const b = (ctx.request.body?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
    const text = cleanText(b.text, 1000);
    if (text.length < 2) return ctx.badRequest('התגובה ריקה');
    const entry: any = await strapi.documents(UID).findOne({ documentId: ctx.params.documentId });
    if (!entry) return ctx.notFound();
    const replies: any[] = Array.isArray(entry.replies) ? entry.replies : [];
    if (replies.length >= 200) return ctx.badRequest('יותר מדי תגובות לתגובה הזו');
    replies.push({
      text,
      user_id: String(user.id),
      user_name: friendlyName(user),
      is_admin: isShopAdmin(user),
      created_at: new Date().toISOString(),
    });
    const row: any = await strapi.documents(UID).update({
      documentId: entry.documentId,
      data: { replies },
      populate: { user: { fields: ['id'] } },
    } as any);
    ctx.body = { replies: publicRow(row, user).replies };
  },

  async delete(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized();
    const row: any = await strapi.documents(UID).findOne({ documentId: ctx.params.documentId, populate: { user: { fields: ['id'] } } } as any);
    if (!row) return ctx.notFound();
    if (String(row.user?.id ?? '') !== String(user.id) && !isShopAdmin(user)) return ctx.forbidden('אפשר למחוק רק תגובה שלך');
    await strapi.documents(UID).delete({ documentId: row.documentId });
    ctx.body = { ok: true };
  },
}));
