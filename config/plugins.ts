import type { Core } from '@strapi/strapi';

// origins המורשים לקבל את ה-OAuth callback (frontend)
const ALLOWED_OAUTH_ORIGINS = [
    'https://chachmim.gofreeil.com',
    'https://chachmei-haeda.gofreeil.com',
    'https://community.gofreeil.com',
    'https://community-il.gofreeil.com',
    'https://community-il.vercel.app',
    'https://groups.gofreeil.com',
    'https://purchasing-groups.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5191',
];

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
    graphql: {
        enabled: false,
    },
    cloud: {
        enabled: false,
    },
    'users-permissions': {
        config: {
            // עוקפים את ה-default callback validator (שדורש origin+pathname זהים ל-provider.callback)
            // אצלנו provider.callback הוא path של ה-backend, וה-frontend callback הוא URL שונה לחלוטין.
            callback: {
                validate: (callback: string) => {
                    let url: URL;
                    try {
                        url = new URL(callback);
                    } catch {
                        throw new Error('The callback is not a valid URL');
                    }
                    if (!ALLOWED_OAUTH_ORIGINS.includes(url.origin)) {
                        throw new Error(`Forbidden callback origin: ${url.origin}`);
                    }
                },
            },
        },
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
                defaultFrom:    env('EMAIL_FROM', 'noreply@gofreeil.com'),
                defaultReplyTo: env('EMAIL_FROM', 'noreply@gofreeil.com'),
            },
        },
    },
});

export default config;
