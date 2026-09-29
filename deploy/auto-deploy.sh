#!/usr/bin/env bash
# ============================================================
# auto-deploy — נמשך ע"י cron על ה-VPS כל 5 דקות (flock מונע ריצות חופפות):
#   */5 * * * * /usr/bin/flock -n /tmp/community-deploy.lock \
#               /opt/strapi/community-backend/auto-deploy.sh \
#               >> /opt/strapi/community-backend/auto-deploy.log 2>&1
#
# הסקריפט כבר לא בונה. GitHub Actions בונה את ה-image בכל דחיפה ל-main ודוחף
# אותו ל-GHCR (.github/workflows/deploy.yml), והשרת רק מושך אותו. קודם רץ כאן
# `docker compose build` — 14 דקות של npm ci + strapi build על שתי הליבות של
# ה-VPS. בכל דפלוי העומס טיפס ל-2.8, SELECT 1 הגיע ל-545ms וכל האתרים נחנקו.
#
# הקובץ הזה מנוהל ב-git. אחרי שינוי כאן, להתקין על השרת:
#   sudo install -m 755 deploy/auto-deploy.sh /opt/strapi/community-backend/auto-deploy.sh
# ============================================================
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

REPO_DIR=/opt/strapi/community-backend
IMAGE=ghcr.io/gofreeil/community-backend

cd "$REPO_DIR"

# לכל היותר $1 גרסאות של ה-image על הדיסק. כל אחת ~4.3GB, ופרץ של 10 דפלויים
# ביומיים מילא 13GB (29.9.2026) - prune לפי גיל לא עומד בקצב כזה. תמיד נשמרות
# הגרסאות שקונטיינר משתמש בהן, ואת שאר המקומות ממלאות החדשות ביותר.
keep_newest_images() {
    local keep=$1 in_use ids id n=0
    in_use=$(docker ps -aq | xargs -r docker inspect -f '{{.Image}}' | sort -u)
    ids=$(docker images -q --no-trunc "$IMAGE" | sort -u \
        | xargs -r docker image inspect -f '{{.Created}} {{.Id}}' | sort -r | cut -d' ' -f2)
    # קודם אלה שבשימוש, אחריהם השאר מהחדש לישן
    for id in $(grep -xF -f <(echo "$in_use") <<<"$ids"; grep -vxF -f <(echo "$in_use") <<<"$ids"); do
        n=$((n + 1))
        [ "$n" -le "$keep" ] && continue
        grep -qxF "$id" <<<"$in_use" && continue
        docker rmi -f "$id" >/dev/null
    done
}

git fetch origin --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

# פורסים לפי ה-SHA המדויק ולא לפי latest, כדי שהקוד שעל השרת וה-image שרץ
# יהיו תמיד מאותו קומיט. אם ה-build ב-Actions עדיין רץ — פשוט נמתין לטיק הבא.
# הבדיקה הזאת חייבת לקרות לפני ה-reset: אחרת נעדכן קוד בלי image תואם.
if ! docker manifest inspect "$IMAGE:$REMOTE" >/dev/null 2>&1; then
    echo "=== $(date -u) $REMOTE — ה-image עדיין לא פורסם, ממתין ל-CI ==="
    exit 0
fi

echo "=== $(date -u) deploying $REMOTE ==="

# קודם מושכים, ורק אחרי משיכה מוצלחת מעדכנים את git. אחרת משיכה שנכשלת
# (למשל שכבה פגומה ב-GHCR אחרי בנייה שנפלה בשלב הקאש) משאירה HEAD == origin/main,
# וכל הריצות הבאות יוצאות מיד ב"אין מה לפרוס" - והשרת תקוע על הגרסה הישנה
# בלי שאף אחד יודע. עכשיו כישלון משיכה = exit 1 וניסיון חוזר בטיק הבא.
# פינוי לפני המשיכה, לא רק אחריה: image של Strapi שוקל ~1.7GB, והדיסק 38GB.
# משיכות שנכשלו (ולכן לא הגיעו ל-prune שבסוף) השאירו שכבות חלקיות ו-images
# ישנים עד 97% תפוסה - ואז כל משיכה נכשלת ב"no space left" והשרת תקוע.
# לפני המשיכה נשאר רק מה שבשימוש, כך שאחריה יש לכל היותר 2 (ה-image הרץ לעולם לא נמחק).
# גרסה קודמת לחזרה אחורה לא נשמרת: כל הגרסאות ב-GHCR, ומשיכה מחדש לוקחת דקה-שתיים.
keep_newest_images 1 || true
docker image prune -f >/dev/null 2>&1 || true

export IMAGE_TAG="$REMOTE"
if ! docker compose pull strapi strapi2; then
    echo "=== $(date -u) $REMOTE — משיכת ה-image נכשלה, ננסה שוב בטיק הבא ==="
    exit 1
fi
git reset --hard origin/main

# רולינג: מחליפים מופע אחד בכל פעם, בזמן ש-nginx (upstream strapi_up) מנתב את
# התעבורה לשני. --wait חוסם עד ש-healthcheck עובר, כך שלא נפיל את שניהם יחד.
# --force-recreate חובה: בלעדיו compose לא תמיד מזהה ש-IMAGE_TAG השתנה (תג image
# דרך env var), והקונטיינר נשאר על ה-image הישן — הקוד נבנה אבל לא רץ.
docker compose up -d --no-deps --force-recreate --wait strapi
docker compose up -d --no-deps --force-recreate --wait strapi2

keep_newest_images 2 || true
docker image prune -f
echo "=== $(date -u) deploy done ($REMOTE) ==="
