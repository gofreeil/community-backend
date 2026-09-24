// דירוג ממוצע לכל המוצרים, לייק ותגובה-לתגובה. הקידומת 01- מבטיחה רישום לפני
// ה-core router (אחרת /summary נתפס כ-documentId). ההרשאות ב-bootstrap (src/index.ts).
export default {
  routes: [
    { method: 'GET', path: '/shop-product-comments/summary', handler: 'shop-product-comment.summary' },
    { method: 'POST', path: '/shop-product-comments/:documentId/like', handler: 'shop-product-comment.toggleLike' },
    { method: 'POST', path: '/shop-product-comments/:documentId/reply', handler: 'shop-product-comment.addReply' },
  ],
};
