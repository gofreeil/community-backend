// SMS יזום מהמנהל לקבוצת משתמשים (למשל: "השלימו עיר ושכונה בפרופיל").
// נקרא מעמוד הניהול של אתר הקהילה עם STRAPI_TOKEN (Full Access) — כמו /sso/issue-jwt.
// השליחה עצמה דרך utils/sms.ts (אותם ספקים ואותם משתני סביבה כמו קוד ה-OTP).
export default {
    routes: [
        { method: 'GET',  path: '/admin/sms/status', handler: 'community-user.adminSmsStatus' },
        { method: 'POST', path: '/admin/sms/send',   handler: 'community-user.adminSmsSend' },
    ],
};
