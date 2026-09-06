import { factories } from '@strapi/strapi';

// הזמנות מחנות החירות (shop.gofreeil.com).
//
// create — ציבורי (גם אנונימי): הצ'קאאוט שולח פרטי לקוח + snapshot של הפריטים.
// פריטי מוכרים (seller_document_id) מאומתים מול shop-seller-product: השם, המחיר
// ופרטי המוכר נלקחים מה-DB ולא מהלקוח. הסכומים מחושבים כאן מחדש.
// ההתראות (מנהלים / מוכרים / לקוח) נשלחות ב-lifecycles.afterCreate.
//
// find / findOne / update / delete — מנהל חנות בלבד (super_admin / shop_admin).
const UID = 'api::shop-order.shop-order' as const;
const SELLER_UID = 'api::shop-seller-product.shop-seller-product' as const;

const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);
const FREE_SHIPPING_FROM = 199;
const SHIPPING_FEE = 29;

function isPrivileged(user: any): boolean {
  if (!user) return false;
  const email = String(user.email ?? '').trim().toLowerCase();
  if (SUPER_ADMIN_EMAILS.has(email)) return true;
  return ['super_admin', 'shop_admin'].includes(user.app_role);
}
function isTrusted(ctx: any): boolean {
  if (ctx?.state?.auth?.strategy?.name === 'api-token') return true;
  return isPrivileged(ctx?.state?.user);
}

const S = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const money = (n: number) => Math.round(n * 100) / 100;

export interface OrderItem {
  id: number;
  name: string;
  price: number;
  qty: number;
  emoji?: string;
  seller_document_id?: string | null;
  seller_display?: string;
  seller_email?: string;
  seller_name?: string;
  seller_user_id?: string | null;
}

// מספר הזמנה קריא: S + תאריך + 4 תווים אקראיים (למשל S260906-K3ZQ)
function orderNumber(): string {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `S${ymd}-${rnd}`;
}

// התשובה ללקוח: בלי פרטי הקשר של המוכרים
function customerView(row: any) {
  if (!row) return row;
  const { admin_note, notifications, ...rest } = row;
  if (Array.isArray(rest.items)) {
    rest.items = rest.items.map(({ seller_email, seller_name, seller_user_id, ...it }: OrderItem) => it);
  }
  return rest;
}

// ------------------------------------------------------------
// "רכשו גם": ספירת מוצרים שנרכשו יחד, מתוך ההזמנות שלא בוטלו. מחושב בזיכרון
// ומוטמן 5 דקות - ההזמנות מעטות יחסית ואין צורך בשאילתת JSON מסובכת.
// הפלט אנונימי: { [productId]: [{ id, count }] } בלבד.
// ------------------------------------------------------------
const RELATED_TTL_MS = 5 * 60_000;
let relatedCache: { at: number; map: Map<number, Map<number, number>> } | null = null;

