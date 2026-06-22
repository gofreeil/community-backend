import type { Core } from '@strapi/strapi';

// תוכן/מבנה של קמפיינים - בלי מספרים. נתוני חברים/חיסכון מגיעים מ-Google Sheet.
// נמתח רק אם אין רשומות בכלל - שלא לדרוס תוכן שהמשתמש ערך ידנית.
const CAMPAIGNS = [
    {
        slug: 'cellular',
        title: 'סלולר חוסכוני',
        description: 'מסלולי סלולר זולים במיוחד מבית רמי לוי, אקס פון ווויקום',
        icon: '📱',
        image_url: '/assets/cellular.jpg',
        order: 1,
        status: 'active',
        can_join: true,
        providers_line: 'מסלולים בחברת רמי לוי, אקס פון, וויקום',
        rating_companies: ['רמי לוי', 'אקס פון', 'וויקום'],
        join_link: 'https://docs.google.com/forms/d/e/1FAIpQLSfRCs5W7HUuc5vcOuMGqsqaDubzNBn4YuC4UDbvoFmSCdJAiQ/viewform?usp=header',
        join_cta_subtitle: 'לקו הסלולר הזול במדינה - חברות רמי לוי / אקס פון / וויקום',
        find_section: {
            title: 'בדוק את הרשתות המומלצות בשכונה/ עבודה שלך',
            href: 'https://tiber.co.il/Home/Antenna',
            image: '/assets/coverage-banner.png',
            imageAlt: 'בדיקת קליטה סלולרית',
            ariaLabel: 'לבדיקת קליטה ב-tiber.co.il',
            label: 'לבדיקת קליטה ↗',
        },
        plans_table: {
            title: 'בחירת מסלול',
            headers: [
                'שם חברה',
                'שם התוכנית',
                'רשת בדור',
                'דקות/<br />סמסים',
                'חבילת גלישה ג\'יגה',
                'עלות ממוצעת לקו לשנה',
                'עלות סים',
                'עלות משלוח',
                'רובץ על רשת',
            ],
            rows: [
                {
                    title: 'תוכנית א\'', company: 'רמי לוי',
                    cells: [
                        { label: 'שם חברה', value: 'רמי לוי' },
                        { label: 'שם התוכנית', value: 'תוכנית א\'' },
                        { label: 'רשת בדור', value: '4/5' },
                        { label: 'דקות/סמסים', value: '2500' },
                        { label: 'חבילת גלישה ג\'יגה', value: '150' },
                        { label: 'עלות ממוצעת לקו לשנה', value: '14.9' },
                        { label: 'עלות סים', html: '<span class="no-cost-icon">🚫</span><br />ללא עלות' },
                        { label: 'עלות משלוח', html: '<span class="no-cost-icon">🚫</span><br />ללא עלות' },
                        { label: 'רובץ על רשת', image: { src: '/images/פלאפון.jfif', alt: 'פלאפון' } },
                    ],
                },
                {
                    title: 'תוכנית ב\' (עד 8 קווים)', company: 'רמי לוי',
                    cells: [
                        { label: 'שם חברה', value: 'רמי לוי' },
                        { label: 'שם התוכנית', value: 'תוכנית ב\' (עד 8 קווים)' },
                        { label: 'רשת בדור', value: '4/5' },
                        { label: 'דקות/סמסים', value: '5000' },
                        { label: 'חבילת גלישה ג\'יגה', value: '300' },
                        { label: 'עלות ממוצעת לקו לשנה', html: '16.4 <span class="plan-note">(עלות קו ל-2 מכשירים 15 ש"ח כל אחד)</span>' },
                        { label: 'עלות סים', html: '<span class="no-cost-icon">🚫</span><br />ללא עלות' },
                        { label: 'עלות משלוח', html: '<span class="no-cost-icon">🚫</span><br />ללא עלות' },
                        { label: 'רובץ על רשת', image: { src: '/images/פלאפון.jfif', alt: 'פלאפון' } },
                    ],
                },
                {
                    title: 'תוכנית ג\'', company: 'wecom',
                    cells: [
                        { label: 'שם חברה', value: 'wecom' },
                        { label: 'שם התוכנית', value: 'תוכנית ג\'' },
                        { label: 'רשת בדור', value: ' 4 (דור 5 בתוספת 7.9 ש"ח)' },
                        { label: 'דקות/סמסים', value: '5000' },
                        { label: 'חבילת גלישה ג\'יגה', value: 'ללא הגבלה' },
                        { label: 'עלות ממוצעת לקו לשנה', value: 'מחיר קבוע 19.9' },
                        { label: 'עלות סים', html: '<span class="no-cost-icon">🚫</span><br />ללא עלות' },
                        { label: 'עלות משלוח', html: '<span class="no-cost-icon">🚫</span><br />ללא עלות' },
                        { label: 'רובץ על רשת', image: { src: '/images/סלקום.jfif', alt: 'סלקום' } },
                    ],
                },
                {
                    title: 'תוכנית ד\'', company: 'Xphone',
                    cells: [
                        { label: 'שם חברה', value: 'Xphone' },
                        { label: 'שם התוכנית', value: 'תוכנית ד\'' },
                        { label: 'רשת בדור', value: '4/5' },
                        { label: 'דקות/סמסים', value: '5000' },
                        { label: 'חבילת גלישה ג\'יגה', value: '500' },
                        { label: 'עלות ממוצעת לקו לשנה', value: '18.9' },
                        { label: 'עלות סים', value: '4.9 ש"ח' },
                        { label: 'עלות משלוח', value: '14.9 ש"ח' },
                        { label: 'רובץ על רשת', image: { src: '/images/סלקום.jfif', alt: 'סלקום' } },
                    ],
                },
            ],
        },
    },
    {
        slug: 'fuel',
        title: 'דלק חוסכוני',
        description: 'הנחה קבועה בדלק בתחנות סונול, דור אלון, טן ותפוז',
        icon: '⛽',
        image_url: '/assets/fuel.jpg',
        order: 2,
        status: 'active',
        can_join: true,
        is_new: true,
        new_badge_text: 'חדש!',
        rating_companies: ['בנזין', 'סולר'],
        join_link: 'https://forms.gle/2Y9SdUfqkJd5mPaS7',
        join_link_diesel: 'https://docs.google.com/forms/d/e/1FAIpQLScz6iFzBwX7oGYXdh98Y9aah_RgWXINtbsJ5u05wWYE8anVUA/viewform?usp=publish-editor',
        join_cta_subtitle: 'הנחה בדלק <span class="cta-small">(95 או 98)</span>',
        plans_table_note: 'שים לב: דלק, הינו מוצר במחיר מפוקח, לכן אין כפל מבצעים. אם המשתמש בוחר למלא בתדלוק עצמי הוא אינו זכאי להנחה על ההנחה.',
        plans_table_diesel_note: 'אין כפל מבצעים. המשתמש מקבל את ההנחה מהמחיר היציג של סונול ללא קשר לאופן המילוי - שירות עצמי או מלא.',
        find_section: {
            title: 'מצא את התחנות הקרובות אליך',
            image: '/images/gas-stations.png',
            imageAlt: 'תחנות דלק',
            stationNames: ['סונול', 'דור אלון', 'טן', 'תפוז'],
        },
        benefits: {
            title: 'היתרונות שלך',
            items: [
                { icon: '💸', text: 'הנחה קבועה בכל הארץ - החל מהליטר הראשון (בתחנות הדלק סונול, דור אלון, טן ותפוז)' },
                { icon: '🗺️', text: 'פריסה של כ-700 תחנות דלק ברחבי הארץ - ככה שתמיד יהיה לכם איפה לתדלק ובהנחה' },
                { icon: '✨', text: 'חווית תדלוק נוחה ופשוטה - נכנסת, תדלקת 😊' },
                { icon: '📋', text: 'חשבונית אחת מרוכזת - ניהול פשוט ונוח, בקרה על תדלוק רכבי המשפחה/העסק' },
                { icon: '✅', text: 'ללא דמי שימוש או התחייבות' },
                { icon: '🛠️', text: 'ללא דמי התקנה' },
                { icon: '📅', text: 'מועד חיוב קבוע בהוראת קבע בנקאית' },
            ],
        },
        steps_override: [
            { icon: '📍', title: 'בודקים תחנות בסביבה', desc: 'אם יש בסביבת הבית / עבודה מהתחנות הנ"ל עוברים לשלב הבא ⬅️' },
            { icon: '🤝', title: 'ממלאים פרטים בטופס הבנזין / סולר', desc: 'אנחנו דואגים שנציג יחזור אליכם בהקדם, לתת לכם יחס אישי.' },
            { icon: '💸', title: 'מתחילים לחסוך', desc: 'מצרפים חברים ומשפחה ומגדילים יותר את הכח שלנו.' },
        ],
        faq_override: [
            { q: 'האם יש דמי התקנה או תשלום חודשי כלשהו?', a: 'לא. לחברי יוצאים לחירות אין דמי התקנה או תשלום חודשי כלשהו.' },
            { q: 'האם אני מחוייב לתדלק רק בתחנות הדלק הללו?', a: 'לא. ניתן לתדלק בכל תחנה אך ההנחה קיימת רק בתחנות הללו.' },
            { q: 'האם תיתכן תחנת דלק עם הנחה גדולה משלנו?', a: 'כן, לעיתים ישנן תחנות עם מבצעים מיוחדים, במקרה כזה יש לתדלק ללא השימוש בדלקן כדי להנות מההנחה הטובה ביותר באותה השעה.' },
            { q: 'מה קורה כשאני מוכר את רכבי?', a: 'ניתן לשלוף בקלות את ההתקן ולהשליכו לאשפה,<br>או לבטלו מיידית אצלנו בחיוג לשירות<br>בטל׳ 04-659-2444.' },
        ],
        plans_table: {
            title: 'פירוט ההנחה בדלק (בנזין 95 או 98)',
            headers: ['רשת תחנות', 'הנחה לליטר בנזין', 'בסיס ההנחה', 'מס׳ תחנות זמינות', 'לוגו'],
            rows: [
                {
                    title: 'סונול',
                    cells: [
                        { label: 'רשת תחנות', value: 'סונול' },
                        { label: 'הנחה לליטר בנזין', value: '31 אגורות' },
                        { label: 'בסיס ההנחה', value: 'מהמחיר היציג של סונול' },
                        { label: 'מס׳ תחנות זמינות', value: '245' },
                        { label: 'לוגו', image: { src: '/images/sonol.png', alt: 'סונול' } },
                    ],
                },
                {
                    title: 'דור אלון',
                    cells: [
                        { label: 'רשת תחנות', value: 'דור אלון' },
                        { label: 'הנחה לליטר בנזין', value: '31 אגורות' },
                        { label: 'בסיס ההנחה', value: 'מהמחיר היציג של סונול' },
                        { label: 'מס׳ תחנות זמינות', value: '220' },
                        { label: 'לוגו', image: { src: '/images/dor-alon.png', alt: 'דור אלון' } },
                    ],
                },
                {
                    title: 'טן',
                    cells: [
                        { label: 'רשת תחנות', value: 'טן' },
                        { label: 'הנחה לליטר בנזין', value: '32 אגורות' },
                        { label: 'בסיס ההנחה', value: 'מהמחיר היציג של סונול' },
                        { label: 'מס׳ תחנות זמינות', value: '77' },
                        { label: 'לוגו', image: { src: '/images/ten.jfif', alt: 'טן' } },
                    ],
                },
                {
                    title: 'תפוז',
                    cells: [
                        { label: 'רשת תחנות', value: 'תפוז' },
                        { label: 'הנחה לליטר בנזין', value: '32 אגורות' },
                        { label: 'בסיס ההנחה', value: 'מהמחיר היציג של סונול' },
                        { label: 'מס׳ תחנות זמינות', value: '13' },
                        { label: 'לוגו', image: { src: '/images/tapuz.png', alt: 'תפוז' } },
                    ],
                },
            ],
        },
        plans_table_diesel: {
            title: 'פירוט ההנחה בסולר',
            subtitle: 'מחיר ההנחה משתנה בכל חודש ומתפרסם בקבוצת הוואטסאפ',
            headers: [
                'רשת תחנות',
                'הנחה לליטר סולר<br /><span class="header-sub">(הנחה לדוגמא)</span>',
                'בסיס ההנחה',
                'לוגו',
            ],
            rows: [
                {
                    title: 'כלל התחנות של -',
                    cells: [
                        { label: 'רשת תחנות', html: 'סונול / דור אלון / טן' },
                        { label: 'הנחה לליטר סולר', value: '3.76' },
                        { label: 'בסיס ההנחה', value: 'מהמחיר היציג של סונול' },
                        { label: 'לוגו', html: '<span class="multi-logos"><img src="/images/sonol.png" alt="סונול" class="plans-table-logo" /><img src="/images/dor-alon.png" alt="דור אלון" class="plans-table-logo" /><img src="/images/ten.jfif" alt="טן" class="plans-table-logo" /></span>' },
                    ],
                },
            ],
        },
    },
    {
        slug: 'internet',
        title: 'אינטרנט מהיר',
        description: 'בקרוב - חבילות אינטרנט בהנחה לחברי הקבוצה',
        icon: '🌐',
        image_url: '/assets/internet.jpg',
        order: 3,
        status: 'soon',
        can_join: false,
    },
    {
        slug: 'carInsurance',
        title: 'ביטוח רכב',
        description: 'בקרוב - ביטוח רכב קבוצתי בהנחה משמעותית',
        icon: '🚗',
        image_url: '/assets/car_insurance.png',
        order: 4,
        status: 'soon',
        can_join: false,
    },
    {
        slug: 'electricity',
        title: 'חשמל חוסכוני',
        description: 'בקרוב - חבילות חשמל בהנחה לחברי הקבוצה',
        icon: '⚡',
        image_url: '/assets/electricity.jpg',
        order: 5,
        status: 'soon',
        can_join: false,
    },
    {
        slug: 'coupons',
        title: 'קופונים והנחות',
        description: 'בקרוב - קופונים והנחות בלעדיים לחברי הקבוצה',
        icon: '🎟️',
        image_url: '/assets/coupons.jpg',
        order: 6,
        status: 'soon',
        can_join: false,
    },
];

export async function seedPGCampaigns(strapi: Core.Strapi) {
    try {
        const existing = await strapi.db.query('api::pg-campaign.pg-campaign').count();
        if (existing > 0) {
            strapi.log.info(`[seed:pg-campaigns] ${existing} קמפיינים כבר קיימים - מדלג`);
            return;
        }
        for (const data of CAMPAIGNS) {
            await strapi.db.query('api::pg-campaign.pg-campaign').create({
                data: { ...data, publishedAt: new Date() },
            });
        }
        strapi.log.info(`[seed:pg-campaigns] ✅ נוצרו ${CAMPAIGNS.length} קמפיינים`);
    } catch (e) {
        strapi.log.warn('[seed:pg-campaigns] נכשל:', e instanceof Error ? e.message : String(e));
    }
}
