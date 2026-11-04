import { factories } from '@strapi/strapi';

const UID = 'api::app-install.app-install';
const PLATFORMS = ['android', 'ios', 'desktop'];
const SOURCES = ['appinstalled', 'standalone_launch'];

export default factories.createCoreController(UID, () => ({
    // רישום מכשיר שהתקין את האפליקציה. מכשיר אחד נספר פעם אחת לכל אתר (device_id + site).
    async track(ctx) {
        const b = (ctx.request.body ?? {}) as Record<string, unknown>;
        const site = String(b.site ?? '').trim().slice(0, 60);
        const deviceId = String(b.deviceId ?? '').trim().slice(0, 80);
        if (!site || !deviceId) return ctx.badRequest('site and deviceId are required');
        const platform = PLATFORMS.includes(String(b.platform)) ? String(b.platform) : 'desktop';
        const source = SOURCES.includes(String(b.source)) ? String(b.source) : 'standalone_launch';

        const existing = await strapi.db.query(UID).findOne({ where: { site, device_id: deviceId } });
        if (existing) {
            // appinstalled הוא האות החזק; מעדכנים אליו אם נרשם קודם כהפעלה
            if (source === 'appinstalled' && existing.source !== 'appinstalled') {
                await strapi.db.query(UID).update({ where: { id: existing.id }, data: { source } });
            }
            ctx.body = { ok: true, duplicate: true };
            return;
        }
        await strapi.db.query(UID).create({
            data: { site, device_id: deviceId, platform, source, user_agent: String(b.userAgent ?? '').slice(0, 250) },
        });
        ctx.body = { ok: true, duplicate: false };
    },

    // סיכום לאדמין: סה"כ, לפי אתר, לפי פלטפורמה, ו-30 הימים האחרונים
    async summary(ctx) {
        const rows = await strapi.db.query(UID).findMany({
            select: ['site', 'platform', 'createdAt'],
            limit: 100000,
        });
        const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const bySite: Record<string, { total: number; android: number; ios: number; desktop: number; last30: number }> = {};
        const byPlatform: Record<string, number> = { android: 0, ios: 0, desktop: 0 };
        let last30 = 0;
        for (const r of rows as Array<{ site: string; platform: string; createdAt: string }>) {
            const s = (bySite[r.site] ??= { total: 0, android: 0, ios: 0, desktop: 0, last30: 0 });
            s.total++;
            if (r.platform in byPlatform) { byPlatform[r.platform]++; (s as any)[r.platform]++; }
            if (new Date(r.createdAt).getTime() >= since) { s.last30++; last30++; }
        }
        ctx.body = { total: rows.length, last30, byPlatform, bySite };
    },
}));
