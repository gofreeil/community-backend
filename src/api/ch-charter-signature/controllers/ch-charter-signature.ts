import { factories } from '@strapi/strapi';

const UID = 'api::ch-charter-signature.ch-charter-signature' as const;

// בעלי האתר — עורכים כל חתימה גם בלי app_role בבאקאנד (רשת ביטחון, כמו בפרונט)
const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);

// שדות שהחותם/רכז רשאים לעדכן דרך self-update. סטטוס/פסילה נשארים לאדמין בלבד.
const SELF_EDITABLE_FIELDS = ['name', 'businessName', 'role', 'city', 'email', 'phone'] as const;

function isPrivilegedEditor(user: any): boolean {
    if (!user) return false;
    const email = String(user.email ?? '').trim().toLowerCase();
    if (SUPER_ADMIN_EMAILS.has(email)) return true;
    return ['super_admin', 'ch_admin', 'ch_coordinator'].includes(user.app_role);
}

function ownsEntry(user: any, entry: any): boolean {
    const userEmail = String(user?.email ?? '').trim().toLowerCase();
    const entryEmail = String(entry?.email ?? '').trim().toLowerCase();
    return !!userEmail && userEmail === entryEmail;
}

export default factories.createCoreController(UID, ({ strapi }) => ({
    // GET /ch-charter-signatures/mine — החתימה של המשתמש המחובר (התאמה לפי email, שדה private).
    // מחזיר גם את השדות הפרטיים — זה המידע של החותם עצמו, למילוי טופס העריכה.
    async mine(ctx) {
        const user = ctx.state?.user;
        if (!user) return ctx.unauthorized('נדרשת התחברות');
        const email = String(user.email ?? '').trim();
        if (!email) return void (ctx.body = { data: null });

        const entries = await strapi.documents(UID).findMany({
            filters: { email: { $eqi: email } },
            sort: { createdAt: 'desc' },
            limit: 1,
        });
        ctx.body = { data: entries?.[0] ?? null };
    },

    // PUT /ch-charter-signatures/:documentId/self-update — עריכת פרטי חתימה.
    // מותר: לחותם עצמו (email תואם), לסופר-אדמין, ל-ch_admin ולרכז (ch_coordinator).
    async selfUpdate(ctx) {
        const user = ctx.state?.user;
        if (!user) return ctx.unauthorized('נדרשת התחברות');

        const { documentId } = ctx.params;
        const entry = await strapi.documents(UID).findOne({ documentId });
        if (!entry) return ctx.notFound();

        if (!isPrivilegedEditor(user) && !ownsEntry(user, entry)) {
            return ctx.forbidden('אין הרשאה לערוך חתימה זו');
        }

        const body = (ctx.request.body?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
        const data: Record<string, string | null> = {};
        for (const field of SELF_EDITABLE_FIELDS) {
            if (!(field in body)) continue;
            const raw = body[field];
            const trimmed = raw == null ? '' : String(raw).trim();
            data[field] = trimmed === '' ? null : trimmed.slice(0, 200);
        }
        if (data.name === null) return ctx.badRequest('name is required');
        if (Object.keys(data).length === 0) return void (ctx.body = { ok: true, data: entry });

        const updated = await strapi.documents(UID).update({ documentId, data: data as any });
        ctx.body = { ok: true, data: updated };
    },
}));
