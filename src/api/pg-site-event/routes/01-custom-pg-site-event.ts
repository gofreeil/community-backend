// מוני התנועה של אתר קבוצות הרכישה.
//   POST /pg-site-events/track   - רישום אירוע אחד (ציבורי; נקרא משרת האתר, בלי טוקן)
//   GET  /pg-site-events/summary - סיכום למסך הניהול (משתמש מחובר; ה-controller דוחה מי שאינו צוות)
// ההרשאות ניתנות ב-bootstrap (src/index.ts).
export default {
    routes: [
        {
            method: 'POST',
            path: '/pg-site-events/track',
            handler: 'pg-site-event.track',
        },
        {
            method: 'GET',
            path: '/pg-site-events/summary',
            handler: 'pg-site-event.summary',
        },
    ],
};
