// חיבור אתרים חיצוניים ליוצאים לחירות (ראה utils/externalSso.ts).
// users / exchange: שרת-לשרת, auth: false - האימות הוא חתימת Ed25519 שנבדקת ב-controller.
// code / my-profile: משתמש מחובר (JWT); ההרשאה ל-role authenticated מוקצית ב-bootstrap (src/index.ts).
export default {
    routes: [
        { method: 'POST', path: '/external-sso/users', handler: 'external-sso.users', config: { auth: false } },
        { method: 'POST', path: '/external-sso/exchange', handler: 'external-sso.exchange', config: { auth: false } },
        { method: 'POST', path: '/external-sso/code', handler: 'external-sso.code' },
        { method: 'POST', path: '/external-sso/my-profile', handler: 'external-sso.myProfile' },
    ],
};
