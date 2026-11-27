import {
    createCode,
    getExternalSite,
    isProviderAvatarUrl,
    isPublicName,
    readCode,
    toExternalUser,
    usersQuery,
    verifySignature,
} from '../../../utils/externalSso';
import {
    cleanClientId,
    cleanInviterName,
    inviteLimits,
    inviteText,
    isInvitablePhone,
    maskPhone,
    phoneKey,
    releaseInvite,
    reserveInvite,
    type InviteDenied,
    type InviteState,
} from '../../../utils/externalInvite';
import { sendSms, smsEnabled, smsProviderName, toMobileE164 } from '../../../utils/sms';

declare const strapi: any;

const USER = 'plugin::users-permissions.user';
const USED_CODES_KEY = 'external-sso-used-codes';
const USED_CODES_LOCK_ID = 7_243_002; // מזהה נעילה ייעודי ל-pg_advisory_xact_lock
const INVITES_KEY = 'external-sso-invites';
const INVITES_LOCK_ID = 7_243_003;
const LOCK_TRIES = 5;
const LOCK_RETRY_MS = 100;
const BUSY = Symbol('busy');

/** כמה מחכים לספק ה-SMS. חייב להיות קצר מהזמן שהאתר החיצוני מחכה לתשובה (20 שניות). */
const smsTimeoutMs = (): number => {
    const n = Math.trunc(Number(process.env.EXTERNAL_INVITE_SMS_TIMEOUT_MS));
    return Number.isFinite(n) && n >= 100 && n <= 15_000 ? n : 12_000;
};

const secret = (): string => String(strapi.config.get('plugin::users-permissions.jwtSecret') ?? '');
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** בקשה חתומה מאתר מוכר → { site, key, data }, אחרת null */
function signedRequest(ctx: any, action: string) {
    const key = ctx.request.headers['x-ext-site'];
    const site = getExternalSite(key);
    const payload = (ctx.request.body as any)?.payload;
    if (!site || !verifySignature(site.publicKey, ctx.request.headers['x-ext-timestamp'], ctx.request.headers['x-ext-signature'], action, payload)) {
        return null;
    }
    try {
        return { key: String(key), site, data: JSON.parse(payload) };
    } catch {
        return null;
    }
}

/**
 * מריץ את fn כשרק אחד משני מופעי ה-Strapi מחזיק את הנעילה.
 * הטרנזקציה היא של Strapi (strapi.db.transaction), ולכן הקריאות למאגר בתוך fn רצות על אותו חיבור:
 * בקשה שמחכה לנעילה מחזיקה חיבור אחד בלבד, ומי שמחזיק בנעילה לא צריך חיבור נוסף כדי לסיים.
 * (עם טרנזקציה גולמית של knex המאגר ביקש חיבור שני, ועשר בקשות במקביל רוקנו את בריכת החיבורים
 * ותקעו את כל השרת עד ה-timeout.)
 * wait=false: לא מחכים לנעילה יותר מחצי שנייה; מוחזר BUSY.
 */
async function underLock<T>(lockId: number, wait: boolean, fn: () => Promise<T>): Promise<T | typeof BUSY> {
    if (process.env.DATABASE_CLIENT !== 'postgres') return fn();
    return strapi.db.transaction(async ({ trx }: any) => {
        if (wait) {
            await trx.raw('SELECT pg_advisory_xact_lock(?)', [lockId]);
            return fn();
        }
        for (let i = 0; i < LOCK_TRIES; i++) {
            const res = await trx.raw('SELECT pg_try_advisory_xact_lock(?) AS locked', [lockId]);
            if (res?.rows?.[0]?.locked === true) return fn();
            if (i < LOCK_TRIES - 1) await sleep(LOCK_RETRY_MS);
        }
        return BUSY;
    });
}

