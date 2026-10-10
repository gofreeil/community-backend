// עריכת כיתובי האתרים מתוך האתר (סופר-אדמין) — ראו controllers/site-edit.ts.
//   GET  /site-edit/texts?site=<id>  - כיתובים שנערכו לאתר (ציבורי; האתרים טוענים בכל כניסה)
//   GET  /site-edit/me               - האם הגולש סופר-אדמין, והאם אימת קוד Authenticator
//   POST /site-edit/verify           - קוד Google Authenticator -> עוגיית עריכה ל-12 שעות
//   POST /site-edit/save             - שמירת שינויים (סופר-אדמין + עוגיית העריכה)
// auth: false בכוונה: הזיהוי מגיע מהעוגייה המשותפת gofreeil-auth (httpOnly, .gofreeil.com) ולא מ-Bearer,
// ולכן ה-controller מזהה בעצמו. אין צורך בהרשאה ב-bootstrap (src/index.ts).
export default {
  routes: [
    { method: 'GET', path: '/site-edit/texts', handler: 'site-edit.texts', config: { auth: false } },
    { method: 'GET', path: '/site-edit/me', handler: 'site-edit.me', config: { auth: false } },
    { method: 'POST', path: '/site-edit/verify', handler: 'site-edit.verify', config: { auth: false } },
    { method: 'POST', path: '/site-edit/save', handler: 'site-edit.save', config: { auth: false } },
  ],
};
