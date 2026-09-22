// ─────────────────────────────────────────────────────────────
// Lifecycle hooks ל-shop-seller-product — התראה על חנות חדשה שממתינה
// לאישור, כדי שמוכר שפתח חנות לא ימתין בלי שאיש ידע.
//
// אישור ידני נדרש רק לחנות חדשה (status=pending מה-controller); מוצר נוסף
// של חנות שכבר אושרה עולה למדף לבד - ועליו אין התראה.
//
// afterCreate שולח למנהלי החנות (super_admin / shop_admin, לא חסומים),
// best-effort וללא תלות בין הערוצים:
//   1. הודעה לתיבת הניהול בקהילה (אוסף messages → ה-lifecycle של message
//      שולח SMS לנייד שבפרופיל) — אותו מסלול כמו הזמנה חדשה.
//   2. מייל עם פרטי המוצר, החנות והמוכר.
// כל כשל נבלע ונרשם בלוג — ההגשה עצמה לעולם לא נופלת בגלל התראה.
// ─────────────────────────────────────────────────────────────

const SHOP_URL = 'https://shop.gofreeil.com';
const SHOP_NAME = 'חנות החירות';
const ADMIN_LINK = `${SHOP_URL}/admin.html#sellers`;
const SUPER_ADMIN_EMAILS = ['yahavanter@gmail.com'];
const SHOP_ADMIN_ROLES = ['super_admin', 'shop_admin'];

const ils = (n: unknown) => `₪${(Math.round(Number(n ?? 0) * 100) / 100).toLocaleString('he-IL')}`;
const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface SubmissionRow {
  id: number;
  documentId: string;
  status?: string;
  name: string;
  category?: string;
  price: number;
  quantity?: number | null;
  delivery_days?: number | null;
  description?: string;
  store_name?: string;
  store_city?: string;
  store_phone?: string;
  seller_name?: string;
  seller_email?: string;
  seller_phone?: string;
}

async function shopAdmins(): Promise<{ id: number; email: string }[]> {
  const rows = (await strapi.db.query('plugin::users-permissions.user').findMany({
    where: {
      $or: [{ app_role: { $in: SHOP_ADMIN_ROLES } }, { email: { $in: SUPER_ADMIN_EMAILS } }],
      blocked: { $ne: true },
    },
    select: ['id', 'email'],
  })) as { id: number; email: string }[];
  const seen = new Set<number>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

async function inboxMessage(receiverId: number, content: string): Promise<boolean> {
  try {
    await strapi.db.query('api::message.message').create({ data: { receiver: receiverId, content, read: false } });
    return true;
  } catch (err) {
    strapi.log.error(`[shop-seller-product] inbox message to ${receiverId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!to) return false;
  try {
    await strapi.plugin('email').service('email').send({ to, subject, html, text });
    return true;
  } catch (err) {
    strapi.log.error(`[shop-seller-product] mail to ${to} failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export default {
  async afterCreate(event: { result: SubmissionRow }) {
    const s = event.result;
    // מוצר שעלה באישור אוטומטי (חנות שכבר אושרה) לא מצריך טיפול - בלי SMS.
    // מתריעים רק על מה שממתין לאישור, כלומר חנות חדשה.
    if (s.status !== 'pending') {
      strapi.log.info(`[shop-seller-product] הגשה ${s.documentId} אושרה אוטומטית (חנות מאושרת) — בלי התראה`);
      return;
    }
    try {
      const admins = await shopAdmins();
      if (!admins.length) {
        strapi.log.warn('[shop-seller-product] אין מנהלי חנות (super_admin/shop_admin) — אין למי להודיע');
        return;
      }

      // השורה הראשונה היא גוף ה-SMS (adminSms לוקח אותה ככותרת) — לכן היא
      // מכילה את העיקר: מה הוגש, מאיזו חנות, בכמה.
      const content =
        `🏪 חנות חדשה ממתינה לאישור ב${SHOP_NAME}: "${s.store_name ?? ''}" — מוצר ראשון "${s.name}" ${ils(s.price)}\n` +
        `מוכר: ${s.seller_name ?? ''} · ${s.seller_phone ?? ''} · ${s.seller_email ?? ''}\n` +
        (s.store_city ? `עיר: ${s.store_city}\n` : '') +
        (s.quantity != null ? `${s.quantity} יח' במלאי\n` : '') +
        (s.description ? `${String(s.description).slice(0, 200)}\n` : '') +
        `לאישור או לדחייה: ${ADMIN_LINK}`;

      const subject = `🏪 חנות חדשה לאישור: ${s.store_name ?? s.name} — ${SHOP_NAME}`;
      const html = `
  <div dir="rtl" style="font-family: Arial, 'Segoe UI', sans-serif; background:#ecfeff; padding:24px; color:#0c4a6e;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #a5f3fc; border-radius:16px; overflow:hidden;">
      <div style="background:linear-gradient(135deg,#06b6d4,#0891b2); padding:22px; text-align:center; color:#ffffff;">
        <div style="font-size:36px; line-height:1;">🏪</div>
        <h1 style="margin:10px 0 0; font-size:20px; font-weight:800;">חנות חדשה ממתינה לאישור</h1>
      </div>
      <div style="padding:22px; line-height:1.7; font-size:15px;">
        <p style="margin:0 0 10px"><strong>${esc(s.name)}</strong> · ${ils(s.price)}${s.quantity != null ? ` · ${esc(s.quantity)} יח'` : ''}${s.delivery_days ? ` · אספקה ${esc(s.delivery_days)} ימי עסקים` : ''}</p>
        ${s.description ? `<p style="margin:0 0 12px;color:#334155">${esc(String(s.description).slice(0, 400))}</p>` : ''}
        <div style="background:#f0fdff;border:1px solid #a5f3fc;border-radius:12px;padding:14px;margin:12px 0">
          <strong>החנות</strong><br>${esc(s.store_name ?? '')}${s.store_city ? ` · ${esc(s.store_city)}` : ''}${s.store_phone ? ` · ${esc(s.store_phone)}` : ''}
          <br><br><strong>המוכר</strong><br>${esc(s.seller_name ?? '')}${s.seller_phone ? ` · ${esc(s.seller_phone)}` : ''}${s.seller_email ? ` · ${esc(s.seller_email)}` : ''}
        </div>
        <div style="text-align:center;margin:20px 0 4px"><a href="${ADMIN_LINK}" style="display:inline-block;background:#06b6d4;color:#fff;text-decoration:none;font-weight:700;padding:11px 26px;border-radius:12px">לאישור בפאנל הניהול</a></div>
      </div>
      <div style="background:#f0fdff; border-top:1px solid #a5f3fc; padding:12px 22px; text-align:center; color:#0e7490; font-size:12px;">
        ${SHOP_NAME} · <a href="${SHOP_URL}" style="color:#0891b2; text-decoration:none;">shop.gofreeil.com</a>
      </div>
    </div>
  </div>`;

      const sent: string[] = [];
      for (const a of admins) {
        if (await inboxMessage(a.id, content)) sent.push(`inbox:${a.email}`);
        if (await sendMail(a.email, subject, html, content)) sent.push(`mail:${a.email}`);
      }
      strapi.log.info(`[shop-seller-product] הגשה ${s.documentId} — התראה נשלחה: ${sent.join(', ') || 'כלום'}`);
    } catch (err) {
      strapi.log.error(`[shop-seller-product] התראת הגשה נכשלה: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};
