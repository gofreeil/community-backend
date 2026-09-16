// כניסה/הצטרפות בקוד SMS. נקרא מאתר הקהילה (הגשר של ה-SSO) עם STRAPI_TOKEN
// (Full Access) — כמו /sso/issue-jwt. הלוגיקה ב-utils/phoneOtp.ts.
export default {
    routes: [
        { method: 'GET',  path: '/sso/phone/status',  handler: 'community-user.phoneOtpStatus' },
        { method: 'POST', path: '/sso/phone/request', handler: 'community-user.phoneOtpRequest' },
        { method: 'POST', path: '/sso/phone/verify',  handler: 'community-user.phoneOtpVerify' },
    ],
};
