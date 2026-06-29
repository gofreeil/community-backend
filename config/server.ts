import type { Core } from '@strapi/strapi';
import cronTasks from './cron-tasks';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('URL', 'http://localhost:1337'),
  proxy: env.bool('IS_PROXIED', true),
  app: {
    keys: env.array('APP_KEYS'),
  },
  // משימות מתוזמנות - מחיקת הודעות מעל 60 יום (ראה config/cron-tasks.ts)
  cron: {
    enabled: true,
    tasks: cronTasks,
  },
});

export default config;
