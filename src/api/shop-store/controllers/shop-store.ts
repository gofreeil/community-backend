import { factories } from '@strapi/strapi';

// החנות של מוכר בקניון השיתופי חנות החירות (shop.gofreeil.com).
//
// זרימה: המשתמש "פותח חנות" (שם, לוגו, טלפון, תיאור + פרטי מוכר + קבלת הסכם
// המוכר) → הרשומה נשמרת כאן, אחת למשתמש (seller_user_id), בסטטוס pending →
// בחלון הבא הוא מעלה מוצרים (shop-seller-product), וכל מוצר מעתיק מהחנות את
// פרטי החנות, המוכר וההסכם. כך פתיחת החנות שורדת החלפת מכשיר, וההסכם נחתם
// פעם אחת.
//
// **האישור הוא על החנות, לא על המוצר.** המנהל מאשר כאן חנות אחת (status);
// ה-lifecycle מעלה אז למדף את כל מוצריה הממתינים, ומוצר חדש של חנות מאושרת
// עולה למדף ישירות. מוכר אינו מגיש מוצר לאישור - לעולם.
//
// גישה: רק המשתמש המחובר, ורק לרשומה של עצמו (mine / upsert). מנהל חנות
// וסופר-אדמין רואים הכל ומכריעים (find/findOne/update); הציבור - רק עיצוב
// דף החנות של חנות מאושרת (design), כדי שמי שנכנס לדף יראה את מה שהמוכר
// בנה בסטודיו. שאר הדף הציבורי נגזר מהמוצרים המאושרים, לא מכאן.
const UID = 'api::shop-store.shop-store' as const;

const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);
const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
// העיצוב נושא עד שתי תמונות כ-data URL (באנר + סיפור) ולכן החסם נדיב, אבל סופי
const DESIGN_MAX = 1_600_000;

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

