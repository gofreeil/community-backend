// ─────────────────────────────────────────────────────────────
// Lifecycle hooks ל-shop-order — הודעה על כל רכישה בחנות החירות
//
// afterCreate שולח, best-effort וללא תלות בין הערוצים:
//   1. מנהלי החנות (super_admin / shop_admin, לא חסומים): הודעה לתיבת הניהול
//      בקהילה (אוסף messages → ה-lifecycle של message שולח SMS לנייד) + מייל.
//   2. כל מוכר שמוצר שלו נמכר: מייל עם הפריטים ופרטי המשלוח של הלקוח, כדי
//      שיספק (לפי הסכם המוכר האספקה עליו) + הודעה לתיבה בקהילה אם הוא רשום.
//   3. הלקוח: מייל אישור הזמנה.
// מה נשלח נרשם ב-notifications על ההזמנה, לביקורת בפאנל.
// כל כשל נבלע ונרשם בלוג — יצירת ההזמנה לעולם לא נופלת בגלל התראה.
// ─────────────────────────────────────────────────────────────

import type { OrderItem } from '../../controllers/shop-order';

const SHOP_URL = 'https://shop.gofreeil.com';
const SHOP_NAME = 'חנות החירות';
const ADMIN_LINK = `${SHOP_URL}/admin.html`;
const SUPER_ADMIN_EMAILS = ['yahavanter@gmail.com'];
const SHOP_ADMIN_ROLES = ['super_admin', 'shop_admin'];

const ils = (n: unknown) => `₪${(Math.round(Number(n ?? 0) * 100) / 100).toLocaleString('he-IL')}`;
const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PAYMENT_HE: Record<string, string> = { card: 'כרטיס אשראי', paypal: 'PayPal', cash: 'מזומן במסירה' };

interface OrderRow {
  id: number;
  documentId: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address?: string;
  customer_city?: string;
  customer_zip?: string;
  note?: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  payment_method?: string;
}

