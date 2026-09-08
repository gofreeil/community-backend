// upsert לפי key - העורך בחנות שומר דריסה בלי לדעת אם כבר קיימת. הקידומת 01-
// מבטיחה רישום לפני ה-core router. ההרשאה ניתנת ל-authenticated ב-bootstrap
// (src/index.ts); ה-controller פותח בפועל רק לסופר-אדמין.
export default {
  routes: [
    {
      method: 'POST',
      path: '/shop-site-overrides/upsert',
      handler: 'shop-site-override.upsert',
    },
  ],
};
