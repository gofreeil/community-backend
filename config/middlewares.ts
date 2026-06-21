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
        'https://community-il.vercel.app',
        /^https:\/\/community-il-.*\.vercel\.app$/, // Vercel preview deployments
        // Purchasing-Groups
        'https://purchasing-groups.vercel.app',
        /^https:\/\/purchasing-groups-.*\.vercel\.app$/,
        /^https:\/\/purchasing_groups-.*\.vercel\.app$/,
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
