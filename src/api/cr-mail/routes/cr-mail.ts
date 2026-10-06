// שליחת מייל דרך ה-email plugin של ה-Strapi המשותף (Resend). נקרא משרת "מבקר רשויות המדינה" עם
// API Token בלבד — ל-roles אין הרשאה לפעולה הזו (ה-controller בודק isTrusted בנוסף).
export default {
    routes: [
        {
            method: 'POST',
            path: '/cr-mail/send',
            handler: 'cr-mail.send',
        },
    ],
};
