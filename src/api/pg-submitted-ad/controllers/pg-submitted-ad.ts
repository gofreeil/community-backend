/**
 * pg-submitted-ad controller
 *
 * אכיפה כפולה (כמו ב-pg-satisfaction-response): אתר קבוצות הרכישה כבר חוסם
 * את מסך /admin/ads למי שאינו super_admin, אבל הרשאת update ב-Strapi ניתנת
 * לכל משתמש מחובר. לכן גם כאן נדחית כל בקשת עדכון/מחיקה שאינה של super_admin.
 *
 * חריג אחד: בקשה שמגיעה עם API token של השרת (ולא בשם משתמש) היא בקשה של
 * שרת ברשת ולא של גולש. זה אותו כלל בדיוק כמו בשאר ה-content types של
 * הרשת (shop-store, shop-seller-product, idx-business); בלעדיו סנכרון
 * פרסומות מאתר אחר (פרסום בכל האתרים, ופרסומות המוצרים של חנות החירות)
 * יכול ליצור פרסומת חדשה אבל לא לעדכן או להוריד אותה.
 */

import { factories } from '@strapi/strapi';

/** בקשה מהשרת עצמו (API token) או מסופר-אדמין מחובר */
function isTrusted(ctx: any): boolean {
  if (ctx?.state?.auth?.strategy?.name === 'api-token') return true;
  return ctx?.state?.user?.app_role === 'super_admin';
}

export default factories.createCoreController('api::pg-submitted-ad.pg-submitted-ad', () => ({
  async update(ctx) {
    if (!isTrusted(ctx)) {
      return ctx.forbidden('רק super_admin רשאי לאשר או לדחות פרסומת');
    }
    return await super.update(ctx);
  },

  async delete(ctx) {
    if (!isTrusted(ctx)) {
      return ctx.forbidden('רק super_admin רשאי למחוק פרסומת');
    }
    return await super.delete(ctx);
  },
}));
