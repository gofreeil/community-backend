/**
 * pg-site-event controller - מוני התנועה של אתר קבוצות הרכישה.
 *
 * המבנה: שורה אחת לכל (יום × סוג אירוע × מזהה), עם count שעולה ב-increment
 * ברמת ה-DB (כמו visit-stat) - עמיד לבקשות מקבילות, בניגוד לקריאה+כתיבה
 * מהפרונט. כך גם אלפי כניסות ביום נשארות כמה עשרות שורות, והסיכום למסך
 * הניהול הוא כמה GROUP BY ולא משיכה של כל הרשומות.
 *
 * סוגי האירועים (kind):
 *   visit      - כניסה לאתר (פעם אחת ל-session בדפדפן). slug ריק.
 *   pageview   - צפייה בדף. slug = הנתיב (/, /details/fuel, ...).
 *   deal_click - לחיצה על כרטיס מבצע בדף הבית. slug = מזהה העסקה.
 *   join_click - לחיצה על טופס ההצטרפות בדף העסקה. slug = מזהה העסקה.
 */

import { factories } from '@strapi/strapi';

const UID = 'api::pg-site-event.pg-site-event';
const TABLE = 'pg_site_events';

const KINDS = ['visit', 'pageview', 'deal_click', 'join_click'] as const;
type Kind = (typeof KINDS)[number];
const DEAL_KINDS: Kind[] = ['deal_click', 'join_click'];

const DAYS_BACK = 30;
const ADMIN_ROLES = ['super_admin', 'neighborhood_admin'];

// יום לפי שעון ישראל, YYYY-MM-DD (en-CA נותן בדיוק את הפורמט הזה)
function dayOf(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}
function currentDay(): string {
    return dayOf(new Date());
}

// Postgres מחזיר SUM כמחרוזת; sqlite כמספר. מיישרים למספר.
const num = (v: unknown) => Number(v) || 0;

export default factories.createCoreController(UID, () => ({
    // רישום אירוע אחד: find-or-create של שורת היום + increment אטומי.
    async track(ctx) {
        const body = (ctx.request.body ?? {}) as { kind?: unknown; slug?: unknown };
        const kind = String(body.kind ?? '');
        if (!(KINDS as readonly string[]).includes(kind)) {
            return ctx.badRequest('kind לא מוכר');
        }
        // המזהה מגיע מהאתר עצמו (נתיב או slug של עסקה); מנקים ומגבילים אורך
        // כדי שערך זבל לא ייצור שורות אינסופיות.
        const slug = String(body.slug ?? '').trim().slice(0, 120);
        const day = currentDay();

        const existing = await strapi.db.query(UID).findOne({ where: { day, kind, slug } });
        if (existing) {
            await strapi.db.connection(TABLE).where({ id: existing.id }).increment('count', 1);
        } else {
            await strapi.db.query(UID).create({ data: { day, kind, slug, count: 1 } });
        }
        ctx.body = { ok: true };
    },

    // סיכום למסך הניהול: סה"כ מאז ומתמיד, סדרה יומית ל-30 יום, פילוח לפי
    // עסקה ודפים נצפים. רק צוות האתר (app_role) - כמו בשאר מסכי הניהול.
    async summary(ctx) {
        const user = ctx.state.user;
        if (!user || !ADMIN_ROLES.includes(user.app_role)) {
            return ctx.forbidden('מסך הניהול פתוח לצוות בלבד');
        }

        const knex = strapi.db.connection;
        const days: string[] = [];
        for (let i = DAYS_BACK - 1; i >= 0; i--) {
            days.push(dayOf(new Date(Date.now() - i * 86_400_000)));
        }
        const since = days[0];

        const [allRows, dailyRows, dealRowsAll, dealRows30, pageRows, firstRow] = await Promise.all([
            knex(TABLE).select('kind').sum('count as total').groupBy('kind'),
            knex(TABLE).select('day', 'kind').sum('count as total').where('day', '>=', since).groupBy('day', 'kind'),
            knex(TABLE).select('kind', 'slug').sum('count as total').whereIn('kind', DEAL_KINDS).groupBy('kind', 'slug'),
            knex(TABLE)
                .select('kind', 'slug')
                .sum('count as total')
                .whereIn('kind', DEAL_KINDS)
                .where('day', '>=', since)
                .groupBy('kind', 'slug'),
            knex(TABLE)
                .select('slug')
                .sum('count as total')
                .where({ kind: 'pageview' })
                .where('day', '>=', since)
                .groupBy('slug')
                .orderBy('total', 'desc')
                .limit(15),
            knex(TABLE).min('day as first').first(),
        ]);

        const emptyKinds = () => ({ visit: 0, pageview: 0, deal_click: 0, join_click: 0 });

        const totals = emptyKinds();
        for (const r of allRows) totals[r.kind as Kind] = num(r.total);

        const byDay = new Map(days.map((d) => [d, { day: d, ...emptyKinds() }]));
        for (const r of dailyRows) {
            const row = byDay.get(r.day);
            if (row) row[r.kind as Kind] = num(r.total);
        }

        // פילוח לפי עסקה - לחיצות על המבצע ועל הטופס, ב-30 יום ומאז ומתמיד
        const deals = new Map<string, { slug: string; dealClicks: number; joinClicks: number; dealClicks30: number; joinClicks30: number }>();
        const dealRow = (slug: string) => {
            let row = deals.get(slug);
            if (!row) {
                row = { slug, dealClicks: 0, joinClicks: 0, dealClicks30: 0, joinClicks30: 0 };
                deals.set(slug, row);
            }
            return row;
        };
        for (const r of dealRowsAll) {
            const row = dealRow(r.slug ?? '');
            if (r.kind === 'deal_click') row.dealClicks = num(r.total);
            else row.joinClicks = num(r.total);
        }
        for (const r of dealRows30) {
            const row = dealRow(r.slug ?? '');
            if (r.kind === 'deal_click') row.dealClicks30 = num(r.total);
            else row.joinClicks30 = num(r.total);
        }

        ctx.body = {
            ok: true,
            today: currentDay(),
            since: firstRow?.first ?? null,
            totals,
            daily: [...byDay.values()],
            deals: [...deals.values()].sort((a, b) => b.dealClicks - a.dealClicks),
            pages: pageRows.map((r) => ({ path: r.slug ?? '', views: num(r.total) })),
        };
    },
}));
