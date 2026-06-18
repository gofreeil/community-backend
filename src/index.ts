import type { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';

async function runMigrations(strapi: Core.Strapi) {
  const db = strapi.db;
  const client = process.env.DATABASE_CLIENT;

  if (client !== 'postgres') {
    strapi.log.info('[migrations] Skipping - not PostgreSQL');
    return;
  }

  // __dirname ב-build = dist/ → migrations נמצא ב-root של הפרויקט
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  // fallback אם הbuild שונה
  const migrationsDir2 = path.join(process.cwd(), 'migrations');
  const finalMigrationsDir = fs.existsSync(migrationsDir) ? migrationsDir : migrationsDir2;

  if (!fs.existsSync(finalMigrationsDir)) {
    strapi.log.warn(`[migrations] No migrations folder found (checked: ${migrationsDir}, ${migrationsDir2})`);
    return;
  }

  // Create tracking table if it doesn't exist
  await db.connection.raw(`
    CREATE TABLE IF NOT EXISTS _custom_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      ran_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const files = fs
    .readdirSync(finalMigrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    const already = await db.connection('_custom_migrations')
      .where({ filename })
      .first();

    if (already) {
      strapi.log.info(`[migrations] Already ran: ${filename}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(finalMigrationsDir, filename), 'utf8');

    try {
      await db.connection.raw(sql);
      await db.connection('_custom_migrations').insert({ filename });
      strapi.log.info(`[migrations] ✅ Ran: ${filename}`);
    } catch (err) {
      strapi.log.error(`[migrations] ❌ Failed: ${filename}`);
      strapi.log.error(err);
      throw err;
    }
  }
}

// רשימת הרשאות נדרשות לכל role - אם חסר, נוצר; קיים מדלגים.
// לא מוחקים הרשאות קיימות (גם אם לא ברשימה) כדי לא לשבור התאמות ידניות.
const PERMISSIONS: Record<'public' | 'authenticated', string[]> = {
    public: [
        // תוכן ציבורי - קריאה בלבד
        'api::event.event.find',
        'api::event.event.findOne',
        'api::post.post.find',
        'api::post.post.findOne',
        'api::news-ticker-item.news-ticker-item.find',
        'api::news-ticker-item.news-ticker-item.findOne',
        'api::submitted-ad.submitted-ad.find',
        'api::submitted-ad.submitted-ad.findOne',
        'api::advertisement.advertisement.find',
        'api::advertisement.advertisement.findOne',
        'api::city.city.find',
        'api::city.city.findOne',
        'api::community-fund.community-fund.find',
        'api::community-fund.community-fund.findOne',
        'api::revenue-config.revenue-config.find',
        'api::item.item.find',
        'api::item.item.findOne',
        // חתימת אמנה אנונימית - יצירה בלבד (אין find ציבורי)
        'api::charter-signature.charter-signature.create',
    ],
    authenticated: [
        // יורש מ-public + יכולות יצירה/עדכון של תוכן משלו
        'api::event.event.create',
        'api::event.event.update',
        'api::event.event.delete',
        'api::item.item.create',
        'api::item.item.update',
        'api::item.item.delete',
        'api::submitted-ad.submitted-ad.create',
        'api::submitted-ad.submitted-ad.update',
        'api::coordinator-request.coordinator-request.create',
        'api::charter-signature.charter-signature.find',
        'api::charter-signature.charter-signature.findOne',
        'api::lost-found-request.lost-found-request.find',
        'api::lost-found-request.lost-found-request.findOne',
        'api::lost-found-request.lost-found-request.create',
        'api::lost-found-request.lost-found-request.update',
        'api::push-subscription.push-subscription.create',
        'api::push-subscription.push-subscription.delete',
        'api::push-subscription.push-subscription.find',
        'api::advertisement-order.advertisement-order.create',
        // קריאת תוכן ציבורי גם כשמחוברים
        'api::event.event.find',
        'api::event.event.findOne',
        'api::post.post.find',
        'api::post.post.findOne',
        'api::news-ticker-item.news-ticker-item.find',
        'api::news-ticker-item.news-ticker-item.findOne',
        'api::submitted-ad.submitted-ad.find',
        'api::submitted-ad.submitted-ad.findOne',
        'api::advertisement.advertisement.find',
        'api::advertisement.advertisement.findOne',
        'api::city.city.find',
        'api::city.city.findOne',
        'api::community-fund.community-fund.find',
        'api::community-fund.community-fund.findOne',
        'api::revenue-config.revenue-config.find',
        'api::item.item.find',
        'api::item.item.findOne',
    ],
};

