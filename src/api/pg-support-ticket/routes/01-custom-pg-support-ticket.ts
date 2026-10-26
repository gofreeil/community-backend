// פניות תמיכה (צאט) - כל הנתיבים למחוברים בלבד; ההרשאה לפי בעלות/תפקיד נאכפת ב-controller.
// אין core router בכוונה: אין גישת CRUD גולמית לאף תפקיד.
export default {
    routes: [
        { method: 'GET', path: '/pg-support-tickets/inbox', handler: 'pg-support-ticket.inbox' },
        { method: 'POST', path: '/pg-support-tickets/open', handler: 'pg-support-ticket.open' },
        { method: 'GET', path: '/pg-support-tickets/thread/:documentId', handler: 'pg-support-ticket.thread' },
        { method: 'POST', path: '/pg-support-tickets/:documentId/message', handler: 'pg-support-ticket.message' },
        { method: 'POST', path: '/pg-support-tickets/:documentId/manage', handler: 'pg-support-ticket.manage' },
    ],
};
