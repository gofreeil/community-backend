/**
 * pg-submitted-ad controller
 *
 * אכיפה כפולה (כמו ב-pg-satisfaction-response): אתר קבוצות הרכישה כבר חוסם
 * את מסך /admin/ads למי שאינו super_admin / neighborhood_admin, אבל הרשאת update
 * ב-Strapi ניתנת לכל משתמש מחובר. לכן גם כאן נדחה כל עדכון של מי שאינו אחד
 * מהשניים, ומחיקה - של מי שאינו super_admin.
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

/** אישור/דחייה/השהיה - גם אדמין שמונה, כמו מסך /admin/ads באתר (ראה pg-campaign) */
function canModerate(ctx: any): boolean {
  return isTrusted(ctx) || ctx?.state?.user?.app_role === 'neighborhood_admin';
}

export default factories.createCoreController('api::pg-submitted-ad.pg-submitted-ad', () => ({
  async update(ctx) {
    if (!canModerate(ctx)) {
      return ctx.forbidden('רק אדמין רשאי לאשר או לדחות פרסומת');
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