// מזהה חנות לכתובת (store.html?s=...) - זהה ל-storeSlug בחנות (js/main.js)
function storeSlug(name: string): string {
  return String(name || '').trim().toLowerCase().replace(/["'`]/g, '').replace(/[\s/]+/g, '-');
}

// תצוגה לבעלים: הכל חוץ מנתוני הביקורת הטכניים
function ownerView(row: any) {
  if (!row) return row;
  const { contract_ip, contract_user_agent, ...rest } = row;
  return rest;
}

const S = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden();
    return super.find(ctx);
  },
  async findOne(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden();
    return super.findOne(ctx);
  },
  async create(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('השתמשו ב-upsert');
    return super.create(ctx);
  },
  // אישור / דחייה / עריכה של חנות - מנהל חנות בלבד. זו ההכרעה היחידה בקניון:
  // אישור כאן מעלה למדף (ב-lifecycle) את כל מוצרי החנות שממתינים.
  // שינוי סטטוס נחתם בזמן ובמאשר; תיעוד ההסכם אינו ניתן לשינוי בדיעבד.
  async update(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('השתמשו ב-upsert');
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    if (body.status && ['pending', 'approved', 'rejected'].includes(String(body.status))) {
      body.decided_at = new Date().toISOString();
      body.decided_by = String(ctx.state?.user?.email ?? 'api-token');
      if (body.status !== 'rejected') body.rejection_reason = null;
    }
    for (const k of ['contract_accepted', 'contract_version', 'contract_accepted_at', 'contract_ip', 'contract_user_agent', 'seller_user_id', 'opened_at']) {
      delete body[k];
    }
    ctx.request.body = { data: body };
    return super.update(ctx);
  },
  async delete(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל החנות רשאי למחוק');
    return super.delete(ctx);
  },

  // GET /shop-stores/mine - החנות של המשתמש המחובר (או data: null)
  async mine(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('נדרשת התחברות');
    const rows: any[] = await strapi.documents(UID).findMany({
      filters: { seller_user_id: { $eq: String(user.id) } },
      limit: 1,
    });
    ctx.body = { data: rows[0] ? ownerView(rows[0]) : null };
  },

  // GET /shop-stores/design?s=<slug> - עיצוב דף החנות, ציבורי.
  // מחזיר רק את השדה הזה, ורק לחנות מאושרת: מה שהמוכר עיצב בסטודיו הוא מה
  // שכל מי שנכנס לדף החנות רואה. חנות שטרם אושרה אינה חושפת דבר.
  async design(ctx) {
    const slug = S(ctx.query?.s, 200);
    if (!slug) return ctx.badRequest('missing slug');
    const rows: any[] = await strapi.documents(UID).findMany({
      filters: { slug: { $eq: slug }, status: { $eq: 'approved' } },
      fields: ['slug', 'store_design'],
      limit: 1,
    });
    const row = rows[0];
    ctx.body = { data: row?.store_design ? { slug: row.slug, design: row.store_design } : null };
  },

  // POST /shop-stores/upsert { data: {...} } - פתיחת חנות או עדכון פרטיה.
  // ולידציה כמו בהגשת מוצר; תיעוד ההסכם נחתם כאן בשרת בפעם הראשונה בלבד
  // (או כשגרסת ההסכם השתנתה) - עדכון פרטים לא "חותם מחדש".
  //
  // הסטטוס לעולם אינו מגיע מהלקוח: חנות חדשה נפתחת כ-pending, חנות מאושרת
  // נשארת מאושרת גם אחרי עריכת פרטים, וחנות שנדחתה חוזרת ל-pending ברגע
  // שהמוכר מתקן ושולח שוב.
  async upsert(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('נדרשת התחברות');
    const body = ((ctx.request.body as any)?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;

    const storeName = S(body.store_name, 80);
    const storePhone = S(body.store_phone, 40);
    const storeLogo = typeof body.store_logo === 'string' ? body.store_logo : '';
    const storeWebsite = S(body.store_website, 300);
    const sellerName = S(body.seller_name, 120);
    const sellerEmail = (S(body.seller_email, 160) || String(user.email ?? '')).toLowerCase();
    const sellerPhone = S(body.seller_phone, 40);
    const sellerId = S(body.seller_id_number, 20);
    const contractVersion = S(body.contract_version, 40);

    if (!storeName) return ctx.badRequest('שם החנות חובה');
    if (!storePhone) return ctx.badRequest('טלפון החנות חובה');
    if (storeLogo && (storeLogo.length > 400_000 || !DATA_IMAGE.test(storeLogo))) return ctx.badRequest('לוגו לא תקין (עד ~300KB, תמונה)');
    if (storeWebsite && !/^https?:\/\/[^\s"'<>]+$/.test(storeWebsite)) return ctx.badRequest('כתובת האתר צריכה להתחיל ב-http(s)://');
    if (!sellerName || !sellerEmail || !sellerPhone || !sellerId) return ctx.badRequest('פרטי המוכר חסרים (שם, אימייל, טלפון, ת"ז/ח.פ)');
    if (!/^\S+@\S+\.\S+$/.test(sellerEmail)) return ctx.badRequest('אימייל לא תקין');
    if (body.contract_accepted !== true || !contractVersion) return ctx.badRequest('יש לאשר את הסכם המוכר');

    const existing: any[] = await strapi.documents(UID).findMany({
      filters: { seller_user_id: { $eq: String(user.id) } },
      limit: 1,
    });
    const prev = existing[0];
    const now = new Date().toISOString();
    const resign = !prev || !prev.contract_accepted || prev.contract_version !== contractVersion;

    const data: Record<string, unknown> = {
      seller_user_id: String(user.id),
      slug: storeSlug(storeName),
      store_name: storeName,
      store_logo: storeLogo,
      store_phone: storePhone,
      store_whatsapp: S(body.store_whatsapp, 40) || storePhone,
      store_city: S(body.store_city, 80),
      store_website: storeWebsite,
      store_description: S(body.store_description, 600),
      seller_name: sellerName,
      seller_email: sellerEmail,
      seller_phone: sellerPhone,
      seller_id_number: sellerId,
      seller_address: S(body.seller_address, 200),
      opened_at: prev?.opened_at || now,
    };
    // עיצוב דף החנות (הסטודיו) - JSON כמחרוזת. נשמר רק כשהוא נשלח בבקשה,
    // כדי שעריכת פרטי החנות (sell.html, שלא שולחת אותו) לא תמחק עיצוב קיים.
    if ('store_design' in body) {
      const design = typeof body.store_design === 'string' ? body.store_design : '';
      if (design.length > DESIGN_MAX) return ctx.badRequest('העיצוב כבד מדי - הקטינו את התמונות שבבאנר ובסיפור');
      if (design) {
        try { JSON.parse(design); } catch { return ctx.badRequest('עיצוב לא תקין'); }
      }
      data.store_design = design;
    }
    if (!prev || prev.status === 'rejected') {
      data.status = 'pending';
      data.decided_at = null;
      data.decided_by = null;
      data.rejection_reason = null;
    }
    if (resign) {
      data.contract_accepted = true;
      data.contract_version = contractVersion;
      data.contract_accepted_at = now;
      data.contract_ip = S(body.contract_ip, 80) || ctx.request.ip || '';
      data.contract_user_agent = S(ctx.request.headers['user-agent'], 400);
    }

    const row = prev
      ? await strapi.documents(UID).update({ documentId: prev.documentId, data: data as any })
      : await strapi.documents(UID).create({ data: data as any });
    ctx.body = { data: ownerView(row), created: !prev };
  },
}));
