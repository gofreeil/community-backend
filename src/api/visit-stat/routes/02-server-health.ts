// GET /api/server-health — מדדי בריאות/עומס השרת ללוח האדמין.
// יושב על ה-controller של visit-stat (API קיים) כדי לא ליצור API חדש בבאקאנד
// המשותף. נקרא מהפרונט עם STRAPI_TOKEN (Full Access), לכן אין צורך בהרשאות public.
export default {
    routes: [
        {
            method: 'GET',
            path: '/server-health',
            handler: 'visit-stat.health',
        },
    ],
};