function itemsText(items: OrderItem[]): string {
  return items.map((it) => `• ${it.name} × ${it.qty} — ${ils(it.price * it.qty)}${it.seller_display ? ` (מוכר: ${it.seller_display})` : ''}`).join('\n');
}
function itemsHtml(items: OrderItem[]): string {
  return `<table dir="rtl" style="width:100%;border-collapse:collapse;font-size:14px">
    ${items.map((it) => `<tr>
      <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb">${esc(it.emoji || '📦')} ${esc(it.name)}${it.seller_display ? `<div style="font-size:12px;color:#6b7280">נמכר על ידי ${esc(it.seller_display)}</div>` : ''}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;white-space:nowrap">× ${it.qty}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;white-space:nowrap;font-weight:700">${ils(it.price * it.qty)}</td>
    </tr>`).join('')}
  </table>`;
}
function shippingBlock(o: OrderRow): string {
  return [o.customer_name, o.customer_phone, o.customer_email, [o.customer_address, o.customer_city, o.customer_zip].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}
function wrapHtml(title: string, emoji: string, inner: string): string {
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
function totalsHtml(o: OrderRow): string {
  return `<p style="margin:12px 0 0;font-size:14px">סכום ביניים: ${ils(o.subtotal)} · משלוח: ${o.shipping ? ils(o.shipping) : 'חינם'} · <strong>סה"כ: ${ils(o.total)}</strong> · תשלום: ${esc(PAYMENT_HE[o.payment_method ?? ''] ?? o.payment_method ?? '')}</p>`;
}

async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!to) return false;
  try {
    await strapi.plugin('email').service('email').send({ to, subject, html, text });
    return true;
  } catch (err) {
    strapi.log.error(`[shop-order] mail to ${to} failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function inboxMessage(receiverId: number, content: string): Promise<boolean> {
  try {
    await strapi.db.query('api::message.message').create({ data: { receiver: receiverId, content, read: false } });
    return true;
  } catch (err) {
    strapi.log.error(`[shop-order] inbox message to ${receiverId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
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

// 1. מנהלי החנות
async function notifyAdmins(o: OrderRow, log: Record<string, unknown>) {
  const admins = await shopAdmins();
  const itemCount = o.items.reduce((s, it) => s + it.qty, 0);
  const sellerItems = o.items.filter((it) => it.seller_document_id);
  const content =
    `🛒 הזמנה חדשה ב${SHOP_NAME} ${o.order_number} — ${ils(o.total)}\n` +
    `לקוח: ${o.customer_name} · ${o.customer_phone} · ${o.customer_email}\n` +
    `משלוח: ${[o.customer_address, o.customer_city, o.customer_zip].filter(Boolean).join(', ')}\n` +
    `${itemCount} פריטים:\n${itemsText(o.items)}\n` +
    (sellerItems.length ? `${sellerItems.length} פריטי מוכרים — המוכרים קיבלו מייל לאספקה\n` : '') +
    `תשלום: ${PAYMENT_HE[o.payment_method ?? ''] ?? o.payment_method}\n` +
    (o.note ? `הערת לקוח: ${o.note}\n` : '') +
    `ניהול ההזמנה ב-${ADMIN_LINK.replace('https://', '')}`;

  const subject = `🛒 הזמנה חדשה ${o.order_number} — ${ils(o.total)} — ${SHOP_NAME}`;
  const html = wrapHtml(`הזמנה חדשה ${o.order_number}`, '🛒', `
    <p style="margin:0 0 10px"><strong>לקוח:</strong> ${esc(shippingBlock(o))}</p>
    ${o.note ? `<p style="margin:0 0 10px"><strong>הערת לקוח:</strong> ${esc(o.note)}</p>` : ''}
    ${itemsHtml(o.items)}
    ${totalsHtml(o)}
    ${sellerItems.length ? `<p style="margin:12px 0 0;font-size:13px;color:#0e7490">${sellerItems.length} פריטים של מוכרים חיצוניים — כל מוכר קיבל מייל עם פרטי המשלוח. עמלת החנות (10%): ${ils(sellerItems.reduce((s, it) => s + it.price * it.qty, 0) * 0.1)}</p>` : ''}
    <div style="text-align:center;margin:20px 0 4px"><a href="${ADMIN_LINK}" style="display:inline-block;background:#06b6d4;color:#fff;text-decoration:none;font-weight:700;padding:11px 26px;border-radius:12px">לפאנל הניהול</a></div>`);

  const sent: string[] = [];
  for (const a of admins) {
    if (await inboxMessage(a.id, content)) sent.push(`inbox:${a.email}`);
    if (await sendMail(a.email, subject, html, content)) sent.push(`mail:${a.email}`);
  }
  if (!admins.length) strapi.log.warn('[shop-order] אין מנהלי חנות (super_admin/shop_admin) — אין למי להודיע');
  log.admins = sent;
}

// 2. המוכרים
async function notifySellers(o: OrderRow, log: Record<string, unknown>) {
  const bySeller = new Map<string, OrderItem[]>();
  for (const it of o.items) {
    if (!it.seller_document_id || !it.seller_email) continue;
    const key = it.seller_email.toLowerCase();
    bySeller.set(key, [...(bySeller.get(key) ?? []), it]);
  }
  const sent: string[] = [];
  for (const [email, items] of bySeller) {
    const first = items[0];
    const gross = items.reduce((s, it) => s + it.price * it.qty, 0);
    const fee = gross * 0.1;
    const subject = `💰 מכרת! הזמנה ${o.order_number} ב${SHOP_NAME} — נא לספק`;
    const text =
      `שלום ${first.seller_name || first.seller_display || ''},\n\n` +
      `נמכרו מוצרים שלך ב${SHOP_NAME}. לפי הסכם המוכר, האספקה ללקוח באחריותך.\n\n` +
      `הזמנה: ${o.order_number}\n${itemsText(items)}\n\n` +
      `סה"כ: ${ils(gross)} · עמלת החנות (10%): ${ils(fee)} · יועבר לך: ${ils(gross - fee)} (לאחר 14 יום ממסירה, לפי סעיף 4 להסכם)\n\n` +
      `פרטי משלוח:\n${o.customer_name}\n${o.customer_phone}\n${[o.customer_address, o.customer_city, o.customer_zip].filter(Boolean).join(', ')}\n` +
      (o.note ? `הערת לקוח: ${o.note}\n` : '') +
      `\nפרטי הלקוח נמסרים לצורך אספקת הזמנה זו בלבד (סעיף 9 להסכם).\n\n${SHOP_NAME}`;
    const html = wrapHtml('מכרת! יש הזמנה לספק', '💰', `
      <p style="margin:0 0 10px">שלום ${esc(first.seller_name || first.seller_display || '')},</p>
      <p style="margin:0 0 12px">נמכרו מוצרים שלך ב<strong>${SHOP_NAME}</strong>. לפי הסכם המוכר, האספקה ללקוח באחריותך.</p>
      <p style="margin:0 0 6px"><strong>הזמנה ${esc(o.order_number)}</strong></p>
      ${itemsHtml(items)}
      <p style="margin:12px 0;font-size:14px">סה"כ: ${ils(gross)} · עמלת החנות (10%): ${ils(fee)} · <strong>יועבר לך: ${ils(gross - fee)}</strong><br><span style="color:#6b7280;font-size:12px">לאחר 14 יום ממסירת המוצר ללקוח, לפי סעיף 4 להסכם המוכר</span></p>
      <div style="background:#f0fdff;border:1px solid #a5f3fc;border-radius:12px;padding:14px;margin:12px 0">
        <strong>פרטי משלוח</strong><br>${esc(o.customer_name)}<br>${esc(o.customer_phone)}<br>${esc([o.customer_address, o.customer_city, o.customer_zip].filter(Boolean).join(', '))}
        ${o.note ? `<br><span style="color:#6b7280">הערת לקוח: ${esc(o.note)}</span>` : ''}
      </div>
      <p style="margin:0;font-size:12px;color:#6b7280">פרטי הלקוח נמסרים לצורך אספקת הזמנה זו בלבד (סעיף 9 להסכם המוכר).</p>`);
    if (await sendMail(email, subject, html, text)) sent.push(`mail:${email}`);

    const sellerUserId = Number(first.seller_user_id);
    if (Number.isFinite(sellerUserId) && sellerUserId > 0) {
      const inbox =
        `💰 מכרת ב${SHOP_NAME}! הזמנה ${o.order_number}\n${itemsText(items)}\n` +
        `למשלוח: ${o.customer_name}, ${o.customer_phone}, ${[o.customer_address, o.customer_city, o.customer_zip].filter(Boolean).join(', ')}\n` +
        `פרטים מלאים נשלחו למייל ${email}`;
      if (await inboxMessage(sellerUserId, inbox)) sent.push(`inbox:${email}`);
    }
  }
  log.sellers = sent;
}

// 3. הלקוח
async function notifyCustomer(o: OrderRow, log: Record<string, unknown>) {
  const subject = `אישור הזמנה ${o.order_number} — ${SHOP_NAME}`;
  const text =
    `שלום ${o.customer_name},\n\nתודה על ההזמנה ב${SHOP_NAME}! מספר הזמנה: ${o.order_number}\n\n` +
    `${itemsText(o.items)}\n\nסכום ביניים: ${ils(o.subtotal)} · משלוח: ${o.shipping ? ils(o.shipping) : 'חינם'} · סה"כ: ${ils(o.total)}\n` +
    `משלוח אל: ${[o.customer_address, o.customer_city, o.customer_zip].filter(Boolean).join(', ')}\n\n` +
    `מוצרים המסומנים "נמכר על ידי" מסופקים ישירות מהמוכר.\n\n${SHOP_NAME} · ${SHOP_URL}`;
  const html = wrapHtml('ההזמנה התקבלה!', '✅', `
    <p style="margin:0 0 10px">שלום ${esc(o.customer_name)}, תודה על ההזמנה ב<strong>${SHOP_NAME}</strong>.</p>
    <p style="margin:0 0 12px">מספר הזמנה: <strong>${esc(o.order_number)}</strong></p>
    ${itemsHtml(o.items)}
    ${totalsHtml(o)}
    <p style="margin:12px 0 0;font-size:14px"><strong>משלוח אל:</strong> ${esc([o.customer_address, o.customer_city, o.customer_zip].filter(Boolean).join(', '))}</p>
    <p style="margin:12px 0 0;font-size:12px;color:#6b7280">מוצרים המסומנים "נמכר על ידי" מסופקים ישירות מהמוכר.</p>`);
  log.customer = (await sendMail(o.customer_email, subject, html, text)) ? [`mail:${o.customer_email}`] : [];
}

export default {
  async afterCreate(event: any) {
    const o = event?.result as OrderRow | undefined;
    if (!o?.id) return;
    const log: Record<string, unknown> = { at: new Date().toISOString() };
    try {
      await Promise.all([
        notifyAdmins(o, log).catch((e) => strapi.log.error(`[shop-order] notifyAdmins: ${e?.message ?? e}`)),
        notifySellers(o, log).catch((e) => strapi.log.error(`[shop-order] notifySellers: ${e?.message ?? e}`)),
        notifyCustomer(o, log).catch((e) => strapi.log.error(`[shop-order] notifyCustomer: ${e?.message ?? e}`)),
      ]);
      await strapi.db.query('api::shop-order.shop-order').update({ where: { id: o.id }, data: { notifications: log } });
      strapi.log.info(`[shop-order] ${o.order_number} notified: ${JSON.stringify(log)}`);
    } catch (err) {
      strapi.log.warn(`[shop-order] notification hook failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};
