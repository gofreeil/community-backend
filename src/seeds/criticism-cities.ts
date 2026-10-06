import type { Core } from '@strapi/strapi';

// הערים של "מבקר רשויות המדינה" (criticism), בשמות שהאתר שולח (src/lib/cities.ts שם: CITY_MAP).
// "all" = חדשות ארציות. זריעה אידמפוטנטית: עיר שכבר קיימת (לפי name) לא נוגעים בה, כך שאפשר
// להוסיף ערים ידנית בפאנל בלי שה-bootstrap יכפיל או ידרוס אותן.
const CRITICISM_CITIES = [
    'all', 'Netanya', 'Tel Aviv', 'Haifa', 'Jerusalem', 'Beer Sheva', 'Petah Tikva', 'Ashdod', 'Rehovot',
    'Rishon Lezion', 'Bat Yam', 'Holon', 'Ramat Gan', 'Kfar Saba', 'Hod Hasharon', 'Beit Shemesh', 'Netivot',
    'Ashkelon', 'Yavne', 'Modiin', 'Tiberias', 'Ariel', 'Raanana', 'Nazareth', 'Bat Eila', 'Ramat HaSharon',
    'Herzliya', 'Givatayim', 'Kiryat Ata', 'Kiryat Gat', 'Kiryat Motzkin', 'Kiryat Yam', 'Kiryat Bialik',
    'Kiryat Ono', 'Kiryat Haim', 'Kiryat Shmona', 'Kiryat Arba',
];

export async function seedCriticismCities(strapi: Core.Strapi) {
    try {
        const existing = await strapi.documents('api::city.city').findMany({
            fields: ['name'],
            limit: 1000,
        });
        const have = new Set(existing.map((c: { name?: string }) => (c.name ?? '').trim()));
        let created = 0;
        for (const name of CRITICISM_CITIES) {
            if (have.has(name)) continue;
            await strapi.documents('api::city.city').create({ data: { name }, status: 'published' });
            created++;
        }
        if (created) strapi.log.info(`[bootstrap] ✅ criticism: נוספו ${created} ערים`);
    } catch (e) {
        // best-effort: כישלון בזריעה לא מפיל את השרת של כל האתרים
        strapi.log.warn('[bootstrap] seedCriticismCities נכשל:', e instanceof Error ? e.message : String(e));
    }
}
