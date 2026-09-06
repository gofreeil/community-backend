// ============================================================
// sms.ts — שליחת SMS מהבאקאנד המשותף
//
// העתק של המנגנון שמאמת נייד בגמ"ח הארצי (national-gemach/src/lib/server/sms.ts):
// אותם שלושה ספקים, אותו סדר עדיפויות, אותם משתני סביבה — רק ש-env נקרא
// מ-process.env (Strapi) ולא מ-$env/dynamic/private (SvelteKit).
//
// 1. SMSGate (חינמי) — אפליקציית קוד-פתוח על טלפון אנדרואיד עם SIM ישראלי;
//    השרת מדבר עם שרת-הענן הציבורי של הפרויקט (sms-gate.app).
//      SMSGATE_LOGIN / SMSGATE_PASSWORD
// 2. Traccar SMS Gateway (חינמי) — אפליקציה על טלפון אנדרואיד, שרת-ענן של Traccar.
//      TRACCAR_SMS_TOKEN
// 3. Twilio (בתשלום) — נפילה-אחורה מסחרית.
//      TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM
//
// כשאף ספק לא מוגדר smsEnabled() מחזיר false — והקוראים פשוט מדלגים בשקט.
// ============================================================

const env = process.env;

function smsgateConfigured(): boolean {
    return !!(env.SMSGATE_LOGIN && env.SMSGATE_PASSWORD);
}

function traccarConfigured(): boolean {
    return !!env.TRACCAR_SMS_TOKEN;
}

function twilioConfigured(): boolean {
    return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
}

export function smsEnabled(): boolean {
    return smsgateConfigured() || traccarConfigured() || twilioConfigured();
}

/** שם הספק הפעיל — ללוג בלבד */
export function smsProviderName(): string {
    if (smsgateConfigured()) return 'smsgate';
    if (traccarConfigured()) return 'traccar';
    if (twilioConfigured()) return 'twilio';
    return 'none';
}

/** מספר ישראלי (מקומי או ‎972‎) → E.164. רק ניידים — SMS לא מגיע לקו נייח.
 *  null = המספר לא נראה כמו נייד ישראלי תקין. */
export function toMobileE164(phone: string | null | undefined): string | null {
    let d = (phone ?? '').replace(/\D/g, '');
    if (d.startsWith('972')) d = '0' + d.slice(3);
    if (!/^05\d{8}$/.test(d)) return null;
    return '+972' + d.slice(1);
}

async function sendViaSmsgate(to: string, body: string): Promise<void> {
    const auth = Buffer.from(`${env.SMSGATE_LOGIN}:${env.SMSGATE_PASSWORD}`).toString('base64');
    const res = await fetch('https://api.sms-gate.app/3rdparty/v1/messages', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ textMessage: { text: body }, phoneNumbers: [to] }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`sendSms: SMSGate ${res.status} — ${text.slice(0, 300)}`);
    }
}

async function sendViaTraccar(to: string, body: string): Promise<void> {
    const res = await fetch('https://www.traccar.org/sms/', {
        method: 'POST',
        headers: {
            Authorization: env.TRACCAR_SMS_TOKEN as string,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, message: body }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`sendSms: Traccar ${res.status} — ${text.slice(0, 300)}`);
    }
}

async function sendViaTwilio(to: string, body: string): Promise<void> {
    const sid = env.TWILIO_ACCOUNT_SID as string;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: env.TWILIO_FROM as string, Body: body }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`sendSms: Twilio ${res.status} — ${text.slice(0, 300)}`);
    }
}

/** שולח SMS בודד. זורק בכשל — הקורא מחליט אם ללגג או להתעלם. */
export async function sendSms(to: string, body: string): Promise<void> {
    if (smsgateConfigured()) return sendViaSmsgate(to, body);
    if (traccarConfigured()) return sendViaTraccar(to, body);
    if (twilioConfigured()) return sendViaTwilio(to, body);
    throw new Error('sendSms: אף ספק SMS אינו מוגדר (SMSGATE_* / TRACCAR_SMS_TOKEN / TWILIO_*)');
}
