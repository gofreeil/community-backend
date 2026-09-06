import { factories } from '@strapi/strapi';

// מוצרים שהקהל מגיש למכירה בחנות החירות (shop.gofreeil.com).
//
// זרימה: כל אחד (גם אנונימי) יכול להגיש → status=pending נכפה תמיד → מנהל
// החנות מאשר/דוחה (update) → הציבור רואה רק approved, ורק שדות המוצר
// (בלי פרטי הקשר/ת"ז/IP של המוכר).
//
// ההגשה תקפה רק עם קבלת הסכם המוכר: contract_accepted=true + גרסת ההסכם.
// זמן הקבלה נחתם כאן בשרת (לא מהלקוח) כדי שהתיעוד יהיה ראייתי.
const UID = 'api::shop-seller-product.shop-seller-product' as const;

const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);
const MAX_IMAGES = 6;

function isPrivileged(user: any): boolean {
  if (!user) return false;
  const email = String(user.email ?? '').trim().toLowerCase();
  if (SUPER_ADMIN_EMAILS.has(email)) return true;
  return ['super_admin', 'shop_admin'].includes(user.app_role);
}

// אמון: מנהל חנות/סופר-אדמין, או שרת-לשרת עם API Token.
function isTrusted(ctx: any): boolean {
  if (ctx?.state?.auth?.strategy?.name === 'api-token') return true;
  return isPrivileged(ctx?.state?.user);
}

// השדות שמותר לציבור לראות על מוצר מאושר. הקניון השיתופי: פרטי החנות של המוכר
// (store_* - שם, לוגו, טלפון, וואטסאפ, עיר, אתר, תיאור) ציבוריים כמו שלט בקניון;
// seller_display = שם החנות. פרטי הזיהוי של המוכר (ת"ז, אימייל, כתובת) פרטיים.
function publicView(row: any) {
  if (!row) return row;
  return {
    store_name: row.store_name || row.seller_business || '',
    store_logo: row.store_logo || '',
    store_phone: row.store_phone || '',
    store_whatsapp: row.store_whatsapp || '',
    store_city: row.store_city || '',
    store_website: row.store_website || '',
    store_description: row.store_description || '',
    id: row.id,
    documentId: row.documentId,
    status: row.status,
    name: row.name,
    category: row.category,
    emoji: row.emoji,
    price: row.price,
    old_price: row.old_price,
    description: row.description,
    image: row.image,
    images: Array.isArray(row.images) ? row.images : (row.image ? [row.image] : []),
    link: row.link,
    quantity: row.quantity,
    delivery_days: row.delivery_days,
    seller_display: row.store_name || row.seller_business || row.seller_name || '',
    decided_at: row.decided_at,
    createdAt: row.createdAt,
  };
}

// תצוגה למוכר עצמו ("המוצרים שלי"): הכל חוץ מנתוני הביקורת הטכניים.
function ownerView(row: any) {
  if (!row) return row;
  const { contract_ip, contract_user_agent, admin_note, decided_by, ...rest } = row;
  return rest;
}

const S = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const N = (v: unknown) => (v === '' || v == null ? null : Number(v));

