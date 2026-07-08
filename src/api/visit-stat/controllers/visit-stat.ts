import { factories } from '@strapi/strapi';
import os from 'node:os';
import fs from 'node:fs/promises';

const UID = 'api::visit-stat.visit-stat';

// חודש נוכחי לפי שעון ישראל, בפורמט YYYY-MM (en-CA נותן YYYY-MM-DD)
function currentMonth(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).slice(0, 7);
}

// ============================================================
// server-health — מדדי בריאות/עומס של שרת ה-VPS (למד המכוונים בלוח האדמין).
// יושב על ה-controller של visit-stat (API קיים ובדוק) כדי לא ליצור API חדש
// חסר-content-type בבאקאנד המשותף ל-13 אתרים. הנתיב עצמו: GET /api/server-health.
// הערכים משקפים את המארח (VPS) ולא רק את המיכל: os.loadavg ו-/proc/meminfo הם
// ברמת הקרנל המשותף, ו-statfs('/') מדווח על מחיצת המארח שמתחת ל-overlay של Docker.
// ============================================================
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const toGb = (bytes: number) => round1(bytes / 1024 / 1024 / 1024);

// המרת "אחוז ניצולת גולמי" (0-100) ל"עומס" מכויל (0-100) בעקומה מציאותית:
// עד 70% נוח (0-50), 70-85% התחל לעקוב (50-70), 85-95% גבוה (70-90), 95%+ קריטי.
// כך 66% זיכרון יוצא ~5/10 (בינוני) ולא 7/10, ורק רוויה אמיתית מגיעה ל-8-10.
const loadFromUtil = (u: number) => {
    if (u <= 70) return (u / 70) * 50;
    if (u <= 85) return 50 + ((u - 70) / 15) * 20;
    if (u <= 95) return 70 + ((u - 85) / 10) * 20;
    return 90 + ((u - 95) / 5) * 10;
};
const scoreFromLoad = (load: number) => clamp(Math.round(load / 10), 1, 10) || 1;

// זיכרון אמיתי בשימוש: MemTotal - MemAvailable (MemAvailable מנטרל cache/buffers
// שמשתחררים בלחץ — הלחץ האמיתי, בניגוד ל-os.freemem שמדווח MemFree).
async function readMem(): Promise<{ total: number; used: number }> {
    try {
        const raw = await fs.readFile('/proc/meminfo', 'utf8');
        const kb = (key: string) => {
            const m = raw.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, 'm'));
            return m ? parseInt(m[1], 10) * 1024 : null;
        };
        const total = kb('MemTotal');
        const avail = kb('MemAvailable');
        if (total && avail != null) return { total, used: Math.max(0, total - avail) };
    } catch {
        /* לא לינוקס / אין /proc — ניפול ל-os */
    }
    const total = os.totalmem();
    return { total, used: Math.max(0, total - os.freemem()) };
}

async function readDisk(): Promise<{ total: number; used: number } | null> {
    try {
        const st: any = await (fs as any).statfs('/');
        const total = st.blocks * st.bsize;
        const free = st.bfree * st.bsize;
        return { total, used: Math.max(0, total - free) };
    } catch {
        return null;
    }
}

async function readDbLatencyMs(): Promise<number | null> {
    try {
        const start = performance.now();
        await (strapi as any).db.connection.raw('SELECT 1');
        return performance.now() - start;
    } catch {
        return null;
    }
}

