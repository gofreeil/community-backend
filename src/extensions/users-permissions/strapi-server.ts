/**
 * הרחבת users-permissions: override ל-GET /api/auth/email-confirmation.
 *
 * ברירת המחדל של Strapi מאשרת את החשבון ומפנה לדף סטטי — והמשתמש נדרש
 * להתחבר ידנית (להקליד אימייל+סיסמה שוב). כאן במקום זה:
 *   1. מאשרים את החשבון (confirmed=true, מנקים את הטוקן).
 *   2. מנפיקים JWT קצר-מועד (15 דקות) — ל-handoff בלבד.
 *   3. מפנים ל-<FRONTEND>/confirm-email#jwt=<טוקן> — ה-fragment לא מגיע
 *      לשרתים/לוגים; הפרונט מאמת אותו ב-/api/auth-handoff ומקים סשן,
 *      וה-session callback מחליף את הטוקן הקצר בטוקן מלא ברענון הראשון.
 * כישלון (טוקן חסר/לא נמצא) → הפניה עם ?error=1 — הדף הקיים מציג הסבר.
 */
// הצהרה מקומית ל-global של Strapi — עצמאית מהטיפוסים של @strapi/strapi
// (noEmitOnError=true בבילד; שגיאת קומפילציה הייתה תוקעת את ה-auto-deploy)
import { installAccountRecovery } from '../../utils/accountRecovery';

declare const strapi: any;

// בעלי האתר — רשת ביטחון כמו בפרונט; app_role='super_admin' מוקצה להם ב-bootstrap
const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);

// מפתח האתר לתיוג אתר-ההרשמה (registered_site). משתמש שנרשם דרך חכמי העדה מסומן בו.
const CH_SITE_KEY = 'chachmei';

function isSuperAdminUser(user: any): boolean {
    if (!user) return false;
    const email = String(user.email ?? '').trim().toLowerCase();
    if (SUPER_ADMIN_EMAILS.has(email)) return true;
    return user.app_role === 'super_admin';
}

