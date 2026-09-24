import { factories } from '@strapi/strapi';
import { createHash } from 'crypto';

// תגובות על מוצרים בחנות החירות. קריאה ציבורית (רק שדות תצוגה, בלי פרטי משתמש);
// כתיבה - משתמש מחובר בלבד, והשם/התמונה נגזרים כאן מהמשתמש (לא מהגוף) כדי שאי
// אפשר יהיה להתחזות. מחיקה - כותב התגובה או מנהל חנות. אין עריכה.
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

function publicRow(r: any, me: any) {
  const mine = !!me && String(r.user?.id ?? '') === String(me.id);
  return {
    documentId: r.documentId,
    product_id: r.product_id,
    body: r.body,
    author_name: r.author_name,
    author_avatar: r.author_avatar,
    createdAt: r.createdAt,
    canDelete: mine || isShopAdmin(me),
  };
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // GET /shop-product-comments?product=<id> - החדשות קודם
  async find(ctx) {
    const productId = Number(ctx.query?.product);
    if (!Number.isInteger(productId) || productId <= 0) return ctx.badRequest('product חסר');
    const rows: any[] = await strapi.documents(UID).findMany({
      filters: { product_id: { $eq: productId } },
      sort: { createdAt: 'desc' },
      populate: { user: { fields: ['id'] } },
      limit: 200,
    } as any);
    ctx.body = { data: rows.map((r) => publicRow(r, ctx.state?.user)) };
  },

  async findOne(ctx) {
    return ctx.notFound();
  },

  async create(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('יש להתחבר כדי להגיב');
    const b = (ctx.request.body?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
    const productId = Number(b.product_id);
    if (!Number.isInteger(productId) || productId <= 0) return ctx.badRequest('מוצר לא תקין');
    const body = String(b.body ?? '').replace(/<[^>]*>/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (body.length < 2) return ctx.badRequest('התגובה ריקה');
    if (body.length > 1000) return ctx.badRequest('התגובה ארוכה מדי (עד 1000 תווים)');
    // הצפה: עד 10 תגובות בשעה למשתמש
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await strapi.documents(UID).count({ filters: { user: { id: user.id }, createdAt: { $gt: since } } } as any);
    if (recent >= 10) return ctx.badRequest('יותר מדי תגובות בשעה האחרונה, נסו שוב מאוחר יותר');
    const row: any = await strapi.documents(UID).create({
      data: {
        product_id: productId,
        body,
        author_name: friendlyName(user),
        author_avatar: avatarUrl(user),
        user: user.id,
      },
      populate: { user: { fields: ['id'] } },
    } as any);
    ctx.body = { data: publicRow(row, user) };
  },

  async update(ctx) {
    return ctx.forbidden('לא ניתן לערוך תגובה');
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
