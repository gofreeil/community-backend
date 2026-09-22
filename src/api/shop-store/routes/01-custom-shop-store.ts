// החנות של המוכר המחובר בחנות החירות: קריאה (mine) ושמירה (upsert - יצירה או
// עדכון של הרשומה היחידה שלו), ולידה נקודת קצה ציבורית אחת: design - עיצוב
// דף החנות של חנות מאושרת, שכל מבקר בדף החנות טוען.
//
// הקידומת 01- מבטיחה רישום לפני ה-core router (אחרת GET /mine נבלע ב-GET
// /:documentId). ההרשאות ניתנות ב-bootstrap (src/index.ts): mine/upsert/design
// ל-authenticated, design גם ל-public; הזיהוי נעשה ב-controller לפי ctx.state.user.
export default {
  routes: [
    { method: 'GET', path: '/shop-stores/mine', handler: 'shop-store.mine' },
    { method: 'POST', path: '/shop-stores/upsert', handler: 'shop-store.upsert' },
    { method: 'GET', path: '/shop-stores/design', handler: 'shop-store.design' },
  ],
};
