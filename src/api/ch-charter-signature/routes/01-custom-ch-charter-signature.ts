// נתיבי עריכה-עצמית לחתימות האמנה. הקידומת 01- מבטיחה רישום לפני ה-core router
// (אחרת GET /mine נבלע ב-GET /:id). ההרשאה ניתנת ל-role authenticated ב-bootstrap
// (src/index.ts); אכיפת בעלות/תפקיד נעשית ב-controller לפי ctx.state.user.
//
// signed-contacts: שרת-לשרת בלבד (STRAPI_TOKEN) - לזיהוי אוטומטי באתרי-אחות, ראה
// controller. לא נרשם ב-bootstrap permissions כי טוקן API עוקף את ה-RBAC ממילא
// (כמו admin/sms/* ב-community-user) - requireServerToken בקוד עצמו הוא האכיפה.
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
        {
            method: 'GET',
            path: '/ch-charter-signatures/signed-contacts',
            handler: 'ch-charter-signature.signedContacts',
        },
    ],
};
