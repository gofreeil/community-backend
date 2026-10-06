import { factories } from '@strapi/strapi';
import { clampInt, cleanText, docIdList, filtersAreSafe, isTrusted } from '../../../utils/crAccess';

// חדשות "מבקר רשויות המדינה" (ארציות + לפי עיר). נפרד מ-post של הקהילה בכוונה: ל-post יש
// פיד ציבורי (/api/community-news) והחדשות כאן לא אמורות להיכנס אליו.
//
//  - ציבורי רואה רק חדשות מאושרות ולא-מאורכבות. כתובות מייל לא יוצאות החוצה (רק username של הכותב).
//  - הגשה (מחובר) תמיד נכנסת כ-pending_moderation, הכותב הוא המשתמש המחובר, רק שדות מותרים.
//  - אישור/דחייה/ארכוב/עריכה — API Token של שרת האתר בלבד, אחרי שהוא בדק שהמשתמש מודרטור.
const UID = 'api::cr-post.cr-post' as const;

const SAFE_FILTER_KEYS = new Set([
    'id', 'documentId', 'title', 'category', 'cities', 'name', 'locale2', 'publishDate', 'createdAt',
]);
const SORTS = new Set(['publishDate:desc', 'publishDate:asc', 'createdAt:desc', 'createdAt:asc']);

function populateFor(trusted: boolean) {
    return {
        imageUrl: { fields: ['url', 'alternativeText'] },
        author: { fields: trusted ? ['username', 'email'] : ['username'] },
        cities: { fields: ['name'] },
    };
}

function shape(entry: any, trusted: boolean) {
    const { author, ...rest } = entry;
    return {
        ...rest,
        locale: entry.locale2 ?? null,
        publishedAt: entry.publishDate ?? null,
        regected: entry.moderationStatus === 'rejected',
        author: author ? { documentId: author.documentId, username: author.username, ...(trusted ? { email: author.email } : {}) } : null,
    };
}

export default factories.createCoreController(UID, ({ strapi }) => ({
    async find(ctx) {
        const trusted = isTrusted(ctx);
        const q = (ctx.query ?? {}) as any;
        if (!trusted && !filtersAreSafe(q.filters, SAFE_FILTER_KEYS)) return ctx.badRequest('פילטר לא נתמך');

        const clientFilters = q.filters ?? {};
        const visibility: any = trusted
            ? null
            : { $and: [{ moderationStatus: { $eq: 'approved' } }, { archived: { $ne: true } }] };
        const filters = visibility ? { $and: [clientFilters, visibility] } : clientFilters;
        const pageSize = clampInt(q.pagination?.pageSize ?? q.pagination?.limit, 1, 100, 20);
        const page = clampInt(q.pagination?.page, 1, 10000, 1);
        const sort = typeof q.sort === 'string' && SORTS.has(q.sort) ? q.sort : 'publishDate:desc';

        const [rows, total] = await Promise.all([
            strapi.documents(UID).findMany({
                filters,
                populate: populateFor(trusted) as any,
                sort,
                limit: pageSize,
                start: (page - 1) * pageSize,
            }),
            strapi.documents(UID).count({ filters }),
        ]);
        return {
            data: rows.map((r: any) => shape(r, trusted)),
            meta: { pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total } },
        };
    },

    async findOne(ctx) {
        const trusted = isTrusted(ctx);
        // ה-router של Strapi מעביר את ה-documentId כ-:id
        const base: any = { documentId: { $eq: ctx.params.id } };
        const filters = trusted
            ? base
            : { $and: [base, { moderationStatus: { $eq: 'approved' } }, { archived: { $ne: true } }] };
        const row = await strapi.documents(UID).findFirst({ filters, populate: populateFor(trusted) as any });
        if (!row) return ctx.notFound();
        return { data: shape(row, trusted), meta: {} };
    },

    // הגשת חדשה: ממתינה למודרציה, הכותב הוא המשתמש המחובר, רק שדות מותרים.
    async create(ctx) {
        const user = ctx.state?.user;
        // שרת-לשרת (API Token) / מנהל: יצירה רגילה של core (למשל חדשות ארציות)
        if (!user && isTrusted(ctx)) return super.create(ctx);
        if (!user) return ctx.unauthorized();
        const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;

        const title = cleanText(body.title, 200);
        if (!title) return ctx.badRequest('נדרשת כותרת');
        const cities = docIdList(body.cities, 5);
        const image = Number(body.imageUrl);

        try {
            const created = await strapi.documents(UID).create({
                data: {
                    title,
                    content: cleanText(body.content, 20000),
                    summary: cleanText(body.summary, 1000),
                    category: cleanText(body.category, 60),
                    videourl: cleanText(body.videourl, 300),
                    videodescription: cleanText(body.videodescription, 500),
                    sourceUrl: cleanText(body.sourceUrl, 500),
                    locale2: cleanText(body.locale2, 8) || 'he',
                    archived: false,
                    moderationStatus: 'pending_moderation',
                    author: { connect: [{ documentId: user.documentId }] },
                    cities: { connect: cities.map((documentId) => ({ documentId })) },
                    ...(Number.isInteger(image) && image > 0 ? { imageUrl: image } : {}),
                } as any,
                populate: populateFor(false) as any,
            });
            ctx.status = 201;
            return { data: shape(created, false), meta: {} };
        } catch (e: any) {
            strapi.log.warn('[cr-post] create נכשל: ' + (e?.message ?? e));
            return ctx.badRequest('לא ניתן לשמור את החדשה');
        }
    },

    // עריכה (אישור/דחייה/ארכוב) — שרת האתר עם API Token בלבד.
    async update(ctx) {
        if (!isTrusted(ctx)) return ctx.forbidden('רק שרת האתר או מנהל רשאים לעדכן חדשות');
        const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
        // אישור מסמן גם תאריך פרסום (משמש למיון ולתצוגה)
        if (body.moderationStatus === 'approved' && body.publishDate === undefined) {
            ctx.request.body = { data: { ...body, publishDate: new Date().toISOString() } };
        }
        return super.update(ctx);
    },

    async delete(ctx) {
        if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל רשאי למחוק חדשות');
        return super.delete(ctx);
    },
}));
