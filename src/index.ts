import type { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';
import { seedPGCampaigns } from './seeds/pg-campaigns';

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
        // Purchasing-Groups - תוכן ציבורי לקריאה
        'api::pg-campaign.pg-campaign.find',
        'api::pg-campaign.pg-campaign.findOne',
        // תגובות סקר - יצירה אנונימית מותרת (משוב מהשטח)
        'api::pg-satisfaction-response.pg-satisfaction-response.create',
        // Chachmei-Haeda (ch-) - תוכן ציבורי לקריאה
        'api::ch-charter-signature.ch-charter-signature.find',
        'api::ch-charter-signature.ch-charter-signature.findOne',
        'api::ch-charter-signature.ch-charter-signature.create',
        'api::ch-article.ch-article.find',
        'api::ch-article.ch-article.findOne',
        'api::ch-qa-item.ch-qa-item.find',
        'api::ch-qa-item.ch-qa-item.findOne',
        'api::ch-question-submission.ch-question-submission.create',
        'api::ch-activity-item.ch-activity-item.find',
        'api::ch-activity-item.ch-activity-item.findOne',
        'api::ch-hearing.ch-hearing.find',
        'api::ch-hearing.ch-hearing.findOne',
        'api::ch-ruling.ch-ruling.find',
        'api::ch-ruling.ch-ruling.findOne',
        'api::ch-hearing-request.ch-hearing-request.create',
        'api::ch-rabbi.ch-rabbi.find',
        'api::ch-rabbi.ch-rabbi.findOne',
        'api::ch-news-item.ch-news-item.find',
        'api::ch-news-item.ch-news-item.findOne',
        'api::ch-home-config.ch-home-config.find',
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
        // Purchasing-Groups
        'api::pg-campaign.pg-campaign.find',
        'api::pg-campaign.pg-campaign.findOne',
        'api::pg-satisfaction-response.pg-satisfaction-response.create',
        'api::pg-satisfaction-response.pg-satisfaction-response.find',
        'api::pg-satisfaction-response.pg-satisfaction-response.findOne',
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

// כל הפעולות שעורך חכמי העדה יכול לעשות על תכני ch-*
const CHACHMEI_EDITOR_PERMISSIONS: string[] = [
    'api::ch-charter-signature.ch-charter-signature.find',
    'api::ch-charter-signature.ch-charter-signature.findOne',
    'api::ch-charter-signature.ch-charter-signature.create',
    'api::ch-charter-signature.ch-charter-signature.update',
    'api::ch-charter-signature.ch-charter-signature.delete',
    'api::ch-article.ch-article.find',
    'api::ch-article.ch-article.findOne',
    'api::ch-article.ch-article.create',
    'api::ch-article.ch-article.update',
    'api::ch-article.ch-article.delete',
    'api::ch-qa-item.ch-qa-item.find',
    'api::ch-qa-item.ch-qa-item.findOne',
    'api::ch-qa-item.ch-qa-item.create',
    'api::ch-qa-item.ch-qa-item.update',
    'api::ch-qa-item.ch-qa-item.delete',
    'api::ch-question-submission.ch-question-submission.find',
    'api::ch-question-submission.ch-question-submission.findOne',
    'api::ch-question-submission.ch-question-submission.update',
    'api::ch-question-submission.ch-question-submission.delete',
    'api::ch-activity-item.ch-activity-item.find',
    'api::ch-activity-item.ch-activity-item.findOne',
    'api::ch-activity-item.ch-activity-item.create',
    'api::ch-activity-item.ch-activity-item.update',
    'api::ch-activity-item.ch-activity-item.delete',
    'api::ch-hearing.ch-hearing.find',
    'api::ch-hearing.ch-hearing.findOne',
    'api::ch-hearing.ch-hearing.create',
    'api::ch-hearing.ch-hearing.update',
    'api::ch-hearing.ch-hearing.delete',
    'api::ch-ruling.ch-ruling.find',
    'api::ch-ruling.ch-ruling.findOne',
    'api::ch-ruling.ch-ruling.create',
    'api::ch-ruling.ch-ruling.update',
    'api::ch-ruling.ch-ruling.delete',
    'api::ch-hearing-request.ch-hearing-request.find',
    'api::ch-hearing-request.ch-hearing-request.findOne',
    'api::ch-hearing-request.ch-hearing-request.update',
    'api::ch-hearing-request.ch-hearing-request.delete',
    'api::ch-rabbi.ch-rabbi.find',
    'api::ch-rabbi.ch-rabbi.findOne',
    'api::ch-rabbi.ch-rabbi.create',
    'api::ch-rabbi.ch-rabbi.update',
    'api::ch-rabbi.ch-rabbi.delete',
    'api::ch-news-item.ch-news-item.find',
    'api::ch-news-item.ch-news-item.findOne',
    'api::ch-news-item.ch-news-item.create',
    'api::ch-news-item.ch-news-item.update',
    'api::ch-news-item.ch-news-item.delete',
    'api::ch-home-config.ch-home-config.find',
    'api::ch-home-config.ch-home-config.update',
    // קריאת פרטי המשתמש המחובר (לבדיקת תפקיד)
    'plugin::users-permissions.user.me',
];

async function ensureChachmeiEditorRole(strapi: Core.Strapi): Promise<{ id: number } | null> {
    try {
        const existing = await strapi.db.query('plugin::users-permissions.role').findOne({
            where: { type: 'chachmei_editor' },
        });
        if (existing) return existing as { id: number };
        const created = await strapi.db.query('plugin::users-permissions.role').create({
            data: {
                name: 'Chachmei Editor',
                description: 'עורך תוכן באתר חכמי העדה - יכול לנהל את כל תכני ch-*',
                type: 'chachmei_editor',
            },
        });
        strapi.log.info(`[bootstrap] ✅ role "chachmei_editor" נוצר (id=${(created as any).id})`);
        return created as { id: number };
    } catch (e) {
        strapi.log.warn('[bootstrap] ensureChachmeiEditorRole נכשל:', e instanceof Error ? e.message : String(e));
        return null;
    }
}

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
        const chachmeiRole = await ensureChachmeiEditorRole(strapi);

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
        if (chachmeiRole) {
            for (const action of CHACHMEI_EDITOR_PERMISSIONS) if (await grant(chachmeiRole.id, action)) added++;
        }

        let removed = 0;
        for (const action of PERMISSIONS_TO_REVOKE.public) if (await revoke(publicRole.id, action)) removed++;

        strapi.log.info(`[bootstrap] ✅ הרשאות: +${added} חדשות, -${removed} בוטלו`);
    } catch (e) {
        strapi.log.warn('[bootstrap] ensurePermissions נכשל:', e instanceof Error ? e.message : String(e));
    }
}

