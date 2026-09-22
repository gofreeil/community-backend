// ─────────────────────────────────────────────────────────────
// Lifecycle hooks ל-shop-store — הלב של זרימת האישור בחנות החירות.
//
// הכלל: **מאשרים חנות, לא מוצר.** מוכר פותח חנות → היא נכנסת כ-pending
// והמנהל מקבל התראה → ברגע שהמנהל מאשר את החנות, כל המוצרים שהעלה בינתיים
// עולים למדף אוטומטית, ומכאן והלאה כל מוצר חדש עולה ישירות (הכרעה
// ב-controller של shop-seller-product לפי status של החנות).
//
//   afterCreate  → חנות חדשה ממתינה לאישור: הודעה לתיבת הניהול (→ SMS)
//                  ומייל לכל מנהלי החנות (super_admin / shop_admin).
//   afterUpdate  → מעבר ל-approved: אישור אוטומטי של כל מוצרי החנות
//                  שממתינים + בשורה למוכר. מעבר ל-rejected: הודעה למוכר
//                  עם הסיבה.
//
// הכל best-effort: כשל בהתראה נבלע ונרשם בלוג, ולעולם אינו מפיל את
// פתיחת החנות או את ההכרעה של המנהל.
// ─────────────────────────────────────────────────────────────

const SHOP_URL = 'https://shop.gofreeil.com';
const SHOP_NAME = 'חנות החירות';
const ADMIN_LINK = `${SHOP_URL}/admin.html#stores`;
const SUPER_ADMIN_EMAILS = ['yahavanter@gmail.com'];
const SHOP_ADMIN_ROLES = ['super_admin', 'shop_admin'];

const STORE_UID = 'api::shop-store.shop-store' as const;
const PRODUCT_UID = 'api::shop-seller-product.shop-seller-product' as const;

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface StoreRow {
  id: number;
  documentId: string;
  status?: string;
  store_name?: string;
  store_city?: string;
  store_phone?: string;
  store_description?: string;
  seller_user_id?: string;
  seller_name?: string;
  seller_email?: string;
  seller_phone?: string;
  rejection_reason?: string;
}

function shell(title: string, emoji: string, inner: string): string {
  return `
  <div dir="rtl" style="font-family: Arial, 'Segoe UI', sans-serif; background:#ecfeff; padding:24px; color:#0c4a6e;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #a5f3fc; border-radius:16px; overflow:hidden;">
      <div style="background:linear-gradient(135deg,#06b6d4,#0891b2); padding:22px; text-align:center; color:#ffffff;">
        <div style="font-size:36px; line-height:1;">${emoji}</div>
        <h1 style="margin:10px 0 0; font-size:20px; font-weight:800;">${esc(title)}</h1>
      </div>
      <div style="padding:22px; line-height:1.7; font-size:15px;">${inner}</div>
      <div style="background:#f0fdff; border-top:1px solid #a5f3fc; padding:12px 22px; text-align:center; color:#0e7490; font-size:12px;">
        ${SHOP_NAME} · <a href="${SHOP_URL}" style="color:#0891b2; text-decoration:none;">shop.gofreeil.com</a>
      </div>
    </div>
  </div>`;
}

