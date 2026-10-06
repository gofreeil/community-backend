/**
 * עזרי גישה משותפים ל-controllers של "מבקר רשויות המדינה" (criticism).
 *
 * המודל זהה לשאר אתרי הרשת (אינדקס, חנות, דירוג): כתיבה דרך REST בלבד, ה-controller כופה
 * את הכללים (סטטוס, בעלות, שדות), ואישור/דחייה/מענה מגיעים משרת האתר עם API Token
 * (אחרי שהוא בדק שם שהמשתמש מנהל העיר). אין כאן שום הרשאת update/delete לתפקידי users-permissions.
 */

const SUPER_ADMIN_EMAILS = new Set(['yahavanter@gmail.com']);

/** משתמש-על (כמו ב-idx-review ובשאר ה-controllers). */
export function isPrivilegedUser(user: any): boolean {
    if (!user) return false;
    const email = String(user.email ?? '').trim().toLowerCase();
    if (SUPER_ADMIN_EMAILS.has(email)) return true;
    return user.app_role === 'super_admin';
}

/** אמון: שרת-לשרת עם API Token, או משתמש-על. */
export function isTrusted(ctx: any): boolean {
    if (ctx?.state?.auth?.strategy?.name === 'api-token') return true;
    return isPrivilegedUser(ctx?.state?.user);
}

/** מזהה-בעלות: documentId אם קיים, אחרת id. */
export function sameUser(a: any, b: any): boolean {
    if (!a || !b) return false;
    if (a.documentId && b.documentId) return a.documentId === b.documentId;
    return a.id != null && b.id != null && String(a.id) === String(b.id);
}

/**
 * מפתחות מותרים בפילטר/מיון שמגיע מלקוח לא-מהימן. כל מפתח אחר (בעיקר userOpener,
 * supporters ו-email) נדחה כדי שאי אפשר יהיה לחקור "האם הכתובת X פתחה פנייה".
 */
export function filtersAreSafe(node: unknown, allowed: ReadonlySet<string>): boolean {
    if (node == null || typeof node !== 'object') return true;
    if (Array.isArray(node)) return node.every((n) => filtersAreSafe(n, allowed));
    return Object.entries(node as Record<string, unknown>).every(([key, value]) => {
        if (key.startsWith('$')) return filtersAreSafe(value, allowed);
        if (!allowed.has(key)) return false;
        return filtersAreSafe(value, allowed);
    });
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function cleanText(value: unknown, max: number): string {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** רשימת documentId-ים תקינה מקלט לא-מהימן (מחרוזות בלבד, עד max). */
export function docIdList(value: unknown, max = 20): string[] {
    const arr = Array.isArray(value) ? value : value == null ? [] : [value];
    return arr
        .map((v) => (typeof v === 'string' ? v : typeof v === 'object' && v && 'documentId' in v ? String((v as any).documentId) : ''))
        .filter((v) => /^[A-Za-z0-9]{10,40}$/.test(v))
        .slice(0, max);
}
