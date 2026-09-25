// נתיבים מותאמים של הזמנות החנות. הקידומת 01- מבטיחה רישום לפני ה-core router
// (אחרת GET /related, GET /mine ו-GET /mine-seller נבלעים ב-GET /:documentId).
//   /related     — המלצות "רכשו גם", אנונימי לחלוטין (מזהי מוצרים וספירות). ציבורי ב-bootstrap.
//   /mine        — ההזמנות של המשתמש המחובר (דף החשבון בחנות). role authenticated ב-bootstrap.
//   PUT /mine/:documentId/cancel — הלקוח מבטל הזמנה שלו כל עוד אף מוכר לא טיפל בה.
//   PUT /mine-seller/:documentId — המוכר מעדכן סטטוס אספקה + מספר מעקב לפריטים שלו.
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
      path: '/shop-orders/mine',
      handler: 'shop-order.mine',
    },
    {
      method: 'GET',
      path: '/shop-orders/mine-seller',
      handler: 'shop-order.mineSeller',
    },
    {
      method: 'PUT',
      path: '/shop-orders/mine-seller/:documentId',
      handler: 'shop-order.updateMineSeller',
    },
    {
      method: 'PUT',
      path: '/shop-orders/mine/:documentId/cancel',
      handler: 'shop-order.cancelMine',
    },
  ],
};
