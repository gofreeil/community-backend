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

    // GET /api/ch-users?q=<חיפוש> — רשימת כל הרשומים לאתר (סופר-אדמין בלבד).
    // מיועד לפאנל הניהול: תצוגה קומפקטית של המשתמשים + מינוי אדמין ישיר מהרשימה.
    // המשתמשים משותפים לכל אתרי gofreeil (אין שדה שיוך-לאתר), לכן זו רשימת כל הרשומים.
    plugin.controllers.user.chUserList = async (ctx: any) => {
        if (!isSuperAdminUser(ctx.state?.user)) return ctx.forbidden('סופר-אדמין בלבד');
        const q = String(ctx.query?.q ?? '').trim();
        const where: any = q
            ? {
                  $or: [
                      { email: { $containsi: q } },
                      { username: { $containsi: q } },
                      { nickname: { $containsi: q } },
                      { city: { $containsi: q } },
                      { phone: { $containsi: q } },
                  ],
              }
            : {};
        const users = await strapi.db.query('plugin::users-permissions.user').findMany({
            where,
            limit: 5000,
            orderBy: { createdAt: 'desc' },
        });
        // מחזירים רק שדות בטוחים — לא סיסמאות/טוקנים/שאלות אבטחה
        ctx.body = {
            data: users.map((u: any) => ({
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
            })),
        };
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

    plugin.routes['content-api'].routes.push(
        {
            method: 'GET',
            path: '/ch-admins',
            handler: 'user.chAdminList',
        },
        {
            method: 'GET',
            path: '/ch-users',
            handler: 'user.chUserList',
        },
        {
            method: 'POST',
            path: '/ch-admins/set-role',
            handler: 'user.chAdminSetRole',
        }
    );

    return plugin;
};
