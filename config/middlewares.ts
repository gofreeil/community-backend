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
        // Domain אחיד — gofreeil.com (apex) + כל הסאב-דומיינים
        'https://gofreeil.com',
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
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
