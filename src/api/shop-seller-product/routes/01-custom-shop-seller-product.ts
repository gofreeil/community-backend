// "המוצרים שלי" של מוכר בחנות החירות. הקידומת 01- מבטיחה רישום לפני ה-core
// router (אחרת GET /mine נבלע ב-GET /:documentId). ההרשאה ניתנת ל-role
// authenticated ב-bootstrap (src/index.ts); הזיהוי נעשה ב-controller לפי ctx.state.user.
//   GET /mine             ההגשות של המשתמש המחובר
//   PUT /mine/:documentId ניהול מלאי עצמי (כמות/מחיר/אספקה/תיאור/קישור) על מוצר שלו בלבד
//   DELETE /mine/:documentId מחיקת מוצר שלו בלבד
//   GET /link/:id         מוצר בודד לפי מזהה מספרי - גם "לא מוצג בחנות" (unlisted), למי שקיבל קישור. ציבורי ב-bootstrap.
export default {
  routes: [
    {
      method: 'GET',
      path: '/shop-seller-products/link/:id',
      handler: 'shop-seller-product.byLink',
    },
    {
      method: 'GET',
      path: '/shop-seller-products/mine',
      handler: 'shop-seller-product.mine',
    },
    {
      method: 'PUT',
      path: '/shop-seller-products/mine/:documentId',
      handler: 'shop-seller-product.updateMine',
    },
    {
      method: 'DELETE',
      path: '/shop-seller-products/mine/:documentId',
      handler: 'shop-seller-product.deleteMine',
    },
  ],
};
