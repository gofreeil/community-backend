// נתיבי עריכה-עצמית לחתימות האמנה. הקידומת 01- מבטיחה רישום לפני ה-core router
// (אחרת GET /mine נבלע ב-GET /:id). ההרשאה ניתנת ל-role authenticated ב-bootstrap
// (src/index.ts); אכיפת בעלות/תפקיד נעשית ב-controller לפי ctx.state.user.
export default {
    routes: [
        {
            method: 'GET',
            path: '/ch-charter-signatures/mine',
            handler: 'ch-charter-signature.mine',
        },
        {
            method: 'PUT',
            path: '/ch-charter-signatures/:documentId/self-update',
            handler: 'ch-charter-signature.selfUpdate',
        },
    ],
};
