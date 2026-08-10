/**
 * pg-submitted-ad controller
 *
 * אכיפה כפולה (כמו ב-pg-satisfaction-response): אתר קבוצות הרכישה כבר חוסם
 * את מסך /admin/ads למי שאינו super_admin, אבל הרשאת update ב-Strapi ניתנת
 * לכל משתמש מחובר. לכן גם כאן נדחית כל בקשת עדכון/מחיקה שאינה של super_admin.
 */

import { factories } from '@strapi/strapi';

// בקשות שרת-לשרת (סנכרון "פרסם בכל האתרים") מאומתות ב-API token ואין להן
// ctx.state.user — הטוקנים שמורים רק בצד השרת של האתרים, לכן מותר לסמוך עליהן.
const isServerApiToken = (ctx) => ctx.state?.auth?.strategy?.name === 'api-token';

export default factories.createCoreController('api::pg-submitted-ad.pg-submitted-ad', () => ({
  async update(ctx) {
    const user = ctx.state.user;
    if (!isServerApiToken(ctx) && (!user || user.app_role !== 'super_admin')) {
      return ctx.forbidden('רק super_admin רשאי לאשר או לדחות פרסומת');
    }
    return await super.update(ctx);
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!isServerApiToken(ctx) && (!user || user.app_role !== 'super_admin')) {
      return ctx.forbidden('רק super_admin רשאי למחוק פרסומת');
    }
    return await super.delete(ctx);
  },
}));
