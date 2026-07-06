import type { Core } from '@strapi/strapi';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_MESSAGES_PER_USER = 100;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DELETE_RETENTION_MS = 30 * ONE_DAY_MS; // חלון שחזור: 30 יום ממחיקה רכה
const WARN_BEFORE_MS = 7 * ONE_DAY_MS;       // תזכורת: כשנותרו ≤7 ימים

/** יצירת הודעת מערכת למשתמש (פריט category='message' מפורסם) */
async function notifyUser(
  strapi: Core.Strapi,
  userId: string | null | undefined,
  label: string,
  description: string,
  icon: string,
  type: string,
  itemLabel: string,
): Promise<void> {
  if (!userId) return;
  try {
    await strapi.db.query('api::item.item').create({
      data: {
        category: 'message',
        label,
        description,
        contact: 'מערכת קהילה בשכונה',
        user_id: userId,
        icon,
        color: 'red',
        status1: 'active',
        extra_fields: {
          type,
          sender_name: 'מערכת קהילה בשכונה',
          item_label: itemLabel,
          read: false,
        },
        publishedAt: new Date(),
      },
    });
  } catch (e) {
    strapi.log.warn(`[cron] notifyUser נכשל (${type}): ${e instanceof Error ? e.message : e}`);
  }
}

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

  /**
   * purgeDeletedItems: טיהור נכסים שנמחקו מחיקה רכה (status1='deleted').
   * - נכס בן ≥30 יום: שולח הודעת "נמחק לצמיתות" ומוחק אותו סופית.
   * - נכס שנותרו לו ≤7 ימים לשחזור: שולח פעם אחת תזכורת "שבוע למחיקה ללא שחזור".
   * (הודעת "הנכס ירד מהמפה" נשלחת מיידית ע"י הפרונט בעת המחיקה הרכה.)
   * רץ כל יום ב-03:30.
   */
  purgeDeletedItems: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        const now = Date.now();
        // בלי select מפורש - כדי לוודא ש-extra_fields (JSON) חוזר בכל דרייבר
        const items = await strapi.db.query('api::item.item').findMany({
          where: { status1: 'deleted' },
          limit: 50000,
        });

        let purged = 0;
        let warned = 0;

        for (const it of items as Array<{ id: number; user_id?: string | null; label?: string | null; extra_fields?: Record<string, unknown> | null }>) {
          const ef = (it.extra_fields && typeof it.extra_fields === 'object') ? { ...it.extra_fields } : {};
          const itemLabel = String(it.label ?? 'הנכס');
          const deletedAtRaw = ef.deleted_at;
          const deletedMs = typeof deletedAtRaw === 'string' ? new Date(deletedAtRaw).getTime() : NaN;

          // חסר תאריך מחיקה (רשומה ישנה) - מאתחלים אותו כדי שהספירה תתחיל מהיום
          if (!Number.isFinite(deletedMs)) {
            ef.deleted_at = new Date(now).toISOString();
            try {
              await strapi.db.query('api::item.item').update({ where: { id: it.id }, data: { extra_fields: ef } });
            } catch (e) {
              strapi.log.warn(`[cron] purgeDeletedItems: איתחול deleted_at ל-item ${it.id} נכשל: ${e instanceof Error ? e.message : e}`);
            }
            continue;
          }

          const ageMs = now - deletedMs;

          if (ageMs >= DELETE_RETENTION_MS) {
            // מחיקה סופית + הודעה
            await notifyUser(
              strapi, it.user_id,
              '🗑 הנכס נמחק לצמיתות',
              `הנכס "${itemLabel}" נמחק לצמיתות לאחר 30 יום ולא ניתן עוד לשחזר אותו.\n\nאפשר ליצור נכס חדש בכל עת דרך "הוספת נכס".`,
              '🗑', 'item_deleted_forever', itemLabel,
            );
            try {
              await strapi.db.query('api::item.item').delete({ where: { id: it.id } });
              purged++;
            } catch (e) {
              strapi.log.warn(`[cron] purgeDeletedItems: מחיקת item ${it.id} נכשלה: ${e instanceof Error ? e.message : e}`);
            }
          } else if (DELETE_RETENTION_MS - ageMs <= WARN_BEFORE_MS && !ef.deletion_warned) {
            // תזכורת שבוע לפני - פעם אחת בלבד
            await notifyUser(
              strapi, it.user_id,
              '⏳ שבוע למחיקת הנכס לצמיתות',
              `הנכס "${itemLabel}" יימחק לצמיתות בעוד כשבוע, ללא אפשרות שחזור.\n\nאם ברצונך לשמור אותו - היכנס/י ל"הנכסים שלי" בפרופיל ולחצ/י "שחזר נכס". לאחר המחיקה הסופית לא ניתן לשחזר - רק ליצור נכס חדש.`,
              '⏳', 'item_deletion_warning', itemLabel,
            );
            ef.deletion_warned = true;
            try {
              await strapi.db.query('api::item.item').update({ where: { id: it.id }, data: { extra_fields: ef } });
              warned++;
            } catch (e) {
              strapi.log.warn(`[cron] purgeDeletedItems: סימון deletion_warned ל-item ${it.id} נכשל: ${e instanceof Error ? e.message : e}`);
            }
          }
        }

        strapi.log.info(`[cron] ✅ purgeDeletedItems: נמחקו לצמיתות ${purged}, נשלחו ${warned} תזכורות (מתוך ${items.length} נכסים מחוקים)`);
      } catch (e) {
        strapi.log.error('[cron] purgeDeletedItems נכשל:', e instanceof Error ? e.message : e);
      }
    },
    options: {
      // כל יום ב-03:30
      rule: '30 3 * * *',
    },
  },
};

export default cronTasks;
