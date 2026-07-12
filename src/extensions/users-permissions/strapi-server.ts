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

    return plugin;
};
