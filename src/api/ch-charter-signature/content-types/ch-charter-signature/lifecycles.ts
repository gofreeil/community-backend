// ─────────────────────────────────────────────────────────────
// Lifecycle hooks ל-ch-charter-signature (אמנת UECC · חכמי העדה)
//
// afterCreate: שולח מייל אישור לחותם בצד-שרת (Resend/nodemailer).
// חשוב: שליחת המייל עטופה ב-try/catch ולעולם לא חוסמת/מפילה את יצירת
// החתימה — גם אם RESEND_API_KEY לא מוגדר או ה-SMTP נכשל, החתימה נשמרת.
// (החלפה לזרימת ה-mailto שהוסרה מצד-הלקוח — ראה chachmei-haeda ethical-code.)
// ─────────────────────────────────────────────────────────────

const SITE_URL = 'https://chachmei-haeda.gofreeil.com';
const CHARTER_INDEX_URL = `${SITE_URL}/charter-index`;

function buildConfirmationEmail(name: string): { subject: string; html: string; text: string } {
  const safeName = String(name || '').trim() || 'חותם/ת יקר/ה';
  const subject = 'אישור חתימה על אמנת חכמי העדה (UECC)';

  const html = `
  <div dir="rtl" style="font-family: Arial, 'Segoe UI', sans-serif; background:#f6f5ef; padding:24px; color:#2b2b2b;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e5e2d6; border-radius:16px; overflow:hidden;">
      <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6); padding:24px; text-align:center; color:#ffffff;">
        <div style="font-size:40px; line-height:1;">✅</div>
        <h1 style="margin:12px 0 0; font-size:20px; font-weight:800;">חתימתך על האמנה נקלטה</h1>
        <div style="margin-top:4px; font-size:13px; letter-spacing:3px; opacity:.9;">UECC</div>
      </div>
      <div style="padding:24px; line-height:1.7; font-size:15px;">
        <p style="margin:0 0 12px;">שלום ${safeName},</p>
        <p style="margin:0 0 12px;">
          תודה שחתמת על <strong>אמנת חכמי העדה (UECC)</strong>. חתימתך נקלטה בהצלחה
          ומופיעה כעת ברשימת החתומים הציבורית.
        </p>
        <div style="text-align:center; margin:24px 0;">
          <a href="${CHARTER_INDEX_URL}"
             style="display:inline-block; background:linear-gradient(135deg,#3b82f6,#8b5cf6); color:#ffffff; text-decoration:none; font-weight:700; padding:12px 28px; border-radius:12px;">
            צפייה ברשימת החתומים
          </a>
        </div>
        <p style="margin:0 0 4px; color:#6b7280; font-size:13px;">
          אם לא ביקשת לחתום על האמנה, ניתן להתעלם מהודעה זו.
        </p>
      </div>
      <div style="background:#faf9f4; border-top:1px solid #e5e2d6; padding:14px 24px; text-align:center; color:#9ca3af; font-size:12px;">
        חכמי העדה · <a href="${SITE_URL}" style="color:#3b82f6; text-decoration:none;">chachmei-haeda.gofreeil.com</a>
      </div>
    </div>
  </div>`;

  const text = [
    `שלום ${safeName},`,
    '',
    'תודה שחתמת על אמנת חכמי העדה (UECC). חתימתך נקלטה בהצלחה ומופיעה ברשימת החתומים.',
    '',
    `רשימת החתומים: ${CHARTER_INDEX_URL}`,
    '',
    'אם לא ביקשת לחתום על האמנה, ניתן להתעלם מהודעה זו.',
    '',
    'חכמי העדה',
  ].join('\n');

  return { subject, html, text };
}

export default {
  async afterCreate(event: any) {
    const { result } = event;
    const to = (result?.email || '').trim();
    if (!to) return; // אין מייל → אין למי לשלוח (השדה אופציונלי)

    try {
      const { subject, html, text } = buildConfirmationEmail(result?.name);
      await strapi.plugin('email').service('email').send({ to, subject, html, text });
      strapi.log.info(`[ch-charter-signature] confirmation email sent to ${to}`);
    } catch (err) {
      // לעולם לא מפילים את יצירת החתימה בגלל כשל מייל
      strapi.log.error(
        `[ch-charter-signature] failed to send confirmation email to ${to}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  },
};
