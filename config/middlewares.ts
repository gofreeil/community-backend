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
          'img-src': ["'self'", 'data:', 'blob:', 'https://community-il.duckdns.org'],
          'media-src': ["'self'", 'data:', 'blob:', 'https://community-il.duckdns.org'],
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
      headers: ['Content-Type', 'Authorization'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
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
