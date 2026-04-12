import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
    graphql: {
        enabled: false,
    },
    cloud: {
        enabled: false,
    },
    email: {
        config: {
            provider: 'nodemailer',
            providerOptions: {
                host:   'smtp.resend.com',
                port:   465,
                secure: true,
                auth: {
                    user: 'resend',
                    pass: env('RESEND_API_KEY'),
                },
            },
            settings: {
                defaultFrom:    env('EMAIL_FROM', 'noreply@community-blush.vercel.app'),
                defaultReplyTo: env('EMAIL_FROM', 'noreply@community-blush.vercel.app'),
            },
        },
    },
});

export default config;