/** מסמן קוד כמנוצל; false אם כבר נוצל. תחת נעילה - יש שני מופעי Strapi. */
async function useOnce(jti: string, exp: number): Promise<boolean> {
    const used = await underLock(USED_CODES_LOCK_ID, true, async () => {
        const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
        const codes = ((await store.get({ key: USED_CODES_KEY })) ?? {}) as Record<string, number>;
        const now = Math.floor(Date.now() / 1000);
        for (const [id, until] of Object.entries(codes)) if (until < now) delete codes[id];
        if (codes[jti]) return false;
        codes[jti] = exp;
        await store.set({ key: USED_CODES_KEY, value: codes });
        return true;
    });
    return used === true;
}

/**
 * קורא את מצב ההזמנות ומריץ עליו את fn; אם fn החזיר state - שומר אותו. תחת נעילה שלא מחכים לה:
 * פרץ של בקשות במקביל מקבל BUSY ולא תופס חיבורים.
 */
async function withInviteState<T>(fn: (raw: unknown) => { value: T; state?: InviteState }): Promise<T | typeof BUSY> {
    return underLock(INVITES_LOCK_ID, false, async () => {
        const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
        const out = fn(await store.get({ key: INVITES_KEY }));
        if (out.state) await store.set({ key: INVITES_KEY, value: out.state });
        return out.value;
    });
}

