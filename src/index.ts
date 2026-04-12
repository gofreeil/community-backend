import type { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';

async function runMigrations(strapi: Core.Strapi) {
  const db = strapi.db;
  const client = process.env.DATABASE_CLIENT;

  if (client !== 'postgres') {
    strapi.log.info('[migrations] Skipping — not PostgreSQL');
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

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await runMigrations(strapi);
  },
};
