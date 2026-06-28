// נתיבים ציבוריים ללייק/תגובה על תגובת שביעות-רצון.
// ההרשאה ניתנת ל-role authenticated ב-bootstrap (src/index.ts); הזיהוי לפי ctx.state.user.
export default {
    routes: [
        {
            method: 'POST',
            path: '/pg-satisfaction-responses/:documentId/like',
            handler: 'pg-satisfaction-response.toggleLike',
        },
        {
            method: 'POST',
            path: '/pg-satisfaction-responses/:documentId/reply',
            handler: 'pg-satisfaction-response.addReply',
        },
    ],
};
