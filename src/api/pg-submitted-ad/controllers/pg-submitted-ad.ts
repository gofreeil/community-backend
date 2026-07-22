/**
 * pg-submitted-ad controller
 *
 * אכיפה כפולה (כמו ב-pg-satisfaction-response): אתר קבוצות הרכישה כבר חוסם
 * את מסך /admin/ads למי שאינו super_admin, אבל הרשאת update ב-Strapi ניתנת
 * לכל משתמש מחובר. לכן גם כאן נדחית כל בקשת עדכון/מחיקה שאינה של super_admin.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::pg-submitted-ad.pg-submitted-ad', () => ({
  async update(ctx) {
    const user = ctx.state.user;
    if (!user || user.app_role !== 'super_admin') {
      return ctx.forbidden('רק super_admin רשאי לאשר או לדחות פרסומת');
    }
    return await super.update(ctx);
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user || user.app_role !== 'super_admin') {
      return ctx.forbidden('רק super_admin רשאי למחוק פרסומת');
    }
    return await super.delete(ctx);
  },
}));
