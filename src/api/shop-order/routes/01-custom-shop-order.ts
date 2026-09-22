// נתיבים מותאמים של הזמנות החנות. הקידומת 01- מבטיחה רישום לפני ה-core router
// (אחרת GET /related ו-GET /mine-seller נבלעים ב-GET /:documentId).
//   /related     — המלצות "רכשו גם", אנונימי לחלוטין (מזהי מוצרים וספירות). ציבורי ב-bootstrap.
//   /mine-seller — ההזמנות שכוללות מוצר של המוכר המחובר (לוח המכוונים שלו). role authenticated ב-bootstrap.
export default {
  routes: [
    {
      method: 'GET',
      path: '/shop-orders/related',
      handler: 'shop-order.related',
    },
    {
      method: 'GET',
      path: '/shop-orders/mine-seller',
      handler: 'shop-order.mineSeller',
    },
  ],
};
