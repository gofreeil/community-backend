import { factories } from '@strapi/strapi';
import { clampInt, cleanText, docIdList, filtersAreSafe, isTrusted, sameUser } from '../../../utils/crAccess';

// פניות תושבים לנציגי הרשות ("מבקר רשויות המדינה").
//
// המודל זהה לשאר האתרים: הכתיבה עוברת דרך ה-controller בלבד והוא כופה את הכללים.
//  - ציבורי רואה רק פניות שאושרו (approved); מחובר רואה גם את הפניות שפתח בעצמו.
//  - כתובות מייל לעולם לא יוצאות ללקוח לא-מהימן: משתמש רואה רק username, ופנייה אנונימית
//    מסתירה גם אותו (חוץ מהפונה עצמו). הלקוח מקבל isMine / supportedByMe במקום להשוות מיילים.
//  - יצירה כופה pending, בעלים מה-JWT ושדות מותרים בלבד. תמיכה וסגירה/דירוג בודקים בעלות כאן.
//  - אישור, דחייה, שיוך נציג ומענה (update) — API Token של שרת האתר בלבד, אחרי שהוא בדק שהמשתמש
//    מנהל העיר. אין לתפקידי users-permissions הרשאת update/delete.
const UID = 'api::inquiry.inquiry' as const;

const SAFE_FILTER_KEYS = new Set([
    'id', 'documentId', 'numid', 'title', 'cities', 'name', 'concil_members',
    'inquiryStatus', 'moderationStatus', 'isClosed', 'createdAt',
]);

const SORTS = new Set(['createdAt:desc', 'createdAt:asc', 'numid:desc', 'numid:asc']);

function populateFor(trusted: boolean) {
    const userFields = trusted ? ['username', 'email'] : ['username'];
    return {
        mainImage: { fields: ['url', 'alternativeText'] },
        responses: { populate: { council_member: { fields: ['name'] } } },
        userOpener: { fields: userFields },
        supporters: { fields: userFields },
        concil_members: { populate: { specialties: { fields: ['name'] } } },
        cities: { fields: ['name'] },
    };
}

function pickUser(u: any, withEmail: boolean) {
    return {
        documentId: u.documentId,
        username: u.username,
        ...(withEmail ? { email: u.email } : {}),
    };
}

function shape(entry: any, viewer: any, trusted: boolean) {
    const mine = viewer ? sameUser(entry.userOpener, viewer) : false;
    const supportedByMe = viewer ? (entry.supporters ?? []).some((s: any) => sameUser(s, viewer)) : false;
    const showOpener = trusted || mine || !entry.isAnonymous;
    const { userOpener, supporters, ...rest } = entry;
    return {
        ...rest,
        userOpener: showOpener && userOpener ? pickUser(userOpener, trusted) : null,
        supporters: (supporters ?? []).map((s: any) => (trusted ? pickUser(s, true) : { documentId: s.documentId })),
        supportersCount: (supporters ?? []).length,
        isMine: mine,
        supportedByMe,
    };
}

function visibilityFilter(trusted: boolean, viewer: any) {
    if (trusted) return null;
    if (viewer?.documentId) {
        return {
            $or: [
                { moderationStatus: { $eq: 'approved' } },
                { userOpener: { documentId: { $eq: viewer.documentId } } },
            ],
        };
    }
    return { moderationStatus: { $eq: 'approved' } };
}