// הרשאות חשודות שצריכות להישאר כבויות (סיכון אבטחה)
const PERMISSIONS_TO_REVOKE: Record<'public', string[]> = {
    public: [
        // חשיפת רשימת משתמשים - אסור
        'plugin::users-permissions.user.find',
        'plugin::users-permissions.user.findOne',
        'plugin::users-permissions.user.update',
        'plugin::users-permissions.user.destroy',
    ],
};

async function ensurePermissions(strapi: Core.Strapi) {
    try {
        const roles = await strapi.db.query('plugin::users-permissions.role').findMany({
            where: { type: { $in: ['public', 'authenticated'] } },
        });
        const publicRole = roles.find((r: { type: string }) => r.type === 'public');
        const authRole   = roles.find((r: { type: string }) => r.type === 'authenticated');
        if (!publicRole || !authRole) {
            strapi.log.warn('[bootstrap] public/authenticated roles לא נמצאו - מדלג על ensurePermissions');
            return;
        }

        const grant = async (roleId: number, action: string) => {
            const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
                where: { action, role: roleId },
            });
            if (existing) return false;
            try {
                await strapi.db.query('plugin::users-permissions.permission').create({
                    data: { action, role: roleId },
                });
                return true;
            } catch (e) {
                strapi.log.warn(`[bootstrap] grant ${action} נכשל:`, e instanceof Error ? e.message : String(e));
                return false;
            }
        };

        const revoke = async (roleId: number, action: string) => {
            const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
                where: { action, role: roleId },
            });
            if (!existing) return false;
            await strapi.db.query('plugin::users-permissions.permission').delete({
                where: { id: existing.id },
            });
            return true;
        };

        let added = 0;
        for (const action of PERMISSIONS.public)        if (await grant(publicRole.id, action)) added++;
        for (const action of PERMISSIONS.authenticated) if (await grant(authRole.id,   action)) added++;

        let removed = 0;
        for (const action of PERMISSIONS_TO_REVOKE.public) if (await revoke(publicRole.id, action)) removed++;

        strapi.log.info(`[bootstrap] ✅ הרשאות: +${added} חדשות, -${removed} בוטלו`);
    } catch (e) {
        strapi.log.warn('[bootstrap] ensurePermissions נכשל:', e instanceof Error ? e.message : String(e));
    }
}

async function ensureSuperAdmin(strapi: Core.Strapi) {
  const email = process.env.SUPER_ADMIN_EMAIL;
  if (!email) return;
  try {
    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: { email: { $eqi: email } },
      limit: 1,
    });
    if (users.length === 0) {
      strapi.log.warn(`[bootstrap] Super admin user not found: ${email}`);
      return;
    }
    const user = users[0] as { id: number; app_role?: string };
    if (user.app_role !== 'super_admin') {
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { app_role: 'super_admin' },
      });
      strapi.log.info(`[bootstrap] ✅ Set super_admin for: ${email}`);
    } else {
      strapi.log.info(`[bootstrap] Already super_admin: ${email}`);
    }
  } catch (e) {
    strapi.log.warn('[bootstrap] ensureSuperAdmin failed:', e);
  }
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await runMigrations(strapi);
    await ensureSuperAdmin(strapi);
    await ensurePermissions(strapi);
  },
};
