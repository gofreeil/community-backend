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

function owns(user: any, entry: any): boolean {
  if (!user) return false;
  const uid = String(user.id);
  return String(entry?.user?.id ?? entry?.user_id ?? '') === uid;
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // ציבורי/רגיל רואה רק approved; מנהל רואה הכל. משתמשים ב-$and כדי שלא ניתן
  // לעקוף את סינון הסטטוס דרך filters מהלקוח.
  async find(ctx) {
    if (!isPrivileged(ctx.state?.user)) {
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
    if (
      data &&
      data.status !== 'approved' &&
      !isPrivileged(ctx.state?.user) &&
      !owns(ctx.state?.user, data)
    ) {
      return ctx.notFound();
    }
    return res;
  },

  // הגשה: כופים pending ומנקים שדות-מערכת שאסור ללקוח לקבוע. מצרפים בעלים אם מחובר.
  async create(ctx) {
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    const user = ctx.state?.user;
    ctx.request.body = {
      data: {
        ...body,
        status: 'pending',
        view_count: 0,
        phone_reveal_count: 0,
        rating_avg: 0,
        rating_count: 0,
        user: user?.id ?? (body.user as unknown) ?? null,
        user_id: user ? String(user.id) : ((body.user_id as string) ?? null),
      },
    };
    return super.create(ctx);
  },

  // עריכה: בעל העסק או מנהל בלבד. בעלים אינו יכול לשנות status בעצמו.
  async update(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('נדרשת התחברות');
    const { documentId } = ctx.params;
    const entry = await strapi.documents(UID).findOne({ documentId, populate: ['user'] });
    if (!entry) return ctx.notFound();
    if (!isPrivileged(user) && !owns(user, entry)) return ctx.forbidden('אין הרשאה לערוך עסק זה');

    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    if (!isPrivileged(user)) {
      delete (body as any).status;
      delete (body as any).rating_avg;
      delete (body as any).rating_count;
      delete (body as any).view_count;
      delete (body as any).phone_reveal_count;
      delete (body as any).user;
      delete (body as any).user_id;
    }
    ctx.request.body = { data: body };
    return super.update(ctx);
  },

  async delete(ctx) {
    if (!isPrivileged(ctx.state?.user)) return ctx.forbidden('רק מנהל רשאי למחוק');
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
}));
