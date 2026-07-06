import type { Core } from '@strapi/strapi';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_MESSAGES_PER_USER = 100;

/**
 * משימות cron של השרת.
 * cleanupOldMessages: שומר לכל משתמש עד 100 הודעות אחרונות או 3 חודשים אחורה -
 * המוקדם מביניהם. הודעה מעבר לזה נמחקת.
 * הודעות שסומנו לשמירה (status1='archived') לא נמחקות לעולם ולא נספרות במכסת ה-100.
 * רץ כל יום ב-03:15.
 */
const cronTasks = {
  cleanupOldMessages: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        const cutoffMs = Date.now() - NINETY_DAYS_MS;

        // שולפים את כל ההודעות מהחדשה לישנה - הסינון (archived / מכסה פר-משתמש)
        // נעשה בקוד, כי $ne לבדו לא תופס שורות עם status1=NULL וספירה פר-משתמש
        // דורשת קיבוץ שאין ב-query הפשוט.
        const messages = await strapi.db.query('api::item.item').findMany({
          where: { category: 'message' },
          select: ['id', 'status1', 'user_id', 'createdAt'],
          orderBy: { createdAt: 'desc' },
          limit: 50000,
        });

        const perUserCount: Record<string, number> = {};
        const toDelete: number[] = [];

        for (const m of messages as Array<{ id: number; status1?: string | null; user_id?: string | null; createdAt: string | Date }>) {
          if (m.status1 === 'archived') continue; // שמור לתמיד, לא נספר במכסה

          const userKey = m.user_id ?? '__none__';
          perUserCount[userKey] = (perUserCount[userKey] ?? 0) + 1;

          // createdAt חוזר כמחרוזת או Date תלוי בדרייבר - משווים במילישניות
          const createdMs = new Date(m.createdAt).getTime();
          const tooOld = Number.isFinite(createdMs) && createdMs < cutoffMs;
          const overCap = perUserCount[userKey] > MAX_MESSAGES_PER_USER;
          if (tooOld || overCap) toDelete.push(m.id);
        }

        if (toDelete.length === 0) {
          strapi.log.info('[cron] cleanupOldMessages: אין הודעות למחיקה');
          return;
        }

        let deleted = 0;
        for (const id of toDelete) {
          try {
            await strapi.db.query('api::item.item').delete({ where: { id } });
            deleted++;
          } catch (e) {
            strapi.log.warn(`[cron] cleanupOldMessages: מחיקת item ${id} נכשלה: ${e instanceof Error ? e.message : e}`);
          }
        }

        strapi.log.info(`[cron] ✅ cleanupOldMessages: נמחקו ${deleted}/${toDelete.length} הודעות (מעל 3 חודשים או מעבר ל-${MAX_MESSAGES_PER_USER} למשתמש)`);
      } catch (e) {
        strapi.log.error('[cron] cleanupOldMessages נכשל:', e instanceof Error ? e.message : e);
      }
    },
    options: {
      // כל יום ב-03:15
      rule: '15 3 * * *',
    },
  },
};

export default cronTasks;