export default (plugin: any) => {
    const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://community.gofreeil.com').replace(/\/+$/, '');

    plugin.controllers.auth.emailConfirmation = async (ctx: any) => {
        const confirmationToken = String(ctx.query?.confirmation ?? '').trim();
        if (!confirmationToken) {
            return ctx.redirect(`${FRONTEND_URL}/confirm-email?error=1`);
        }

        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { confirmationToken },
        });
        if (!user) {
            // טוקן לא מוכר: כמעט תמיד = כבר אושר (סורק-מייל של המייל-בוקס עשה
            // prefetch לקישור וצרך את הטוקן, או המשתמש לחץ פעמיים). מפנים למסך
            // הניטרלי "אשר, התחבר" ולא למסך שגיאה אדום — אחרת כל מייל-בוקס עם
            // link-scanner (Outlook/ארגוני) היה מראה "האימות נכשל" כוזב.
            return ctx.redirect(`${FRONTEND_URL}/confirm-email`);
        }

        await strapi.plugin('users-permissions').service('user').edit(user.id, {
            confirmed: true,
            confirmationToken: null,
        });

        // משתמש חסום: מאשרים אך לא מנפיקים טוקן — יקבל את המסך הסטטי
        if (user.blocked) {
            return ctx.redirect(`${FRONTEND_URL}/confirm-email`);
        }

        const jwt = strapi
            .plugin('users-permissions')
            .service('jwt')
            .issue({ id: user.id }, { expiresIn: '15m' });

        return ctx.redirect(`${FRONTEND_URL}/confirm-email#jwt=${encodeURIComponent(jwt)}`);
    };

    // ── ניהול אדמיני תוכן של חכמי העדה (סופר-אדמין בלבד) ──
    // GET /api/ch-admins?q=<חיפוש> — בלי q: כל האדמינים; עם q: חיפוש משתמש לפי מייל/שם.
    plugin.controllers.user.chAdminList = async (ctx: any) => {
        if (!isSuperAdminUser(ctx.state?.user)) return ctx.forbidden('סופר-אדמין בלבד');
        const q = String(ctx.query?.q ?? '').trim();
        const where: any = q
            ? {
                  $or: [
                      { email: { $containsi: q } },
                      { username: { $containsi: q } },
                      { nickname: { $containsi: q } },
                  ],
              }
            : { app_role: { $in: ['ch_admin', 'super_admin'] } };
        const users = await strapi.db.query('plugin::users-permissions.user').findMany({
            where,
            limit: 20,
            orderBy: { email: 'asc' },
        });
        // מחזירים רק שדות בטוחים — לא את כל רשומת המשתמש
        ctx.body = {
            data: users.map((u: any) => ({
                id: u.id,
                email: u.email,
                username: u.username,
                nickname: u.nickname,
                app_role: u.app_role ?? 'user',
            })),
        };
    };

    // GET /api/ch-users?scope=community|others — רשימת הרשומים לפאנל (סופר-אדמין בלבד).
    //   scope=community (ברירת מחדל): רק מי ש"שייך" לחכמי העדה — חתם על אמנת המוסר,
    //     שלח שאלה לשו"ת, הגיש בקשת דיון, או אדמין תוכן/סופר-אדמין. מחזיר גם othersCount.
    //   scope=others: שאר הרשומים (שהגיעו מאתרי gofreeil אחרים) — נטענים רק בלחיצה.
    // הערה חשובה: מאגר המשתמשים משותף לכל אתרי gofreeil ואתר-ההרשמה אינו נשמר,
    //   לכן אי-אפשר לדעת "היכן ההרשמה התחילה". השיוך כאן מבוסס על פעילות בחכמי העדה —
    //   הפרוקסי הזמין הקרוב ביותר ל"משתמש של האתר הזה".
    plugin.controllers.user.chUserList = async (ctx: any) => {
        if (!isSuperAdminUser(ctx.state?.user)) return ctx.forbidden('סופר-אדמין בלבד');
        const scope = String(ctx.query?.scope ?? 'community');
        const norm = (e: any) => String(e ?? '').trim().toLowerCase();

        // אוסף המיילים של מי שביצע פעולה כלשהי בחכמי העדה
        const memberEmails = new Set<string>();
        const collect = async (uid: string, field: string) => {
            const rows = await strapi.db.query(uid).findMany({ limit: 100000 });
            for (const r of rows) {
                const e = norm(r[field]);
                if (e) memberEmails.add(e);
            }
        };
        await collect('api::ch-charter-signature.ch-charter-signature', 'email');
        await collect('api::ch-question-submission.ch-question-submission', 'askerEmail');
        await collect('api::ch-hearing-request.ch-hearing-request', 'requesterEmail');

        const users = await strapi.db.query('plugin::users-permissions.user').findMany({
            limit: 20000,
            orderBy: { createdAt: 'desc' },
        });
        const isMember = (u: any) =>
            norm(u.registered_site) === CH_SITE_KEY ||
            memberEmails.has(norm(u.email)) ||
            u.app_role === 'ch_admin' ||
            u.app_role === 'super_admin';

        // מחזירים רק שדות בטוחים — לא סיסמאות/טוקנים/שאלות אבטחה
        const safe = (u: any) => ({
            id: u.id,
            email: u.email,
            username: u.username,
            nickname: u.nickname,
            city: u.city,
            phone: u.phone,
            app_role: u.app_role ?? 'user',
            confirmed: u.confirmed,
            blocked: u.blocked,
            createdAt: u.createdAt,
        });

        if (scope === 'others') {
            ctx.body = { data: users.filter((u: any) => !isMember(u)).map(safe) };
            return;
        }
        const community = users.filter(isMember);
        ctx.body = {
            data: community.map(safe),
            othersCount: users.length - community.length,
        };
    };

    // POST /api/ch-users/claim-origin { site } — מסמן את אתר-ההרשמה של המשתמש הנוכחי.
    // רק פעם אחת (אם אין ערך) ורק לחשבון חדש (נוצר ב-15 הדקות האחרונות) — כדי לא לתייג
    // בטעות משתמשים ותיקים שרק מתחברים. הפרונט קורא לזה מיד אחרי הרשמה (מקומית / Google).
    plugin.controllers.user.chClaimOrigin = async (ctx: any) => {
        const authed = ctx.state?.user;
        if (!authed) return ctx.unauthorized('נדרשת התחברות');
        const site = String((ctx.request.body ?? {}).site ?? '').trim().toLowerCase().slice(0, 40);
        if (!site) return ctx.badRequest('site חסר');
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: authed.id },
        });
        if (!user) return ctx.notFound('משתמש לא נמצא');
        const created = user.createdAt ? new Date(user.createdAt).getTime() : 0;
        const isFresh = created > 0 && Date.now() - created < 15 * 60 * 1000;
        if (user.registered_site || !isFresh) {
            ctx.body = { ok: true, registered_site: user.registered_site ?? null, changed: false };
            return;
        }
        await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: { registered_site: site },
        });
        ctx.body = { ok: true, registered_site: site, changed: true };
    };

    // POST /api/ch-admins/set-role { email, role: 'ch_admin' | 'user' } —
    // מינוי/הסרה של אדמין תוכן. סופר-אדמין מוגן משינוי דרך ה-endpoint הזה.
    // המינוי מחליף גם את ה-role של users-permissions ל-chachmei_editor (סופרסט של
    // authenticated, מוענק ב-bootstrap) — כך האדמין מקבל הרשאות כתיבה אמיתיות
    // על תכני ch-* בשרת, בלי לפתוח אותן לכל משתמש מחובר.
    plugin.controllers.user.chAdminSetRole = async (ctx: any) => {
        if (!isSuperAdminUser(ctx.state?.user)) return ctx.forbidden('סופר-אדמין בלבד');
        const body = (ctx.request.body ?? {}) as any;
        const email = String(body.email ?? '').trim().toLowerCase();
        const role = String(body.role ?? '');
        if (!email || !['ch_admin', 'user'].includes(role)) {
            return ctx.badRequest("email חסר או role לא חוקי (מותר: 'ch_admin' / 'user')");
        }
        if (SUPER_ADMIN_EMAILS.has(email)) return ctx.badRequest('אי אפשר לשנות תפקיד של סופר-אדמין');
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { email: { $eqi: email } },
        });
        if (!user) return ctx.notFound('משתמש עם המייל הזה לא נמצא — עליו להירשם לאתר קודם');
        if (user.app_role === 'super_admin') return ctx.badRequest('אי אפשר לשנות תפקיד של סופר-אדמין');

        const targetRoleType = role === 'ch_admin' ? 'chachmei_editor' : 'authenticated';
        const targetRole = await strapi.db.query('plugin::users-permissions.role').findOne({
            where: { type: targetRoleType },
        });
        const data: any = { app_role: role };
        if (targetRole?.id) data.role = targetRole.id;
        await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data,
        });
        ctx.body = { ok: true, data: { id: user.id, email: user.email, app_role: role } };
    };

    // ── אדמיני אתרי הרשת (פאנל הניהול של gofreeil.com) ──
    // הפורטל רץ על Vercel (מערכת קבצים לקריאה בלבד) ולכן שומר כאן, ב-core_store.
    // המבנה: מפה { [siteId]: { adminName, adminEmail?, role?, phone?, avatarUrl?, ... } }.
    const SITE_ADMINS_STORE_KEY = 'gofreeil-site-admins';
    // סדר הצגת האתרים ברשימה — מערך של siteId. נשמר בשרת (ולא בדפדפן) כדי
    // שהסידור שהסופר-אדמין עושה יהיה זהה בכל המכשירים ולכל המבקרים.
    const SITE_ADMINS_ORDER_KEY = 'gofreeil-site-admins-order';
    const siteAdminsStore = () => strapi.store({ type: 'plugin', name: 'users-permissions' });
    const readOrder = async (): Promise<string[]> => {
        const raw = await siteAdminsStore().get({ key: SITE_ADMINS_ORDER_KEY });
        return Array.isArray(raw) ? raw.filter((id: any) => typeof id === 'string') : [];
    };

    // GET /api/site-admins — כל המינויים (סופר-אדמין בלבד; כולל מיילים/טלפונים)
    plugin.controllers.user.siteAdminsGet = async (ctx: any) => {
        if (!isSuperAdminUser(ctx.state?.user)) return ctx.forbidden('סופר-אדמין בלבד');
        const map = (await siteAdminsStore().get({ key: SITE_ADMINS_STORE_KEY })) ?? {};
        ctx.body = { data: map, order: await readOrder() };
    };

    // PUT /api/site-admins { siteId, admin } — עדכון מינוי לאתר בודד; admin=null מוחק.
    // עדכון פר-אתר (ולא כל המפה) כדי לא להתנגש במגבלת גודל ה-body של Strapi
    // (תמונות נשמרות כ-data URL בתוך admin.avatarUrl).
    plugin.controllers.user.siteAdminsSet = async (ctx: any) => {
        if (!isSuperAdminUser(ctx.state?.user)) return ctx.forbidden('סופר-אדמין בלבד');
        const body = (ctx.request.body ?? {}) as any;

        // { order: [siteId, ...] } — שמירת סדר ההצגה בלבד
        if (Array.isArray(body.order)) {
            const order = body.order
                .filter((id: any) => typeof id === 'string')
                .map((id: string) => id.trim())
                .filter((id: string) => id && id.length <= 60)
                .slice(0, 200);
            await siteAdminsStore().set({ key: SITE_ADMINS_ORDER_KEY, value: order });
            ctx.body = { ok: true, data: { order } };
            return;
        }

        const siteId = String(body.siteId ?? '').trim();
        if (!siteId || siteId.length > 60) return ctx.badRequest('siteId חסר או ארוך מדי');
        const admin = body.admin ?? null;
        if (admin !== null && (typeof admin !== 'object' || Array.isArray(admin))) {
            return ctx.badRequest('admin חייב להיות אובייקט או null');
        }
        if (admin && JSON.stringify(admin).length > 900_000) {
            return ctx.badRequest('הנתונים גדולים מדי');
        }
        const map = ((await siteAdminsStore().get({ key: SITE_ADMINS_STORE_KEY })) ?? {}) as any;
        if (admin === null) delete map[siteId];
        else map[siteId] = admin;
        await siteAdminsStore().set({ key: SITE_ADMINS_STORE_KEY, value: map });
        ctx.body = { ok: true, data: { siteId, removed: admin === null } };
    };

    // GET /api/site-admins/public — התצוגה הציבורית של אדמיני הרשת (כרטיסיית
    // "ניהול הרשת" ב-gofreeil.com/about): פתוחה לכולם, קריאה בלבד.
    // מוחזרים רק שדות תצוגה ויצירת קשר; communityId (קישור לפאנל הניהול של
    // קהילה בשכונה) ונתוני הביקורת (updatedBy/updatedAt) נשארים לסופר-אדמין בלבד.
    plugin.controllers.user.siteAdminsPublicGet = async (ctx: any) => {
        const map = ((await siteAdminsStore().get({ key: SITE_ADMINS_STORE_KEY })) ?? {}) as Record<string, any>;
        const out: Record<string, any> = {};
        for (const [siteId, admin] of Object.entries(map)) {
            if (!admin || typeof admin !== 'object') continue;
            out[siteId] = {
                adminName: String(admin.adminName ?? ''),
                role: String(admin.role ?? ''),
                adminEmail: String(admin.adminEmail ?? ''),
                phone: String(admin.phone ?? ''),
                avatarUrl: String(admin.avatarUrl ?? ''),
            };
        }
        ctx.body = { data: out, order: await readOrder() };
    };

    // ── לוח המשימות והדיווחים של צוות הרשת (gofreeil.com/admin) ──
    // מסמך JSON אחד ב-core_store: { rev, data }. השרת כאן רק שומר ומגן — כל
    // לוגיקת המשימות וההרשאות הפנימיות יושבת בפורטל (שמעדכן בלי פריסת באקאנד).
    // כתיבה = compare-and-swap לפי rev, תחת נעילת Postgres בין שני מופעי Strapi —
    // כך שתי תגובות שנשלחות באותו רגע לא דורסות זו את זו (הפורטל מנסה שוב ב-409).
    // גישה: סופר-אדמין + כל מי שמונה כאדמין של אתר ברשת (לפי מפת site-admins).
    const NETWORK_BOARD_KEY = 'gofreeil-network-board';
    const NETWORK_BOARD_LOCK_ID = 7_243_001; // מזהה נעילה ייעודי ל-pg_advisory_xact_lock
    const normEmail = (e: any) => String(e ?? '').trim().toLowerCase();

    const isNetworkTeamUser = async (user: any): Promise<boolean> => {
        if (!user) return false;
        if (isSuperAdminUser(user)) return true;
        const email = normEmail(user.email);
        if (!email) return false;
        const map = ((await siteAdminsStore().get({ key: SITE_ADMINS_STORE_KEY })) ?? {}) as Record<string, any>;
        return Object.values(map).some((a: any) => normEmail(a?.adminEmail) === email);
    };

    const withBoardLock = async <T>(fn: () => Promise<T>): Promise<T> => {
        if (process.env.DATABASE_CLIENT !== 'postgres') return fn();
        return strapi.db.connection.transaction(async (trx: any) => {
            await trx.raw('SELECT pg_advisory_xact_lock(?)', [NETWORK_BOARD_LOCK_ID]);
            return fn();
        });
    };

    // GET /api/network-board → { data, rev } (data=null כשהלוח עוד ריק)
    plugin.controllers.user.networkBoardGet = async (ctx: any) => {
        if (!(await isNetworkTeamUser(ctx.state?.user))) return ctx.forbidden('צוות הרשת בלבד');
        const stored = (await siteAdminsStore().get({ key: NETWORK_BOARD_KEY })) as any;
        ctx.body = { data: stored?.data ?? null, rev: Number(stored?.rev ?? 0) };
    };

    // PUT /api/network-board { data, rev } — נשמר רק אם rev תואם לגרסה בשרת; אחרת 409.
    // הגרסה הקודמת נשמרת בצד (‎-prev) כרשת ביטחון מפני דריסה בטעות.
    plugin.controllers.user.networkBoardSet = async (ctx: any) => {
        const user = ctx.state?.user;
        if (!(await isNetworkTeamUser(user))) return ctx.forbidden('צוות הרשת בלבד');
        const body = (ctx.request.body ?? {}) as any;
        const rev = Number(body.rev);
        if (!Number.isInteger(rev) || rev < 0) return ctx.badRequest('rev לא תקין');
        const data = body.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return ctx.badRequest('data חייב להיות אובייקט');
        }
        if (JSON.stringify(data).length > 4_000_000) return ctx.badRequest('הלוח גדול מדי');

        const result = await withBoardLock(async () => {
            const stored = (await siteAdminsStore().get({ key: NETWORK_BOARD_KEY })) as any;
            const current = Number(stored?.rev ?? 0);
            if (current !== rev) return { conflict: true, rev: current };
            if (stored) await siteAdminsStore().set({ key: `${NETWORK_BOARD_KEY}-prev`, value: stored });
            await siteAdminsStore().set({
                key: NETWORK_BOARD_KEY,
                value: {
                    rev: current + 1,
                    data,
                    updatedAt: new Date().toISOString(),
                    updatedBy: normEmail(user.email),
                },
            });
            return { conflict: false, rev: current + 1 };
        });

        if (result.conflict) {
            ctx.status = 409;
            ctx.body = { error: 'הלוח עודכן בינתיים', rev: result.rev };
            return;
        }
        ctx.body = { ok: true, rev: result.rev };
    };

    // ── Freedom TV: הוספת שורה לטבלת המתנדבים ע"י משתמש רגיל (gofreeil.com/admin/tv) ──
    // מי שאינו בצוות הרשת לא קורא את הלוח (networkBoardGet חסום לו) — הוא רק מוסיף
    // שורה משלו ורואה אותה. השרת מחזיר לו אך ורק: כותרות העמודות הגלויות, השורות שהוא
    // עצמו הוסיף, ומספר השורות של אחרים (בלי תוכן) — הפורטל מציג אותן ככוכביות.
    // השורה נכנסת לאותו מסמך לוח (sheet.rows) תחת נעילה, כך שאדמינים רואים אותה בטבלה.
    const TV_DEFAULT_COLUMNS = [
        { id: 'col-name', label: 'שם המתנדב', kind: 'text' },
        { id: 'col-phone', label: 'טלפון', kind: 'phone' },
        { id: 'col-telegram', label: 'טלגרם', kind: 'link' },
        { id: 'col-youtube', label: 'יוטיוב', kind: 'link' },
        { id: 'col-facebook', label: 'פייסבוק', kind: 'link' },
    ]; // זהה ל-DEFAULT_COLUMNS בפורטל (lib/teamBoard.ts) — לוח שעוד לא נשמר בו טבלה
    const TV_ROW_ID_RE = /^[a-z0-9-]{8,64}$/i;
    const TV_MAX_ROWS = 3000;
    const TV_MAX_ROWS_PER_USER = 20;
    const TV_MAX_CELL = 500;

    const tvVisibleColumns = (sheet: any) => {
        const cols = Array.isArray(sheet?.columns) && sheet.columns.length ? sheet.columns : TV_DEFAULT_COLUMNS;
        return cols.filter((c: any) => c && typeof c.id === 'string' && c.id && !c.hidden);
    };

    // GET /api/network-board/guest → { columns, mine, others }
    plugin.controllers.user.networkBoardGuestGet = async (ctx: any) => {
        const user = ctx.state?.user;
        const email = normEmail(user?.email);
        if (!email) return ctx.unauthorized();
        const stored = (await siteAdminsStore().get({ key: NETWORK_BOARD_KEY })) as any;
        const sheet = stored?.data?.sheet;
        const columns = tvVisibleColumns(sheet);
        const ids = new Set(columns.map((c: any) => c.id));
        const rows: any[] = Array.isArray(sheet?.rows) ? sheet.rows : [];
        const mine = rows
            .filter((r) => normEmail(r?.createdBy) === email)
            .map((r) => ({
                id: String(r.id),
                createdAt: String(r.createdAt ?? ''),
                cells: Object.fromEntries(
                    Object.entries(r.cells ?? {}).filter(([k, v]) => ids.has(k) && typeof v === 'string')
                ),
            }));
        ctx.body = {
            columns: columns.map((c: any) => ({
                id: c.id,
                label: String(c.label ?? ''),
                kind: String(c.kind ?? 'text'),
                width: typeof c.width === 'number' ? c.width : 0,
            })),
            mine,
            others: rows.length - mine.length,
        };
    };

    // POST /api/network-board/guest { id, cells } — מוסיף שורה בשם המשתמש המחובר
    plugin.controllers.user.networkBoardGuestAdd = async (ctx: any) => {
        const user = ctx.state?.user;
        const email = normEmail(user?.email);
        if (!email) return ctx.unauthorized();
        const body = (ctx.request.body ?? {}) as any;
        const id = body.id;
        if (typeof id !== 'string' || !TV_ROW_ID_RE.test(id)) return ctx.badRequest('מזהה לא תקין');
        if (!body.cells || typeof body.cells !== 'object' || Array.isArray(body.cells)) {
            return ctx.badRequest('נתונים לא תקינים');
        }

        const result = await withBoardLock(async () => {
            const stored = (await siteAdminsStore().get({ key: NETWORK_BOARD_KEY })) as any;
            const current = Number(stored?.rev ?? 0);
            const data = stored?.data && typeof stored.data === 'object' ? stored.data : { v: 1, tasks: [], reports: [], people: {} };
            if (!data.sheet || typeof data.sheet !== 'object') data.sheet = { columns: [], rows: [] };
            if (!Array.isArray(data.sheet.columns) || !data.sheet.columns.length) {
                data.sheet.columns = TV_DEFAULT_COLUMNS.map((c) => ({ ...c }));
            }
            if (!Array.isArray(data.sheet.rows)) data.sheet.rows = [];
            const rows: any[] = data.sheet.rows;

            if (rows.some((r) => r?.id === id)) return { ok: true, rev: current }; // נשלח פעמיים
            if (rows.length >= TV_MAX_ROWS) return { error: 'הטבלה מלאה' };
            if (rows.filter((r) => normEmail(r?.createdBy) === email).length >= TV_MAX_ROWS_PER_USER) {
                return { error: 'הגעת למספר השורות המרבי' };
            }

            const ids = new Set(tvVisibleColumns(data.sheet).map((c: any) => c.id));
            const cells: Record<string, string> = {};
            for (const [k, v] of Object.entries(body.cells)) {
                if (!ids.has(k) || typeof v !== 'string') continue;
                const val = v.trim();
                if (val.length > TV_MAX_CELL) return { error: 'אחד הערכים ארוך מדי' };
                if (val) cells[k] = val;
            }
            if (!Object.keys(cells).length) return { error: 'צריך למלא לפחות שדה אחד' };

            const now = new Date().toISOString();
            rows.push({ id, cells, createdBy: email, createdAt: now, updatedBy: email, updatedAt: now });
            const name = String(user.username ?? user.name ?? '').trim();
            if (data.people && typeof data.people === 'object' && name && !data.people[email]) {
                data.people[email] = { name, image: '' };
            }

            if (stored) await siteAdminsStore().set({ key: `${NETWORK_BOARD_KEY}-prev`, value: stored });
            await siteAdminsStore().set({
                key: NETWORK_BOARD_KEY,
                value: { rev: current + 1, data, updatedAt: now, updatedBy: email },
            });
            return { ok: true, rev: current + 1 };
        });

        if ((result as any).error) return ctx.badRequest((result as any).error);
        ctx.body = { ok: true };
    };

    // config.prefix='' חובה: בלעדיו Strapi v5 ממפה routes של הרחבת-פלאגין תחת
    // קידומת שם-הפלאגין (‎/api/users-permissions/ch-users) במקום ‎/api/ch-users,
    // והפרונט מקבל 404. כל ה-routes המובנים של users-permissions משתמשים בזה.
    plugin.routes['content-api'].routes.push(
        {
            method: 'GET',
            path: '/ch-admins',
            handler: 'user.chAdminList',
            config: { prefix: '' },
        },
        {
            method: 'GET',
            path: '/ch-users',
            handler: 'user.chUserList',
            config: { prefix: '' },
        },
        {
            method: 'POST',
            path: '/ch-users/claim-origin',
            handler: 'user.chClaimOrigin',
            config: { prefix: '' },
        },
        {
            method: 'POST',
            path: '/ch-admins/set-role',
            handler: 'user.chAdminSetRole',
            config: { prefix: '' },
        },
        {
            method: 'GET',
            path: '/site-admins',
            handler: 'user.siteAdminsGet',
            config: { prefix: '' },
        },
        {
            method: 'PUT',
            path: '/site-admins',
            handler: 'user.siteAdminsSet',
            config: { prefix: '' },
        },
        {
            method: 'GET',
            path: '/site-admins/public',
            handler: 'user.siteAdminsPublicGet',
            config: { prefix: '' },
        },
        {
            method: 'GET',
            path: '/network-board',
            handler: 'user.networkBoardGet',
            config: { prefix: '' },
        },
        {
            method: 'PUT',
            path: '/network-board',
            handler: 'user.networkBoardSet',
            config: { prefix: '' },
        },
        {
            method: 'GET',
            path: '/network-board/guest',
            handler: 'user.networkBoardGuestGet',
            config: { prefix: '' },
        },
        {
            method: 'POST',
            path: '/network-board/guest',
            handler: 'user.networkBoardGuestAdd',
            config: { prefix: '' },
        }
    );

    // ── חיבור חשבונות בהתחברות חברתית (Google/Facebook) ──
    // ברירת המחדל של Strapi: אם מתחברים עם Google/Facebook עם מייל שכבר קיים
    // במערכת תחת provider אחר (בד"כ 'local' — מישהו שנרשם פעם עם אימייל+סיסמה),
    // הפלאגין זורק "Email is already taken" ומכשיל את ההתחברות. מכיוון שכל אתרי
    // gofreeil חולקים את אותם משתמשים, זה קורה הרבה (נרשם באתר אחד, מתחבר עם
    // גוגל באתר אחר).
    //
    // כאן, במקום לזרוק — מחברים: מחזירים את החשבון הקיים כך שהמשתמש נכנס אליו.
    // בטוח כי Google/Facebook מחזירים רק מייל מאומת — אותה רמת אמון שבה Strapi
    // עצמו יוצר חשבון חדש עם confirmed:true. לא-הרסני: לא משנים את החשבון הקיים
    // (הסיסמה המקומית ממשיכה לעבוד), רק מחזירים אותו כמות שהוא.
    // שכפול נאמן של connect המקורי (users-permissions 5.38) עם שינוי בודד:
    // ענף "Email is already taken" הוחלף בחיבור החשבון.
    const originalProvidersFactory = plugin.services.providers;
    plugin.services.providers = (ctx: any) => {
        const base = originalProvidersFactory(ctx);

        const getProfile = async (provider: string, query: any) => {
            const accessToken = query.access_token || query.code || query.oauth_token;
            const grant = await strapi
                .store({ type: 'plugin', name: 'users-permissions', key: 'grant' })
                .get();
            return strapi
                .plugin('users-permissions')
                .service('providers-registry')
                .run({ provider, query, accessToken, providers: grant });
        };

        const connect = async (provider: string, query: any) => {
            const accessToken = query.access_token || query.code || query.oauth_token;
            if (!accessToken) throw new Error('No access_token.');

            const profile = await getProfile(provider, query);
            const email = String(profile?.email ?? '').toLowerCase();
            if (!email) throw new Error('Email was not available.');

            const users = await strapi.db
                .query('plugin::users-permissions.user')
                .findMany({ where: { email } });

            const advancedSettings = await strapi
                .store({ type: 'plugin', name: 'users-permissions', key: 'advanced' })
                .get();

            // חשבון עם אותו provider כבר קיים → התחברות רגילה (התנהגות מקורית).
            const matched = users.find((u: any) => u.provider === provider);
            if (matched) return matched;

            // ★ השינוי: אותו מייל (מאומת) קיים תחת provider אחר → מחברים חשבונות
            //   ומחזירים את הקיים, במקום throw 'Email is already taken.'.
            if (users.length && advancedSettings.unique_email) {
                return users[0];
            }

            // מכאן והלאה: מייל חדש לגמרי → רישום משתמש חדש (התנהגות מקורית).
            if (!advancedSettings.allow_register) {
                throw new Error('Register action is actually not available.');
            }

            const defaultRole = await strapi.db
                .query('plugin::users-permissions.role')
                .findOne({ where: { type: advancedSettings.default_role } });

            return strapi.db.query('plugin::users-permissions.user').create({
                data: { ...profile, email, provider, role: defaultRole.id, confirmed: true },
            });
        };

        return { ...base, connect };
    };

    // ── שחזור גישה לחשבון: הקישור חוזר לאתר המבקש + מייל חכם (ראה utils/accountRecovery.ts) ──
    installAccountRecovery(plugin);

    return plugin;
};
