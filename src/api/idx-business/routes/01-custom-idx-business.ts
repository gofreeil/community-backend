// נתיבים מותאמים לאינדקס העסקים. הקידומת 01- מבטיחה רישום לפני ה-core router
// (אחרת GET /mine נבלע ב-GET /:id). ההרשאות ניתנות ב-src/index.ts; אכיפת בעלות/תפקיד
// נעשית ב-controller לפי ctx.state.user.
export default {
  routes: [
    { method: 'GET', path: '/idx-businesses/mine', handler: 'idx-business.mine' },
    { method: 'POST', path: '/idx-businesses/:documentId/view', handler: 'idx-business.view' },
    {
      method: 'POST',
      path: '/idx-businesses/:documentId/reveal-phone',
      handler: 'idx-business.revealPhone',
    },
    {
      method: 'POST',
      path: '/idx-businesses/:documentId/recompute-rating',
      handler: 'idx-business.recomputeRating',
    },
  ],
};