export default factories.createCoreController(UID, () => ({
    // רישום כניסה אחת למונה של החודש הנוכחי (find-or-create + increment אטומי)
    async track(ctx) {
        const month = currentMonth();
        const existing = await strapi.db.query(UID).findOne({ where: { month } });
        if (existing) {
            // increment ברמת ה-DB - עמיד לבקשות מקבילות, בניגוד לקריאה+כתיבה
            await strapi.db.connection('visit_stats').where({ id: existing.id }).increment('count', 1);
        } else {
            await strapi.db.query(UID).create({ data: { month, count: 1 } });
        }
        ctx.body = { ok: true, month };
    },

    // מדדי בריאות/עומס השרת ללוח המכוונים. נקרא מהפרונט עם STRAPI_TOKEN.
    async health(ctx) {
        const cores = os.cpus()?.length || 1;
        const load = os.loadavg();               // [1m, 5m, 15m]
        const load1 = load[0] ?? 0;

        // מעבד: עומס-לליבה. יחס 1.0 = כל הליבות עסוקות בממוצע; 1.5 = רוויה
        const cpuRatio = load1 / cores;
        const cpuUtil = clamp((cpuRatio / 1.5) * 100, 0, 100);

        // זיכרון
        const mem = await readMem();
        const ramUtil = mem.total ? clamp((mem.used / mem.total) * 100, 0, 100) : 0;

        // דיסק
        const disk = await readDisk();
        const diskUtil = disk && disk.total ? clamp((disk.used / disk.total) * 100, 0, 100) : 0;

        // זמן תגובה (DB): בריא < ~10ms; 300ms נחשב רוויה
        const latency = await readDbLatencyMs();
        const respUtil = latency == null ? 0 : clamp((latency / 300) * 100, 0, 100);

        // "עומס" מכויל לכל מדד (0-100) + ציון 1-10. util = ניצולת גולמית (לתצוגה).
        const cpuLoad  = loadFromUtil(cpuUtil);
        const ramLoad  = loadFromUtil(ramUtil);
        const diskLoad = disk ? loadFromUtil(diskUtil) : 0;
        const respLoad = latency == null ? 0 : loadFromUtil(respUtil);

        const metrics = {
            cpu: {
                score: scoreFromLoad(cpuLoad), load: Math.round(cpuLoad), util: Math.round(cpuUtil),
                load1: round1(load1), load5: round1(load[1] ?? 0), load15: round1(load[2] ?? 0),
                cores, ratio: round1(cpuRatio),
            },
            ram: {
                score: scoreFromLoad(ramLoad), load: Math.round(ramLoad), util: Math.round(ramUtil),
                usedGb: toGb(mem.used), totalGb: toGb(mem.total),
            },
            disk: disk ? {
                score: scoreFromLoad(diskLoad), load: Math.round(diskLoad), util: Math.round(diskUtil),
                usedGb: toGb(disk.used), totalGb: toGb(disk.total),
            } : null,
            response: {
                score: latency == null ? 1 : scoreFromLoad(respLoad), load: Math.round(respLoad),
                util: Math.round(respUtil), latencyMs: latency == null ? null : round1(latency),
            },
        };

        // ציון עומס כולל = לפי המשאב הצפוף ביותר (צוואר הבקבוק) — הוא שקובע מתי לשדרג
        const parts = [
            { key: 'cpu', label: 'מעבד', util: cpuUtil },
            { key: 'ram', label: 'זיכרון', util: ramUtil },
            ...(disk ? [{ key: 'disk', label: 'דיסק', util: diskUtil }] : []),
            { key: 'response', label: 'זמן תגובה', util: respUtil },
        ];
        const bottleneck  = parts.reduce((a, b) => (b.util > a.util ? b : a));
        const overallUtil = bottleneck.util;
        const overallLoad = loadFromUtil(overallUtil);
        const score       = scoreFromLoad(overallLoad);
        const status =
            score >= 9 ? 'critical' :
            score >= 7 ? 'high' :
            score >= 5 ? 'moderate' : 'healthy';

        ctx.body = {
            ok: true,
            timestamp: new Date().toISOString(),
            score,
            load: Math.round(overallLoad),
            util: Math.round(overallUtil),
            status,
            bottleneck: { key: bottleneck.key, label: bottleneck.label },
            metrics,
            uptimeSec: Math.round(os.uptime()),
            hostname: os.hostname(),
        };
    },
}));
