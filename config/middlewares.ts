import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://api.gofreeil.com'],
          'media-src': ["'self'", 'data:', 'blob:', 'https://api.gofreeil.com'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5555',
        // Domain אחיד — gofreeil.com (apex) + סאב-דומיינים מפורשים
        'https://gofreeil.com',
        'https://chachmim.gofreeil.com',
        'https://chachmei-haeda.gofreeil.com',
        'https://community.gofreeil.com',
        'https://community-il.gofreeil.com',
        'https://shop.gofreeil.com',
        'https://referendum.gofreeil.com',
        'https://criticism.gofreeil.com',
        'https://national-gemach.gofreeil.com',
        'https://purchasing-groups.gofreeil.com',
        'https://the-experts.gofreeil.com',
        'https://public-rating.gofreeil.com',
        'https://investors-group.gofreeil.com',
        'https://neighborhoods.gofreeil.com',
        'https://index.gofreeil.com',
        // אתרים שטוענים את עורך הכיתובים (public/site-editor.js) - הוא קורא ל-/api/site-edit/* מהדפדפן עם עוגיות.
        // מחרוזות מפורשות בלבד: ה-cors של Strapi משווה ב-includes, ולכן ה-regex שבהמשך אינו תופס כלום.
        'https://singles.gofreeil.com',
        'https://avedot.gofreeil.com',
        'https://gemach.gofreeil.com',
        'https://rating.gofreeil.com',
        'https://experts.gofreeil.com',
        'https://groups.gofreeil.com',
        // fallback regex (אם משום מה לא נתפס)
        /^https:\/\/[a-z0-9-]+\.gofreeil\.com$/,
        // Vercel.app legacy — נשמרים זמנית עד להשלמת ההגירה
        'https://community-il.vercel.app',
        /^https:\/\/community-il-.*\.vercel\.app$/,
        'https://purchasing-groups.vercel.app',
        /^https:\/\/purchasing-groups-.*\.vercel\.app$/,
        /^https:\/\/purchasing_groups-.*\.vercel\.app$/,
        'https://chachmei-haeda.vercel.app',
        /^https:\/\/chachmei-haeda-.*\.vercel\.app$/,
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      // X-Requested-With: כותרת האבטחה של /site-edit/save (כופה preflight)
      headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      // גלריית תמונות של מוצר בחנות החירות: עד 6 תמונות כ-data URL (~450KB
      // כל אחת) בבקשת JSON אחת. ברירת המחדל (1mb) חסמה יותר מתמונה אחת.
      jsonLimit: '8mb',
    },
  },
  {
    name: 'strapi::session',
    config: {
      // OAuth דורש session cross-domain. Strapi default = secure:true ב-production
      // אבל Koa לא מזהה HTTPS מאחורי nginx proxy → cookie נכשל. מבטלים secure.
      secure: false,
      sameSite: 'lax',
      httpOnly: true,
    },
  },
  'strapi::favicon',
  'strapi::public',
];

export default config;
