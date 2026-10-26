import { factories } from '@strapi/strapi';

// פניות תמיכה של חברי קבוצות הרכישה.
//  - הפונה רואה ומגיב רק בפניות שפתח.
//  - אדמין (super_admin / neighborhood_admin) רואה הכול, מגיב, סוגר ומשייך חברות שירות.
//  - חברת שירות = משתמש רשום שהמייל שלו ברשימת provider_emails של הפנייה; רואה ומגיבה רק בה.
const UID = 'api::pg-support-ticket.pg-support-ticket' as const;
const MAX_MESSAGES = 300;

type Role = 'owner' | 'admin' | 'provider';

const isAdmin = (u: any) => u?.app_role === 'super_admin' || u?.app_role === 'neighborhood_admin';
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const providers = (t: any): string[] => (Array.isArray(t?.provider_emails) ? t.provider_emails.map(norm) : []);

function roleOf(user: any, t: any): Role | null {
    if (isAdmin(user)) return 'admin';
    if (String(t.user_id) === String(user.id)) return 'owner';
    if (user.email && providers(t).includes(norm(user.email))) return 'provider';
    return null;
}

// הפונה לא מקבל שוב את פרטי הקשר של עצמו; צוות וחברת שירות רואים את פרטי הפונה.
function view(t: any, role: Role) {
    return {
        documentId: t.documentId,
        subject: t.subject,
        category: t.category,
        company: t.company,
        status: t.status,
        createdAt: t.createdAt,
        last_activity: t.last_activity ?? t.createdAt,
        user_name: t.user_name,
        ...(role !== 'owner' ? { user_email: t.user_email, user_phone: t.user_phone } : {}),
        ...(role === 'admin' ? { provider_emails: t.provider_emails ?? [] } : {}),
        messages: Array.isArray(t.messages) ? t.messages : [],
        role,
    };
}

export default factories.createCoreController(UID, ({ strapi }) => ({
    async inbox(ctx) {
        const user = ctx.state?.user;
        if (!user) return ctx.unauthorized('נדרשת התחברות');
        const rows: any[] = await strapi.documents(UID).findMany({ sort: 'last_activity:desc', limit: 500 } as any);
        const out: any[] = [];
        for (const t of rows) {
            const role = roleOf(user, t);
            if (!role) continue;
            const v = view(t, role);
            const last = v.messages[v.messages.length - 1];
            out.push({ ...v, messages: undefined, count: v.messages.length, preview: String(last?.text ?? '').slice(0, 120) });
        }
        ctx.body = { data: out };
    },

    async open(ctx) {
        const user = ctx.state?.user;
        if (!user) return ctx.unauthorized('נדרשת התחברות');
        const b = (ctx.request.body?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
        const subject = String(b.subject ?? '').trim().slice(0, 120);
        const text = String(b.text ?? '').trim().slice(0, 3000);
        if (!subject || !text) return ctx.badRequest('נדרשים נושא ותוכן');
        const now = new Date().toISOString();
        const name = String(user.name ?? user.username ?? user.email ?? '').slice(0, 80);
        const created: any = await strapi.documents(UID).create({
            data: {
                subject,
                category: String(b.category ?? '').slice(0, 60),
                company: String(b.company ?? '').slice(0, 80),
                status: 'open',
                user_id: String(user.id),
                user_name: name,
                user_email: user.email,
                user_phone: String(b.phone ?? user.phone ?? '').slice(0, 30),
                provider_emails: [],
                messages: [{ from: 'owner', name, text, at: now }],
                last_activity: now,
            } as any,
        });
        ctx.body = { data: { documentId: created.documentId } };
    },

    async thread(ctx) {
        const user = ctx.state?.user;
        if (!user) return ctx.unauthorized('נדרשת התחברות');
        const t: any = await strapi.documents(UID).findOne({ documentId: ctx.params.documentId });
        const role = t && roleOf(user, t);
        if (!t || !role) return ctx.notFound();
        ctx.body = { data: view(t, role) };
    },

    async message(ctx) {
        const user = ctx.state?.user;
        if (!user) return ctx.unauthorized('נדרשת התחברות');
        const { documentId } = ctx.params;
        const t: any = await strapi.documents(UID).findOne({ documentId });
        const role = t && roleOf(user, t);
        if (!t || !role) return ctx.notFound();
        if (t.status === 'closed' && role !== 'admin') return ctx.badRequest('הפנייה סגורה');
        const b = (ctx.request.body?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
        const text = String(b.text ?? '').trim().slice(0, 3000);
        if (!text) return ctx.badRequest('נדרש טקסט');
        const messages: any[] = Array.isArray(t.messages) ? t.messages : [];
        if (messages.length >= MAX_MESSAGES) return ctx.badRequest('הפנייה ארוכה מדי, פתחו פנייה חדשה');
        const now = new Date().toISOString();
        messages.push({
            from: role,
            name: role === 'admin' ? 'הנהלת יוצאים לחירות' : String(user.name ?? user.username ?? user.email ?? '').slice(0, 80),
            text,
            at: now,
        });
        // תשובת צוות/חברה => "נענתה"; הודעה חדשה של הפונה פותחת מחדש
        const status = role === 'owner' ? 'open' : 'answered';
        await strapi.documents(UID).update({ documentId, data: { messages, status, last_activity: now } as any });
        ctx.body = { data: view({ ...t, messages, status, last_activity: now }, role) };
    },

    // סגירה/פתיחה ושיוך חברות שירות - אדמין בלבד
    async manage(ctx) {
        const user = ctx.state?.user;
        if (!isAdmin(user)) return ctx.forbidden('אין הרשאה');
        const { documentId } = ctx.params;
        const t: any = await strapi.documents(UID).findOne({ documentId });
        if (!t) return ctx.notFound();
        const b = (ctx.request.body?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
        const data: Record<string, unknown> = {};
        if (b.status === 'open' || b.status === 'answered' || b.status === 'closed') data.status = b.status;
        if (Array.isArray(b.provider_emails)) {
            data.provider_emails = [...new Set(b.provider_emails.map(norm).filter((e) => /^\S+@\S+\.\S+$/.test(e)))].slice(0, 10);
        }
        await strapi.documents(UID).update({ documentId, data: data as any });
        ctx.body = { data: view({ ...t, ...data }, 'admin') };
    },
}));
