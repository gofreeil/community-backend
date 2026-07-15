import { factories } from '@strapi/strapi';

// אינדקס בעלי המקצוע (index.gofreeil.com) — collection מבודד.
// ציבורי רואה רק status=approved; בעלים/מנהל רואים הכל. יצירה כופה pending.
// אכיפת בעלות/תפקיד כאן ב-controller לפי ctx.state.user (ההרשאות ניתנות ב-src/index.ts).
const UID = 'api::idx-business.idx-business' as const;
const TABLE = 'idx_businesses';

// בעלי האתר — מנהלים גם בלי app_role בבאקאנד (רשת ביטחון, כמו ב-ch-*)
const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);

function isPrivileged(user: any): boolean {
  if (!user) return false;
  const email = String(user.email ?? '').trim().toLowerCase();
  if (SUPER_ADMIN_EMAILS.has(email)) return true;
  return ['super_admin', 'idx_admin', 'ch_admin'].includes(user.app_role);
}

// אמון: משתמש מורשה, או קריאת שרת-לשרת עם API Token (STRAPI_TOKEN) — הפרונט של
// index משתמש בטוקן לכל הכתיבות/הקריאות המנהליות (shim, ייבוא, מודרציה). קריאות
// ציבוריות מהדפדפן (role public, בלי טוקן) אינן trusted → רואות רק approved.
function isTrusted(ctx: any): boolean {
  if (ctx?.state?.auth?.strategy?.name === 'api-token') return true;
  return isPrivileged(ctx?.state?.user);
}

function owns(user: any, entry: any): boolean {
  if (!user) return false;
  const uid = String(user.id);
  return String(entry?.user?.id ?? entry?.user_id ?? '') === uid;
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // ציבורי/רגיל רואה רק approved; מנהל רואה הכל. משתמשים ב-$and כדי שלא ניתן
  // לעקוף את סינון הסטטוס דרך filters מהלקוח.
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

  async findOne(ctx) {
    const res = await super.findOne(ctx);
    const data: any = (res as any)?.data;
    if (data && data.status !== 'approved' && !isTrusted(ctx) && !owns(ctx.state?.user, data)) {
      return ctx.notFound();
    }
    return res;
  },

  // הגשה: משתמש-קצה (JWT) נכפה ל-pending ושדות-מערכת מאופסים. שרת מהימן (API Token)
  // — למשל סקריפט הייבוא — רשאי לקבוע status (ברירת מחדל pending אם לא נשלח).
  async create(ctx) {
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    const user = ctx.state?.user;
    const trusted = isTrusted(ctx);
    ctx.request.body = {
      data: {
        ...body,
        status: trusted ? ((body.status as string) ?? 'pending') : 'pending',
        ...(trusted
          ? {}
          : { view_count: 0, phone_reveal_count: 0, rating_avg: 0, rating_count: 0 }),
        user: (body.user as unknown) ?? user?.id ?? null,
        user_id: (body.user_id as string) ?? (user ? String(user.id) : null),
      },
    };
    return super.create(ctx);
  },

  // עריכה: שרת מהימן / מנהל / בעל העסק. בעלים (לא-מהימן) אינו יכול לשנות status/מונים.
  // שרת מהימן עובר ישר ל-core update (מוצא לפי documentId). בעלים — בדיקת בעלות
  // עם strapi.db.query (אמין; documents().findOne+populate החזיר null בגרסה זו).
  async update(ctx) {
    const trusted = isTrusted(ctx);
    if (!trusted) {
      const user = ctx.state?.user;
      if (!user) return ctx.unauthorized('נדרשת התחברות');
      const { documentId } = ctx.params;
      const entry = await strapi.db.query(UID).findOne({
        where: { document_id: documentId },
        populate: ['user'],
      });
      if (!entry) return ctx.notFound();
      if (!owns(user, entry)) return ctx.forbidden('אין הרשאה לערוך עסק זה');

      const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
      delete (body as any).status;
      delete (body as any).rating_avg;
      delete (body as any).rating_count;
      delete (body as any).view_count;
      delete (body as any).phone_reveal_count;
      delete (body as any).user;
      delete (body as any).user_id;
      ctx.request.body = { data: body };
    }
    return super.update(ctx);
  },

  async delete(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל רשאי למחוק');
    return super.delete(ctx);
  },

  // GET /idx-businesses/mine — העסקים של המשתמש המחובר (כולל pending/rejected).
  async mine(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('נדרשת התחברות');
    const rows = await strapi.documents(UID).findMany({
      filters: { user: { id: { $eq: user.id } } },
      sort: { createdAt: 'desc' },
      populate: ['logo'],
    });
    ctx.body = { data: rows };
  },

  // POST /idx-businesses/:documentId/view — מונה צפיות אטומי (עמיד למקבילות).
  async view(ctx) {
    const { documentId } = ctx.params;
    const row = await strapi.db.query(UID).findOne({ where: { document_id: documentId } });
    if (!row) return ctx.notFound();
    await strapi.db.connection(TABLE).where({ id: row.id }).increment('view_count', 1);
    ctx.body = { ok: true };
  },

  // POST /idx-businesses/:documentId/reveal-phone — מונה חשיפות טלפון אטומי; מחזיר את הטלפון.
  async revealPhone(ctx) {
    const { documentId } = ctx.params;
    const row = await strapi.db.query(UID).findOne({ where: { document_id: documentId } });
    if (!row || row.status !== 'approved') return ctx.notFound();
    await strapi.db.connection(TABLE).where({ id: row.id }).increment('phone_reveal_count', 1);
    ctx.body = { ok: true, phone: row.phone ?? '' };
  },

  // POST /idx-businesses/:documentId/recompute-rating — חישוב-מחדש של דירוג העסק
  // מהביקורות המאושרות שלו. הפרונט (מסך המודרציה) קורא לזה עם ה-documentId של העסק
  // אחרי אישור/דחיית ביקורת. משתמש באותו סינון ש-listReviews עובד איתו (business.
  // documentId + status=approved) — בלי חיפוש-relation מצד הביקורת (שהחזיר null בגרסה זו).
  async recomputeRating(ctx) {
    const { documentId } = ctx.params;
    const approved: any[] = await strapi.documents('api::idx-review.idx-review').findMany({
      filters: { business: { documentId }, status: 'approved' },
      fields: ['rating'],
      pagination: { pageSize: 500 },
    });
    const count = approved.length;
    const avg = count ? approved.reduce((s, r) => s + Number(r.rating || 0), 0) / count : 0;
    const rounded = Math.round(avg * 100) / 100;
    const row = await strapi.db.query(UID).findOne({ where: { document_id: documentId } });
    if (!row) return ctx.notFound();
    await strapi.db
      .connection(TABLE)
      .where({ id: row.id })
      .update({ rating_avg: rounded, rating_count: count });
    ctx.body = { ok: true, rating_avg: rounded, rating_count: count };
  },
}));
