import type { Core } from '@strapi/strapi';

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * משימות cron של השרת.
 * deleteOldMessages: מוחק כל הודעה (item בקטגוריה 'message') שגילה מעל 60 יום.
 * הודעות שסומנו לשמירה (status='archived') פטורות מהמחיקה.
 * רץ כל יום ב-03:15.
 */
const cronTasks = {
  deleteOldMessages: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        const cutoff = new Date(Date.now() - SIXTY_DAYS_MS).toISOString();

        // שולפים את המועמדים למחיקה (לא כולל שמורים) - $ne לבדו לא תופס שורות עם status1=NULL,
        // לכן מסננים ידנית בקוד אחרי שליפה לפי קטגוריה+גיל.
        const candidates = await strapi.db.query('api::item.item').findMany({
          where: {
            category: 'message',
            createdAt: { $lt: cutoff },
          },
          select: ['id', 'status1'],
          limit: 5000,
        });

        const toDelete = candidates.filter(
          (c: { status1?: string | null }) => c.status1 !== 'archived',
        );

        if (toDelete.length === 0) {
          strapi.log.info('[cron] deleteOldMessages: אין הודעות ישנות למחיקה');
          return;
        }

        let deleted = 0;
        for (const row of toDelete) {
          try {
            await strapi.db.query('api::item.item').delete({ where: { id: row.id } });
            deleted++;
          } catch (e) {
            strapi.log.warn(`[cron] deleteOldMessages: מחיקת item ${row.id} נכשלה: ${e instanceof Error ? e.message : e}`);
          }
        }

        strapi.log.info(`[cron] ✅ deleteOldMessages: נמחקו ${deleted}/${toDelete.length} הודעות מעל 60 יום`);
      } catch (e) {
        strapi.log.error('[cron] deleteOldMessages נכשל:', e instanceof Error ? e.message : e);
      }
    },
    options: {
      // כל יום ב-03:15
      rule: '15 3 * * *',
    },
  },
};

export default cronTasks;