async function coPurchaseMap(): Promise<Map<number, Map<number, number>>> {
  if (relatedCache && Date.now() - relatedCache.at < RELATED_TTL_MS) return relatedCache.map;
  const rows: any[] = await strapi.documents(UID).findMany({
    filters: { status: { $ne: 'cancelled' } },
    fields: ['items'],
    sort: { createdAt: 'desc' },
    limit: 1000,
  });
  const map = new Map<number, Map<number, number>>();
  for (const row of rows) {
    const ids = [...new Set((Array.isArray(row.items) ? row.items : []).map((it: any) => Number(it?.id)).filter((n: number) => Number.isFinite(n) && n > 0))] as number[];
    for (const a of ids) {
      let inner = map.get(a);
      if (!inner) { inner = new Map(); map.set(a, inner); }
      for (const b of ids) if (b !== a) inner.set(b, (inner.get(b) ?? 0) + 1);
    }
  }
  relatedCache = { at: Date.now(), map };
  return map;
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // GET /shop-orders/related?ids=1,2 - ציבורי, אנונימי
  async related(ctx) {
    const ids = String(ctx.query?.ids ?? '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0).slice(0, 20);
    const map = await coPurchaseMap();
    const out: Record<string, { id: number; count: number }[]> = {};
    for (const id of ids) {
      out[id] = [...(map.get(id)?.entries() ?? [])]
        .map(([other, count]) => ({ id: other, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    }
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = { data: out };
  },

  async find(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל החנות רואה הזמנות');
    return super.find(ctx);
  },
  async findOne(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל החנות רואה הזמנות');
    return super.findOne(ctx);
  },

  async create(ctx) {
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    const user = ctx.state?.user;

    const name = S(body.customer_name, 120);
    const email = S(body.customer_email, 160).toLowerCase();
    const phone = S(body.customer_phone, 40);
    const address = S(body.customer_address, 200);
    const city = S(body.customer_city, 80);
    if (!name || !email || !phone) return ctx.badRequest('שם, אימייל וטלפון חובה');
    if (!/^\S+@\S+\.\S+$/.test(email)) return ctx.badRequest('אימייל לא תקין');
    if (!address || !city) return ctx.badRequest('כתובת ועיר חובה למשלוח');

    const rawItems = Array.isArray(body.items) ? (body.items as any[]) : [];
    if (!rawItems.length) return ctx.badRequest('העגלה ריקה');
    if (rawItems.length > 50) return ctx.badRequest('יותר מדי פריטים');

    const items: OrderItem[] = [];
    for (const raw of rawItems) {
      const qty = Math.max(1, Math.min(99, Math.floor(Number(raw?.qty) || 0)));
      const docId = S(raw?.seller_document_id, 60);
      if (docId) {
        // מוצר של מוכר — האמת ב-DB, לא בעגלה
        const sp: any = await strapi.documents(SELLER_UID).findOne({ documentId: docId });
        if (!sp || sp.status !== 'approved') return ctx.badRequest(`המוצר "${S(raw?.name, 60)}" כבר לא זמין`);
        items.push({
          id: Number(raw?.id) || 0,
          name: sp.name,
          price: money(Number(sp.price)),
          qty,
          emoji: sp.emoji || '📦',
          seller_document_id: docId,
          seller_display: sp.seller_business || sp.seller_name || '',
          seller_email: sp.seller_email || '',
          seller_name: sp.seller_name || '',
          seller_user_id: sp.seller_user_id || null,
        });
      } else {
        const price = Number(raw?.price);
        const itemName = S(raw?.name, 120);
        if (!itemName || !Number.isFinite(price) || price < 0 || price > 1_000_000) return ctx.badRequest('פריט לא תקין');
        items.push({ id: Number(raw?.id) || 0, name: itemName, price: money(price), qty, emoji: S(raw?.emoji, 8) || '📦' });
      }
    }

    const subtotal = money(items.reduce((s, it) => s + it.price * it.qty, 0));
    const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
    const total = money(subtotal + shipping);

    ctx.request.body = {
      data: {
        order_number: orderNumber(),
        status: 'new',
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        customer_address: address,
        customer_city: city,
        customer_zip: S(body.customer_zip, 20),
        note: S(body.note, 1000),
        buyer_user_id: user ? String(user.id) : null,
        items,
        subtotal,
        shipping,
        total,
        payment_method: S(body.payment_method, 40) || 'card',
        notifications: null,
        admin_note: null,
      },
    };
    const res: any = await super.create(ctx);
    if (res?.data) res.data = customerView(res.data);
    return res;
  },

  async update(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל החנות מעדכן הזמנות');
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    // מנהל משנה סטטוס והערה בלבד; תוכן ההזמנה קפוא (ראייה לעסקה)
    const allowed: Record<string, unknown> = {};
    if (['new', 'confirmed', 'shipped', 'completed', 'cancelled'].includes(String(body.status))) allowed.status = body.status;
    if (typeof body.admin_note === 'string') allowed.admin_note = body.admin_note.slice(0, 2000);
    ctx.request.body = { data: allowed };
    return super.update(ctx);
  },

  async delete(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל החנות מוחק הזמנות');
    return super.delete(ctx);
  },
}));
