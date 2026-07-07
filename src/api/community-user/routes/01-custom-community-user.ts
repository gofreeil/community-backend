// נתיב SSO: מנפיק JWT של users-permissions למשתמש קיים לפי אימייל.
// נקרא מהפרונט עם STRAPI_TOKEN (Full Access) — כמו visit-stats/track.
// מאפשר לגשר ה-SSO (community.gofreeil.com/sso) להשיג טוקן חי למשתמש מחובר
// שאין לו סיסמה ידועה (OAuth/מיזוג), בלי משחקי איפוס-סיסמה שלא עובדים על
// Strapi 5 (PUT /users/:id לא מייצר סיסמה שמישה לכניסה).
export default {
    routes: [
        {
            method: 'POST',
            path: '/sso/issue-jwt',
            handler: 'community-user.issueSsoJwt',
        },
    ],
};
