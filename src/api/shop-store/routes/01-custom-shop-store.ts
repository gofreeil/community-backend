// החנות של המוכר המחובר בחנות החירות: קריאה (mine) ושמירה (upsert - יצירה או
// עדכון של הרשומה היחידה שלו). הקידומת 01- מבטיחה רישום לפני ה-core router
// (אחרת GET /mine נבלע ב-GET /:documentId). ההרשאה ניתנת ל-role authenticated
// ב-bootstrap (src/index.ts); הזיהוי נעשה ב-controller לפי ctx.state.user.
export default {
  routes: [
    { method: 'GET', path: '/shop-stores/mine', handler: 'shop-store.mine' },
    { method: 'POST', path: '/shop-stores/upsert', handler: 'shop-store.upsert' },
  ],
};