export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    if (isTrusted(ctx)) return super.find(ctx);
    const clientFilters = (ctx.query?.filters as object) ?? {};
    ctx.query = {
      ...ctx.query,
      filters: { $and: [clientFilters, { status: { $eq: 'approved' } }] },
    };
    const res: any = await super.find(ctx);
    if (res?.data && Array.isArray(res.data)) res.data = res.data.map(publicView);
    return res;
  },

  async findOne(ctx) {
    const res: any = await super.findOne(ctx);
    if (isTrusted(ctx)) return res;
    if (!res?.data || res.data.status !== 'approved') return ctx.notFound();
    res.data = publicView(res.data);
    return res;
  },

  // הגשה: ולידציה, כפיית pending, חתימת זמן ההסכם בשרת, צירוף המשתמש אם מחובר.
  async create(ctx) {
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    const user = ctx.state?.user;

    const name = S(body.name, 120);
    const price = N(body.price);
    const sellerName = S(body.seller_name, 120);
    const sellerEmail = S(body.seller_email, 160).toLowerCase();
    const sellerPhone = S(body.seller_phone, 40);
    const sellerId = S(body.seller_id_number, 20);
    const contractVersion = S(body.contract_version, 40);
    const storeName = S(body.store_name, 80);
    const storePhone = S(body.store_phone, 40);
    const storeLogo = typeof body.store_logo === 'string' ? body.store_logo : '';
    const storeWebsite = S(body.store_website, 300);

    if (!name) return ctx.badRequest('שם המוצר חובה');
    if (!storeName) return ctx.badRequest('שם החנות חובה');
    if (!storePhone) return ctx.badRequest('טלפון החנות חובה');
    if (storeLogo && (storeLogo.length > 400_000 || !/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(storeLogo))) return ctx.badRequest('לוגו לא תקין (עד ~300KB, תמונה)');
    if (storeWebsite && !/^https?:\/\/[^\s"'<>]+$/.test(storeWebsite)) return ctx.badRequest('כתובת האתר צריכה להתחיל ב-http(s)://');
    if (!price || !Number.isFinite(price) || price <= 0 || price > 1_000_000) return ctx.badRequest('מחיר לא תקין');
    if (!sellerName || !sellerEmail || !sellerPhone || !sellerId) return ctx.badRequest('פרטי המוכר חסרים (שם, אימייל, טלפון, ת"ז/ח.פ)');
    if (!/^\S+@\S+\.\S+$/.test(sellerEmail)) return ctx.badRequest('אימייל לא תקין');
    if (body.contract_accepted !== true || !contractVersion) return ctx.badRequest('יש לאשר את הסכם המוכר');

    // גלריית תמונות: עד 6 תמונות, הראשונה היא התמונה הראשית (image - נשמר גם
    // בנפרד לתאימות). כל תמונה מוקטנת בצד הלקוח ל-1200x900 (~עד 450KB);
    // הגבלה קשיחה בשרת נגד הצפה. body.image לבד (לקוח ישן) = גלריה של אחת.
    const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
    let images: string[] = Array.isArray(body.images) ? (body.images.filter((x) => typeof x === 'string' && x) as string[]) : [];
    if (!images.length && typeof body.image === 'string' && body.image) images = [body.image];
    if (images.length > MAX_IMAGES) return ctx.badRequest(`עד ${MAX_IMAGES} תמונות למוצר`);
    let totalBytes = 0;
    for (const img of images) {
      if (img.length > 1_200_000) return ctx.badRequest('אחת התמונות גדולה מדי');
      if (!DATA_IMAGE.test(img)) return ctx.badRequest('פורמט תמונה לא נתמך');
      totalBytes += img.length;
    }
    if (totalBytes > 4_500_000) return ctx.badRequest('סך התמונות גדול מדי');
    const image = images[0] || '';

    const now = new Date().toISOString();
    const forwardedIp = S(body.contract_ip, 80);
    ctx.request.body = {
      data: {
        status: 'pending',
        name,
        category: S(body.category, 40) || 'home',
        emoji: S(body.emoji, 8) || '📦',
        price: Math.round(price * 100) / 100,
        old_price: N(body.old_price) && Number(body.old_price) > price ? Math.round(Number(body.old_price) * 100) / 100 : null,
        description: S(body.description, 2000),
        image,
        images,
        link: S(body.link, 300),
        quantity: N(body.quantity) ? Math.max(0, Math.floor(Number(body.quantity))) : null,
        delivery_days: N(body.delivery_days) ? Math.max(1, Math.floor(Number(body.delivery_days))) : null,
        commission_percent: 10,

        store_name: storeName,
        store_logo: storeLogo,
        store_phone: storePhone,
        store_whatsapp: S(body.store_whatsapp, 40) || storePhone,
        store_city: S(body.store_city, 80),
        store_website: storeWebsite,
        store_description: S(body.store_description, 600),

        seller_name: sellerName,
        // שם החנות הוא גם "שם העסק" בהזמנות ובמיילים למוכר
        seller_business: storeName,
        seller_email: sellerEmail,
        seller_phone: sellerPhone,
        seller_id_number: sellerId,
        seller_address: S(body.seller_address, 200),
        seller_user_id: user ? String(user.id) : null,

        contract_accepted: true,
        contract_version: contractVersion,
        contract_accepted_at: now,
        contract_ip: forwardedIp || ctx.request.ip || '',
        contract_user_agent: S(ctx.request.headers['user-agent'], 400),

        submitted_at: now,
        decided_at: null,
        decided_by: null,
        rejection_reason: null,
        admin_note: null,
      },
    };
    const res: any = await super.create(ctx);
    if (res?.data) res.data = ownerView(res.data);
    return res;
  },

  // אישור / דחייה / עריכה - מנהל חנות בלבד. שינוי סטטוס נחתם בזמן ובמאשר.
  async update(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל החנות רשאי לאשר או לדחות מוצר');
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    if (body.status && ['pending', 'approved', 'rejected'].includes(String(body.status))) {
      body.decided_at = new Date().toISOString();
      body.decided_by = String(ctx.state?.user?.email ?? 'api-token');
    }
    // תיעוד ההסכם אינו ניתן לשינוי בדיעבד - גם לא על ידי מנהל.
    for (const k of ['contract_accepted', 'contract_version', 'contract_accepted_at', 'contract_ip', 'contract_user_agent', 'submitted_at', 'seller_user_id']) {
      delete body[k];
    }
    ctx.request.body = { data: body };
    return super.update(ctx);
  },

  async delete(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק מנהל החנות רשאי למחוק');
    return super.delete(ctx);
  },

  // GET /shop-seller-products/mine - ההגשות של המשתמש המחובר (לפי מזהה משתמש
  // או אימייל), כולל סטטוס וסיבת דחייה.
  async mine(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('נדרשת התחברות');
    const email = String(user.email ?? '').trim().toLowerCase();
    const entries: any[] = await strapi.documents(UID).findMany({
      filters: {
        $or: [{ seller_user_id: String(user.id) }, ...(email ? [{ seller_email: { $eqi: email } }] : [])],
      },
      sort: { createdAt: 'desc' },
      limit: 100,
    });
    ctx.body = { data: entries.map(ownerView) };
  },
}));
