// תמיכה וסגירה/דירוג — מחובר בלבד; ה-controller בודק בעלות. נרשם לפני ה-core router.
export default {
    routes: [
        {
            method: 'POST',
            path: '/inquiries/:documentId/support',
            handler: 'inquiry.support',
        },
        {
            method: 'POST',
            path: '/inquiries/:documentId/close',
            handler: 'inquiry.close',
        },
    ],
};
