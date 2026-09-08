import { factories } from '@strapi/strapi';

// דריסות תוכן של חנות החירות - סופר-אדמין עורך טקסטים ותמונות מתוך האתר
// (js/site-editor.js בחנות). קריאה ציבורית (האתר טוען את הדריסות של הדף בכל
// טעינה); כתיבה - סופר-אדמין בלבד. הערכים מנוקים כאן, בגבול השרת, כי ה-HTML
// של דריסת טקסט נכנס ל-innerHTML אצל כל הגולשים.
const UID = 'api::shop-site-override.shop-site-override' as const;

const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);

function isSuperAdmin(user: any): boolean {
  if (!user) return false;
  const email = String(user.email ?? '').trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.has(email) || user.app_role === 'super_admin';
}
function isTrusted(ctx: any): boolean {
  if (ctx?.state?.auth?.strategy?.name === 'api-token') return true;
  return isSuperAdmin(ctx?.state?.user);
}

const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
// ערכי CSS מותרים: מספרים, יחידות, אחוזים, מילים, צבעי hex/rgb - בלי url(), נקודה-פסיק או גרשיים
const SAFE_CSS_VALUE = /^[\w\s.%#(),\-]{1,60}$/;
const STYLE_KEYS: Record<'text' | 'image', string[]> = {
  text: ['fontSize', 'lineHeight', 'fontWeight', 'textAlign', 'color', 'marginTop', 'marginBottom', 'letterSpacing', 'hidden'],
  image: ['width', 'height', 'maxWidth', 'objectFit', 'objectPosition', 'borderRadius', 'marginTop', 'marginBottom', 'align', 'opacity', 'hidden'],
};

function cleanStyle(kind: 'text' | 'image', raw: unknown): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of STYLE_KEYS[kind]) {
    const v = (raw as Record<string, unknown>)[k];
    if (k === 'hidden') { if (v === true) out.hidden = true; continue; }
    if (typeof v === 'string' && v.trim() && SAFE_CSS_VALUE.test(v.trim())) out[k] = v.trim();
  }
  return out;
}

// HTML של טקסט: נשמר כמו שהוא (עד 20K תווים); הניקוי המלא לתגים מותרים נעשה
// בצד הלקוח בזמן ההחלה (sanitizeHtml ב-site-editor.js) - אבל חוסמים כאן
// דברים שאף פעם לא לגיטימיים בטקסט של דף: סקריפטים, מטפלי אירועים, iframes.
const FORBIDDEN_HTML = /<\s*(script|iframe|object|embed|style|link|meta|form|input|textarea|svg|math)\b|\bon[a-z]+\s*=|javascript:|data:text\/html/i;

function cleanData(kind: string, raw: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (kind === 'text') {
    const html = typeof d.html === 'string' ? d.html : '';
    if (html.length > 20_000) return { ok: false, error: 'הטקסט ארוך מדי' };
    if (FORBIDDEN_HTML.test(html)) return { ok: false, error: 'הטקסט מכיל תוכן לא מותר' };
    return { ok: true, data: { html, style: cleanStyle('text', d.style) } };
  }
  if (kind === 'image') {
    const src = typeof d.src === 'string' ? d.src : '';
    if (src && (src.length > 1_600_000 || !DATA_IMAGE.test(src))) return { ok: false, error: 'תמונה לא תקינה (עד ~1.2MB, PNG/JPEG/WebP/GIF)' };
    const alt = typeof d.alt === 'string' ? d.alt.slice(0, 200) : '';
    return { ok: true, data: { src, alt, style: cleanStyle('image', d.style) } };
  }
  return { ok: false, error: 'kind לא מוכר' };
}

const S = (v: unknown, max = 255) => String(v ?? '').trim().slice(0, max);

export default factories.createCoreController(UID, ({ strapi }) => ({
  async create(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק סופר-אדמין רשאי לערוך את תוכן האתר');
    return super.create(ctx);
  },
  async update(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק סופר-אדמין רשאי לערוך את תוכן האתר');
    return super.update(ctx);
  },
  async delete(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק סופר-אדמין רשאי לערוך את תוכן האתר');
    return super.delete(ctx);
  },

  // POST /shop-site-overrides/upsert  { key, page, kind, data }
  async upsert(ctx) {
    if (!isTrusted(ctx)) return ctx.forbidden('רק סופר-אדמין רשאי לערוך את תוכן האתר');
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const key = S(body.key, 255);
    const page = S(body.page, 40);
    const kind: 'text' | 'image' = body.kind === 'image' ? 'image' : 'text';
    if (!key) return ctx.badRequest('key חסר');
    const cleaned = cleanData(kind, body.data);
    if ('error' in cleaned) return ctx.badRequest(cleaned.error);
    const data = {
      key, page, kind,
      data: cleaned.data as any,
      updated_by_email: String(ctx.state?.user?.email ?? 'api-token'),
    };
    const existing: any[] = await strapi.documents(UID).findMany({ filters: { key: { $eq: key } }, limit: 1 });
    // עדכון סגנון בלבד (בלי תמונה חדשה) שומר את התמונה שכבר נשמרה
    if (kind === 'image' && !data.data.src && existing[0]?.data?.src) data.data.src = existing[0].data.src;
    const row = existing[0]
      ? await strapi.documents(UID).update({ documentId: existing[0].documentId, data })
      : await strapi.documents(UID).create({ data });
    ctx.body = { data: row };
  },
}));
