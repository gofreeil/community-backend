// נתיב רישום כניסה. נקרא מהפרונט עם STRAPI_TOKEN (Full Access) - אין צורך בהרשאות public.
export default {
    routes: [
        {
            method: 'POST',
            path: '/visit-stats/track',
            handler: 'visit-stat.track',
        },
    ],
};