const cta = (href: string, label: string) =>
  `<div style="text-align:center;margin:20px 0 4px"><a href="${href}" style="display:inline-block;background:#06b6d4;color:#fff;text-decoration:none;font-weight:700;padding:11px 26px;border-radius:12px">${esc(label)}</a></div>`;

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
    strapi.log.error(`[shop-store] inbox message to ${receiverId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!to) return false;
  try {
    await strapi.plugin('email').service('email').send({ to, subject, html, text });
    return true;
  } catch (err) {
    strapi.log.error(`[shop-store] mail to ${to} failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// חנות חדשה ממתינה לאישור — לכל מנהלי החנות
async function notifyAdminsPending(s: StoreRow): Promise<void> {
  const admins = await shopAdmins();
  if (!admins.length) {
    strapi.log.warn('[shop-store] אין מנהלי חנות (super_admin/shop_admin) — אין למי להודיע');
    return;
  }
  // השורה הראשונה היא גוף ה-SMS (adminSms לוקח אותה ככותרת) — לכן העיקר בה
  const content =
    `🏪 חנות חדשה ממתינה לאישור ב${SHOP_NAME}: "${s.store_name ?? ''}"\n` +
    `מוכר: ${s.seller_name ?? ''} · ${s.seller_phone ?? ''} · ${s.seller_email ?? ''}\n` +
    (s.store_city ? `עיר: ${s.store_city}\n` : '') +
    (s.store_description ? `${String(s.store_description).slice(0, 200)}\n` : '') +
    `אישור החנות מעלה למדף את כל מוצריה: ${ADMIN_LINK}`;

  const html = shell('חנות חדשה ממתינה לאישור', '🏪', `
    <p style="margin:0 0 10px"><strong>${esc(s.store_name ?? '')}</strong>${s.store_city ? ` · ${esc(s.store_city)}` : ''}${s.store_phone ? ` · ${esc(s.store_phone)}` : ''}</p>
    ${s.store_description ? `<p style="margin:0 0 12px;color:#334155">${esc(String(s.store_description).slice(0, 400))}</p>` : ''}
    <div style="background:#f0fdff;border:1px solid #a5f3fc;border-radius:12px;padding:14px;margin:12px 0">
      <strong>המוכר</strong><br>${esc(s.seller_name ?? '')}${s.seller_phone ? ` · ${esc(s.seller_phone)}` : ''}${s.seller_email ? ` · ${esc(s.seller_email)}` : ''}
    </div>
    <p style="margin:0 0 12px;color:#334155">אישור החנות מעלה למדף אוטומטית את כל המוצרים שהמוכר העלה, וכל מוצר עתידי שלו יעלה ישירות.</p>
    ${cta(ADMIN_LINK, 'לאישור בפאנל הניהול')}`);

  const sent: string[] = [];
  for (const a of admins) {
    if (await inboxMessage(a.id, content)) sent.push(`inbox:${a.email}`);
    if (await sendMail(a.email, `🏪 חנות חדשה לאישור: ${s.store_name ?? ''} — ${SHOP_NAME}`, html, content)) sent.push(`mail:${a.email}`);
  }
  strapi.log.info(`[shop-store] חנות ${s.documentId} — התראה נשלחה: ${sent.join(', ') || 'כלום'}`);
}

// אישור החנות מעלה למדף את כל מוצריה שממתינים — המוכר לא מגיש מוצר לאישור
async function approveStoreProducts(s: StoreRow): Promise<number> {
  const identity: Record<string, unknown>[] = [];
  if (s.seller_user_id) identity.push({ seller_user_id: String(s.seller_user_id) });
  if (s.seller_email) identity.push({ seller_email: { $eqi: s.seller_email } });
  if (!identity.length) return 0;
  const pending: any[] = await strapi.documents(PRODUCT_UID).findMany({
    filters: { $and: [{ status: 'pending' }, { $or: identity }] },
    limit: 500,
  });
  const now = new Date().toISOString();
  let done = 0;
  for (const p of pending) {
    try {
      await strapi.documents(PRODUCT_UID).update({
        documentId: p.documentId,
        data: { status: 'approved', decided_at: now, decided_by: 'אישור אוטומטי - החנות אושרה', rejection_reason: null } as any,
      });
      done++;
    } catch (err) {
      strapi.log.error(`[shop-store] אישור אוטומטי למוצר ${p.documentId} נכשל: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return done;
}

async function notifySellerDecision(s: StoreRow, products: number): Promise<void> {
  const approved = s.status === 'approved';
  const subject = approved
    ? `✅ החנות "${s.store_name ?? ''}" אושרה — ${SHOP_NAME}`
    : `החנות "${s.store_name ?? ''}" לא אושרה — ${SHOP_NAME}`;
  const content = approved
    ? `✅ החנות "${s.store_name ?? ''}" אושרה ופתוחה ב${SHOP_NAME}!\n` +
      (products ? `${products} מוצרים שהעלית עלו עכשיו למדף.\n` : '') +
      `מכאן והלאה כל מוצר שתעלה עולה למדף מיד, בלי להמתין לאישור.\n${SHOP_URL}/seller-dashboard.html`
    : `החנות "${s.store_name ?? ''}" לא אושרה ב${SHOP_NAME}.\n` +
      (s.rejection_reason ? `סיבה: ${s.rejection_reason}\n` : '') +
      `אפשר לתקן את פרטי החנות ולשלוח שוב: ${SHOP_URL}/sell.html`;

  const html = approved
    ? shell('החנות שלך אושרה', '✅', `
      <p style="margin:0 0 10px">שלום ${esc(s.seller_name ?? '')},</p>
      <p style="margin:0 0 12px"><strong>${esc(s.store_name ?? '')}</strong> אושרה ופתוחה ללקוחות ב${SHOP_NAME}.</p>
      ${products ? `<p style="margin:0 0 12px;color:#334155">${products} מוצרים שהעלית עלו עכשיו למדף.</p>` : ''}
      <p style="margin:0 0 12px;color:#334155">מכאן והלאה כל מוצר שתעלה עולה למדף מיד — אין יותר אישור למוצר בודד.</p>
      ${cta(`${SHOP_URL}/seller-dashboard.html`, 'ללוח הבקרה שלי')}`)
    : shell('החנות לא אושרה', 'ℹ️', `
      <p style="margin:0 0 10px">שלום ${esc(s.seller_name ?? '')},</p>
      <p style="margin:0 0 12px"><strong>${esc(s.store_name ?? '')}</strong> לא אושרה כרגע.</p>
      ${s.rejection_reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px;margin:12px 0"><strong>הסיבה</strong><br>${esc(s.rejection_reason)}</div>` : ''}
      <p style="margin:0 0 12px;color:#334155">אפשר לתקן את פרטי החנות ולשלוח אותה שוב לאישור.</p>
      ${cta(`${SHOP_URL}/sell.html`, 'לעריכת החנות')}`);

  await sendMail(s.seller_email ?? '', subject, html, content);
  const uid = Number(s.seller_user_id);
  if (Number.isFinite(uid) && uid > 0) await inboxMessage(uid, content);
}

export default {
  async afterCreate(event: { result: StoreRow }) {
    const s = event.result;
    if (s.status !== 'pending') return;
    try {
      await notifyAdminsPending(s);
    } catch (err) {
      strapi.log.error(`[shop-store] התראת חנות חדשה נכשלה: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  // שומרים את הסטטוס שלפני העדכון כדי לזהות *מעבר* ולא סתם שמירה חוזרת
  async beforeUpdate(event: { params?: { where?: Record<string, unknown> }; state?: Record<string, unknown> }) {
    const where = event.params?.where;
    if (!where || !Object.keys(where).length) return;
    try {
      const prev = (await strapi.db.query(STORE_UID).findOne({ where, select: ['status'] })) as { status?: string } | null;
      event.state = event.state || {};
      event.state.prevStatus = prev?.status ?? null;
    } catch {
      /* בלי סטטוס קודם פשוט לא נזהה מעבר - עדיף מאשר להפיל את העדכון */
    }
  },

  async afterUpdate(event: { result: StoreRow; state?: Record<string, unknown> }) {
    const s = event.result;
    const prev = event.state?.prevStatus;
    if (!s || s.status === prev) return;
    // חנות שנדחתה ותוקנה חוזרת לתור - מתריעים למנהלים כמו על חנות חדשה
    if (s.status === 'pending') {
      try {
        await notifyAdminsPending(s);
      } catch (err) {
        strapi.log.error(`[shop-store] התראת חנות שהוגשה מחדש נכשלה: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
    if (s.status !== 'approved' && s.status !== 'rejected') return;
    try {
      const products = s.status === 'approved' ? await approveStoreProducts(s) : 0;
      await notifySellerDecision(s, products);
      strapi.log.info(`[shop-store] חנות ${s.documentId} → ${s.status}${products ? ` (${products} מוצרים עלו למדף)` : ''}`);
    } catch (err) {
      strapi.log.error(`[shop-store] טיפול בהכרעת חנות נכשל: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};
