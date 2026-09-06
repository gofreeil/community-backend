// המלצות "לקוחות שהתעניינו במוצר זה רכשו גם" - נגזרות מההזמנות, אנונימי לחלוטין
// (רק מזהי מוצרים וספירות). הקידומת 01- מבטיחה רישום לפני ה-core router
// (אחרת GET /related נבלע ב-GET /:documentId). ההרשאה ציבורית ב-bootstrap.
export default {
  routes: [
    {
      method: 'GET',
      path: '/shop-orders/related',
      handler: 'shop-order.related',
    },
  ],
};
