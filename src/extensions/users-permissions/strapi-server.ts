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
    const siteAdminsStore = () => strapi.store({ type: 'plugin', name: 'users-permissions' });

    // GET /api/site-admins — כל המינויים (סופר-אדמין בלבד; כולל מיילים/טלפונים)
    plugin.controllers.user.siteAdminsGet = async (ctx: any) => {
        if (!isSuperAdminUser(ctx.state?.user)) return ctx.forbidden('סופר-אדמין בלבד');
        const map = (await siteAdminsStore().get({ key: SITE_ADMINS_STORE_KEY })) ?? {};
        ctx.body = { data: map };
    };

    // PUT /api/site-admins { siteId, admin } — עדכון מינוי לאתר בודד; admin=null מוחק.
    // עדכון פר-אתר (ולא כל המפה) כדי לא להתנגש במגבלת גודל ה-body של Strapi
    // (תמונות נשמרות כ-data URL בתוך admin.avatarUrl).
    plugin.controllers.user.siteAdminsSet = async (ctx: any) => {
        if (!isSuperAdminUser(ctx.state?.user)) return ctx.forbidden('סופר-אדמין בלבד');
        const body = (ctx.request.body ?? {}) as any;
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
        ctx.body = { data: out };
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

    return plugin;
};