export default {
    /**
     * POST /api/external-sso/invite { phone, inviterId, inviter, client } - משתמש באתר החיצוני מזמין חבר ב-SMS.
     * ה-SMS יוצא מכאן (utils/sms.ts); הטקסט והקישור קבועים, מהאתר מגיע רק שם המזמין (מנוקה).
     * תוצאה עסקית חוזרת תמיד ב-200: { ok } או { ok: false, error }. { check: true } רק מדווח אם השליחה זמינה.
     */
    async invite(ctx: any) {
        const req = signedRequest(ctx, 'invite');
        if (!req) return ctx.unauthorized('bad signature');
        const invite = req.site.invite;
        const enabled = !!invite && process.env.EXTERNAL_INVITE_ENABLED !== 'false' && smsEnabled() && !!secret();
        if (req.data?.check === true) {
            ctx.body = { ok: true, enabled, provider: smsProviderName() };
            return;
        }
        if (!enabled) {
            ctx.body = { ok: false, error: 'unavailable' };
            return;
        }
        const to = toMobileE164(typeof req.data?.phone === 'string' ? req.data.phone : '');
        if (!isInvitablePhone(to)) {
            ctx.body = { ok: false, error: 'invalid_phone' };
            return;
        }
        const inviterId = Number(req.data?.inviterId);
        if (!Number.isInteger(inviterId) || inviterId <= 0) return ctx.badRequest('bad inviter');

        const client = cleanClientId(req.data?.client);
        const key = { phone: phoneKey(secret(), to), inviter: `${req.key}:u:${inviterId}`, client: client ? `${req.key}:c:${client}` : '' };
        const tag = `[external-invite:${req.key}] user ${inviterId} → ${maskPhone(to)}`;
        const limits = inviteLimits();
        const at = Date.now();
        const denied = await withInviteState<InviteDenied | null>((raw) => {
            const r = reserveInvite(raw, key, at, limits);
            return { value: 'error' in r ? r.error : null, state: r.changed ? r.state : undefined };
        });
        if (denied) {
            const error = denied === BUSY ? 'busy' : denied;
            strapi.log.warn(`${tag}: לא נשלח (${error})`);
            ctx.body = { ok: false, error };
            return;
        }

        // מחכים לספק זמן מוגבל. אחרי זה השליחה ממשיכה ברקע, ולכן הרישום נשאר: ייתכן שה-SMS עוד ייצא.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const sending = sendSms(to, inviteText(invite.name, cleanInviterName(req.data?.inviter), invite.url)).then(
            () => 'sent' as const,
            (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
        );
        const timeoutMs = smsTimeoutMs();
        const outcome = await Promise.race([
            sending,
            new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); }),
        ]);
        clearTimeout(timer);
        if (outcome === 'timeout') {
            strapi.log.warn(`${tag}: אין תשובה מספק ה-SMS אחרי ${timeoutMs / 1000} שניות`);
            ctx.body = { ok: false, error: 'sms_pending' };
            return;
        }
        if (outcome !== 'sent') {
            strapi.log.error(`${tag}: שליחה נכשלה: ${outcome.message}`);
            // מחזירים את מכסת השליחות (הניסיון נשאר רשום), כדי שאפשר יהיה לנסות שוב
            await withInviteState((raw) => ({ value: null, state: releaseInvite(raw, key, at, Date.now(), limits) })).catch(() => undefined);
            ctx.body = { ok: false, error: 'sms_failed' };
            return;
        }
        strapi.log.info(`${tag}: נשלח via ${smsProviderName()}`);
        ctx.body = { ok: true };
    },

    /** POST /api/external-sso/users - דף נרשמים לפתיחת חשבונות באתר החיצוני */
    async users(ctx: any) {
        const req = signedRequest(ctx, 'users');
        if (!req) return ctx.unauthorized('bad signature');
        const query = usersQuery(req.data);
        if (!query) return ctx.badRequest('bad query');
        const rows = await strapi.db.query(USER).findMany({
            where: query.where,
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            limit: query.limit,
            select: ['id', 'email', 'username', 'nickname', 'avatar_url', 'createdAt', 'updatedAt'],
        });
        ctx.body = { users: rows.map(toExternalUser), hasMore: rows.length === query.limit };
    },

    /** POST /api/external-sso/exchange - קוד חד-פעמי → פרטי המשתמש */
    async exchange(ctx: any) {
        const req = signedRequest(ctx, 'exchange');
        if (!req) return ctx.unauthorized('bad signature');
        const data = readCode(secret(), req.data?.code);
        if (!data || data.site !== req.key || data.redirectUri !== req.data?.redirectUri) {
            return ctx.badRequest('bad or expired code');
        }
        if (!(await useOnce(data.jti, data.exp))) return ctx.badRequest('code already used');
        const user = await strapi.db.query(USER).findOne({ where: { id: data.userId } });
        if (!user || user.blocked || !user.confirmed) return ctx.forbidden('user not allowed');
        ctx.body = { user: toExternalUser(user) };
    },

    /** POST /api/external-sso/code { client, redirectUri } - קוד כניסה למשתמש המחובר */
    async code(ctx: any) {
        const user = ctx.state?.user;
        if (!user) return ctx.unauthorized('login required');
        if (user.blocked) return ctx.forbidden('user blocked');
        const body = (ctx.request.body ?? {}) as { client?: unknown; redirectUri?: unknown };
        const site = getExternalSite(body.client);
        if (!site || typeof body.redirectUri !== 'string' || !site.redirects.includes(body.redirectUri)) {
            return ctx.badRequest('unknown client or redirect address');
        }
        ctx.body = {
            code: createCode(secret(), { userId: user.id, site: String(body.client), redirectUri: body.redirectUri }),
            redirectUri: body.redirectUri,
        };
    },

    /**
     * POST /api/external-sso/my-profile { avatarUrl?, name? } - בסוף הרשמה עם Google/Facebook האתר
     * שומר את התמונה והשם על רשומת המשתמש. ממלא רק שדות ריקים; לעולם לא דורס.
     */
    async myProfile(ctx: any) {
        const authed = ctx.state?.user;
        if (!authed) return ctx.unauthorized('login required');
        const user = await strapi.db.query(USER).findOne({ where: { id: authed.id } });
        if (!user) return ctx.notFound('user not found');
        const body = (ctx.request.body ?? {}) as { avatarUrl?: unknown; name?: unknown };
        const data: Record<string, string> = {};
        if (!user.avatar_url && isProviderAvatarUrl(body.avatarUrl)) data.avatar_url = body.avatarUrl;
        if (!user.nickname && isPublicName(body.name)) data.nickname = body.name.trim().slice(0, 60);
        const saved = Object.keys(data); // לפני העדכון: Strapi מוסיף updatedAt לאותו אובייקט
        if (saved.length) await strapi.db.query(USER).update({ where: { id: user.id }, data });
        ctx.body = { ok: true, saved };
    },
};
