// נקראים מהפרונט עם STRAPI_TOKEN (Full Access) - אין צורך בהרשאות public.
export default {
    routes: [
        { method: 'POST', path: '/app-installs/track', handler: 'app-install.track' },
        { method: 'GET', path: '/app-installs/summary', handler: 'app-install.summary' },
    ],
};