export default factories.createCoreController(UID, ({ strapi }) => ({
    async find(ctx) {
        const trusted = isTrusted(ctx);
        const viewer = ctx.state?.user ?? null;
        const q = (ctx.query ?? {}) as any;
        if (!trusted && !filtersAreSafe(q.filters, SAFE_FILTER_KEYS)) return ctx.badRequest('פילטר לא נתמך');

        const visibility = visibilityFilter(trusted, viewer);
        const clientFilters = q.filters ?? {};
        const filters = visibility ? { $and: [clientFilters, visibility] } : clientFilters;
        const pageSize = clampInt(q.pagination?.pageSize ?? q.pagination?.limit, 1, 200, 100);
        const page = clampInt(q.pagination?.page, 1, 10000, 1);
        const sort = typeof q.sort === 'string' && SORTS.has(q.sort) ? q.sort : 'createdAt:desc';

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
            data: rows.map((r: any) => shape(r, viewer, trusted)),
            meta: { pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total } },
        };
    },

    async findOne(ctx) {
        const trusted = isTrusted(ctx);
        const viewer = ctx.state?.user ?? null;
        const visibility = visibilityFilter(trusted, viewer);
        // ה-router של Strapi מעביר את ה-documentId כ-:id
        const filters: any = { documentId: { $eq: ctx.params.id } };
        const row = await strapi.documents(UID).findFirst({
            filters: visibility ? { $and: [filters, visibility] } : filters,
            populate: populateFor(trusted) as any,
        });
        if (!row) return ctx.notFound();
        return { data: shape(row, viewer, trusted), meta: {} };
    },

    // פתיחת פנייה: תמיד ממתינה למודרציה, הבעלים הוא המשתמש המחובר, רק שדות מותרים.
    async create(ctx) {
        const user = ctx.state?.user;
        // שרת-לשרת (API Token) יוצר כמו ב-core (ייבוא/תיקון ידני); משתמש רגיל עובר את הכפייה למטה
        if (!user && isTrusted(ctx)) return super.create(ctx);
        if (!user) return ctx.unauthorized();
        const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;

        const title = cleanText(body.title, 200);
        const content = cleanText(body.content, 6000);
        if (!title || !content) return ctx.badRequest('נדרשים כותרת ותוכן');
        const cities = docIdList(body.cities, 5);
        if (cities.length === 0) return ctx.badRequest('נדרשת עיר');
        const members = docIdList(body.concil_members, 5);
        const image = Number(body.mainImage);

        try {
            const created = await strapi.documents(UID).create({
                data: {
                    title,
                    content,
                    isAnonymous: body.isAnonymous === true,
                    moderationStatus: 'pending_moderation',
                    inquiryStatus: 'pending_moderation',
                    isClosed: false,
                    userOpener: { connect: [{ documentId: user.documentId }] },
                    cities: { connect: cities.map((documentId) => ({ documentId })) },
                    concil_members: { connect: members.map((documentId) => ({ documentId })) },
                    ...(Number.isInteger(image) && image > 0 ? { mainImage: image } : {}),
                } as any,
                populate: populateFor(false) as any,
            });
            ctx.status = 201;
            return { data: shape(created, user, false), meta: {} };
        } catch (e: any) {
            strapi.log.warn('[inquiry] create נכשל: ' + (e?.message ?? e));
            return ctx.badRequest('לא ניתן ליצור את הפנייה');
        }
    },

    // תמיכה בפנייה של מישהו אחר (לא בשלך, ורק בפנייה מאושרת ופתוחה). אידמפוטנטי.
    async support(ctx) {
        const user = ctx.state?.user;
        if (!user) return ctx.unauthorized();
        const documentId = ctx.params.documentId;
        const inquiry: any = await strapi.documents(UID).findOne({
            documentId,
            populate: { userOpener: { fields: ['username'] }, supporters: { fields: ['username'] } } as any,
        });
        if (!inquiry || inquiry.moderationStatus !== 'approved') return ctx.notFound();
        if (inquiry.isClosed || inquiry.inquiryStatus === 'closed') return ctx.badRequest('הפנייה סגורה');
        if (sameUser(inquiry.userOpener, user)) return ctx.forbidden('אי אפשר לתמוך בפנייה שפתחת');

        const already = (inquiry.supporters ?? []).some((s: any) => sameUser(s, user));
        if (!already) {
            await strapi.documents(UID).update({
                documentId,
                data: { supporters: { connect: [{ documentId: user.documentId }] } } as any,
            });
        }
        const count = (inquiry.supporters ?? []).length + (already ? 0 : 1);
        return { data: { supported: true, supportersCount: count }, meta: {} };
    },

    // סגירת הפנייה + דירוג הטיפול (1-5) — רק על ידי מי שפתח אותה.
    async close(ctx) {
        const user = ctx.state?.user;
        if (!user) return ctx.unauthorized();
        const documentId = ctx.params.documentId;
        const inquiry: any = await strapi.documents(UID).findOne({
            documentId,
            populate: { userOpener: { fields: ['username'] } } as any,
        });
        if (!inquiry) return ctx.notFound();
        if (!sameUser(inquiry.userOpener, user)) return ctx.forbidden('רק מי שפתח את הפנייה יכול לסגור אותה');

        const raw = (ctx.request.body ?? {}) as Record<string, unknown>;
        const rating = raw.rating == null ? null : clampInt(raw.rating, 1, 5, 0) || null;
        await strapi.documents(UID).update({
            documentId,
            data: { inquiryStatus: 'closed', isClosed: true, userOpenerRating: rating } as any,
        });
        return { data: { documentId, inquiryStatus: 'closed', isClosed: true, userOpenerRating: rating }, meta: {} };
    },

    // עדכון (אישור/דחייה/שיוך נציג/מענה) — שרת האתר עם API Token בלבד.
    async update(ctx) {
        if (!isTrusted(ctx)) return ctx.forbidden('רק שרת האתר או מנהל רשאים לעדכן פניות');
        return super.update(ctx);
    },

    async delete(ctx) {
        if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל רשאי למחוק פניות');
        return super.delete(ctx);
    },
}));
