import { factories } from '@strapi/strapi';

// ביקורות על עסקי האינדקס. הגשה כופה status=pending (מודרציה חובה — ביקורת על
// עסק של אדם אחר). ציבורי רואה רק approved. אישור ביקורת (ע"י מנהל) מריץ חישוב-מחדש
// אטומי של הדירוג הממוצע על העסק. הקשר ל-business הוא relation אמיתי (FK) — ביקורת
// לעולם לא תצביע על עסק לא-קיים או על העסק הלא-נכון.
const UID = 'api::idx-review.idx-review' as const;
const BIZ_UID = 'api::idx-business.idx-business' as const;
const BIZ_TABLE = 'idx_businesses';

const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);

function isPrivileged(user: any): boolean {
  if (!user) return false;
  const email = String(user.email ?? '').trim().toLowerCase();
  if (SUPER_ADMIN_EMAILS.has(email)) return true;
  return ['super_admin', 'idx_admin', 'ch_admin'].includes(user.app_role);
}

// אמון: משתמש מורשה, או שרת-לשרת עם API Token (מודרציה מהפרונט של index).
function isTrusted(ctx: any): boolean {
  if (ctx?.state?.auth?.strategy?.name === 'api-token') return true;
  return isPrivileged(ctx?.state?.user);
}

async function recomputeRating(strapi: any, businessId: number) {
  const rows: any[] = await strapi.db
    .query(UID)
    .findMany({ where: { business: businessId, status: 'approved' } });
  const count = rows.length;
  const avg = count ? rows.reduce((s, r) => s + Number(r.rating || 0), 0) / count : 0;
  await strapi.db
    .connection(BIZ_TABLE)
    .where({ id: businessId })
    .update({ rating_avg: Math.round(avg * 100) / 100, rating_count: count });
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    if (!isTrusted(ctx)) {
      const clientFilters = (ctx.query?.filters as object) ?? {};
      ctx.query = {
        ...ctx.query,
        filters: { $and: [clientFilters, { status: { $eq: 'approved' } }] },
      };
    }
    return super.find(ctx);
  },

  // הגשה: כופה pending, מצרף בעלים אם מחובר, מנקה שדות-מערכת.
  async create(ctx) {
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    const user = ctx.state?.user;
    const rating = Math.max(1, Math.min(5, Number(body.rating) || 0));
    if (!rating) return ctx.badRequest('דירוג חובה (1-5)');
    if (!body.business && !body.business_slug) return ctx.badRequest('חסר עסק');

    ctx.request.body = {
      data: {
        business: body.business ?? null,
        business_slug: body.business_slug ?? null,
        rating,
        title: body.title ?? null,
        body: body.body ?? null,
        author_name: body.author_name ?? null,
        author_city: body.author_city ?? null,
        status: 'pending',
        is_featured: false,
        admin_reply: null,
        submitted_at: new Date().toISOString(),
        user: user?.id ?? null,
        user_id: user ? String(user.id) : null,
      },
    };
    return super.create(ctx);
  },

  // עדכון (אישור/פסילה/מענה) — מנהל/שרת-מהימן בלבד. אחרי עדכון מחשבים מחדש דירוג העסק.
  async update(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל רשאי לעדכן ביקורות');
    const res = await super.update(ctx);
    const { documentId } = ctx.params;
    const rev: any = await strapi.documents(UID).findOne({ documentId, populate: ['business'] });
    if (rev?.business?.id) await recomputeRating(strapi, rev.business.id);
    return res;
  },

  async delete(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל רשאי למחוק');
    const { documentId } = ctx.params;
    const rev: any = await strapi.documents(UID).findOne({ documentId, populate: ['business'] });
    const bizId = rev?.business?.id;
    const res = await super.delete(ctx);
    if (bizId) await recomputeRating(strapi, bizId);
    return res;
  },
}));
