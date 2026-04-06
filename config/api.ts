import type { Core } from '@strapi/strapi';

const config: Core.Config.Api = {
  rest: {
    defaultLimit: 100,
    maxLimit: 1000,
    withCount: true,
  },
};

export default config;