// סופר אדמינים קבועים - יוקצו אוטומטית בכל startup אם נרשמו ב-Strapi.
// SUPER_ADMIN_EMAIL נוסף לרשימה אם הוגדר ב-env.
const HARDCODED_SUPER_ADMINS = ['yahavanter@gmail.com'];

async function ensureSuperAdmin(strapi: Core.Strapi) {
  const envEmail = process.env.SUPER_ADMIN_EMAIL;
  const emails = Array.from(new Set(
    [...HARDCODED_SUPER_ADMINS, envEmail].filter(Boolean) as string[]
  )).map((e) => e.toLowerCase());
  if (emails.length === 0) return;
  for (const email of emails) {
    try {
      const users = await strapi.db.query('plugin::users-permissions.user').findMany({
        where: { email: { $eqi: email } },
        limit: 1,
      });
      if (users.length === 0) {
        strapi.log.info(`[bootstrap] super_admin ממתין להרשמה: ${email}`);
        continue;
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
      strapi.log.warn(`[bootstrap] ensureSuperAdmin failed for ${email}:`, e);
    }
  }
}

// מפעיל ספק OAuth של Google ב-users-permissions אם הוגדרו GOOGLE_OAUTH_CLIENT_ID/SECRET ב-env.
// השרת מעדכן את ה-grant store של ה-plugin בכל startup - אין צורך לערוך באדמין UI.
// כל ה-URLs של frontend שמותר להחזיר אליהם access_token אחרי OAuth
const ALLOWED_OAUTH_CALLBACKS = [
  'https://chachmim.gofreeil.com',
  'https://chachmei-haeda.gofreeil.com',
  'https://community.gofreeil.com',
  'https://community-il.gofreeil.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

async function ensureGoogleProvider(strapi: Core.Strapi) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    strapi.log.info('[bootstrap] Google OAuth: GOOGLE_OAUTH_CLIENT_ID/SECRET לא מוגדרים - מדלג');
    return;
  }
  try {
    const pluginStore = strapi.store({
      type: 'plugin',
      name: 'users-permissions',
      key: 'grant',
    });
    const grant: any = (await pluginStore.get({})) ?? {};
    const before = JSON.stringify(grant.google ?? {});
    grant.google = {
      ...(grant.google ?? {}),
      enabled: true,
      icon: 'google',
      key: clientId,
      secret: clientSecret,
      callback: '/api/auth/google/callback',
      scope: ['email'],
    };
    // ביטול whitelist על redirectUri - Google כבר מוודא את ה-URI ב-Cloud Console (אבטחה כפולה)
    delete grant.google.redirectUri;
    delete grant.google.redirect_uri;
    if (JSON.stringify(grant.google) === before) {
      strapi.log.info('[bootstrap] Google OAuth: כבר מוגדר');
    } else {
      await pluginStore.set({ value: grant });
      strapi.log.info('[bootstrap] ✅ Google OAuth: הופעל/עודכן עם credentials מה-env');
    }

    // גם רשימת ה-callbacks המותרים על ה-advanced settings
    const advancedStore = strapi.store({
      type: 'plugin',
      name: 'users-permissions',
      key: 'advanced',
    });
    const advanced: any = (await advancedStore.get({})) ?? {};
    const allowed = ALLOWED_OAUTH_CALLBACKS.flatMap((o) => [
      `${o}/auth/google-callback`,
      `${o}/auth/google-callback?returnTo=%2Fprofile`,
      `${o}/auth/google-callback?returnTo=%2Fadmin`,
    ]);
    if (advanced.allowed_redirect_origins !== ALLOWED_OAUTH_CALLBACKS.join(',')) {
      await advancedStore.set({ value: { ...advanced, allowed_redirect_origins: ALLOWED_OAUTH_CALLBACKS.join(',') } });
      strapi.log.info(`[bootstrap] Allowed OAuth origins: ${ALLOWED_OAUTH_CALLBACKS.length}`);
    }
  } catch (e) {
    strapi.log.warn('[bootstrap] ensureGoogleProvider נכשל:', e instanceof Error ? e.message : String(e));
  }
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await runMigrations(strapi);
    await ensureSuperAdmin(strapi);
    await ensurePermissions(strapi);
    await ensureGoogleProvider(strapi);
    await seedPGCampaigns(strapi);
  },
};
