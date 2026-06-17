# מדריך התקנת Strapi + PostgreSQL בשרת

מדריך זה מתאר איך להעלות את הבאקאנד של Strapi לשרת חדש באמצעות Docker.

---

## 1. דרישות מקדימות לשרת

מערכת מומלצת: **Ubuntu 22.04 / 24.04 LTS**
מינימום: 2 vCPU, 2GB RAM, 20GB SSD

### התחברות לשרת
```bash
ssh root@<SERVER_IP>
# או אם יש לך משתמש לא-root:
ssh ubuntu@<SERVER_IP>
```

---

## 2. עדכון השרת והתקנת תוכנות בסיס

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw ca-certificates gnupg lsb-release
```

---

## 3. התקנת Docker + Docker Compose

```bash
# הוספת מאגר Docker הרשמי
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# הפעלת Docker אוטומטית
sudo systemctl enable --now docker

# בדיקה
docker --version
docker compose version
```

(אופציונלי) להוסיף את המשתמש שלך לקבוצת docker כדי שלא תצטרך sudo:
```bash
sudo usermod -aG docker $USER
# התנתק והתחבר מחדש
```

---

## 4. הגדרת חומת אש (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp     # HTTP (לאחר חיבור Nginx)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable
sudo ufw status
```

> שים לב: אל תפתח את 1337 לאינטרנט. נעטוף ב-Nginx + SSL.

---

## 5. שיבוט הפרויקט

```bash
sudo mkdir -p /opt/strapi
sudo chown $USER:$USER /opt/strapi
cd /opt/strapi

git clone <YOUR_GIT_URL> .
# או רק את התיקייה הזו אם המאגר גדול:
cd community-backend
```

---

## 6. יצירת קובץ `.env`

```bash
cp .env.example .env
nano .env
```

מלא ערכים אמיתיים. **הקפד להגריל מחדש את כל הסודות**:

```bash
# הרץ את הפקודה הבאה 5 פעמים — תקבל מפתח אקראי בכל פעם
openssl rand -base64 32
```

דוגמה למילוי:
```env
HOST=0.0.0.0
PORT=1337

APP_KEYS="<rand1>,<rand2>"
API_TOKEN_SALT=<rand3>
ADMIN_JWT_SECRET=<rand4>
TRANSFER_TOKEN_SALT=<rand5>
JWT_SECRET=<rand6>
ENCRYPTION_KEY=<rand7>

DATABASE_CLIENT=postgres
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=community
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=<סיסמה חזקה כאן>
DATABASE_SSL=false
```

> ב-`DATABASE_HOST` כתוב `postgres` — זה שם השירות ב-docker-compose, לא localhost.

---

## 7. הרצת Strapi + Postgres

```bash
cd /opt/strapi/community-backend
docker compose up -d --build
```

מעקב לוגים בזמן אמת:
```bash
docker compose logs -f strapi
```

לאחר ~30-60 שניות תראה הודעה ש-Strapi עלה. בדוק ב:
```
http://<SERVER_IP>:1337/admin
```

---

## 8. הגנה עם Nginx + HTTPS (Let's Encrypt)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

צור `/etc/nginx/sites-available/strapi`:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:1337;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

הפעל:
```bash
sudo ln -s /etc/nginx/sites-available/strapi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d api.yourdomain.com
```

---

## 9. גיבוי בסיס הנתונים (cron יומי)

```bash
sudo mkdir -p /opt/backups
sudo tee /opt/backups/backup-strapi.sh > /dev/null <<'EOF'
#!/bin/bash
DATE=$(date +%F)
docker exec community-postgres pg_dump -U strapi community | gzip > /opt/backups/community-$DATE.sql.gz
find /opt/backups -name "community-*.sql.gz" -mtime +14 -delete
EOF
sudo chmod +x /opt/backups/backup-strapi.sh

# crontab כל יום ב-03:00
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/backups/backup-strapi.sh") | crontab -
```

---

## 10. פקודות שימושיות לתחזוקה

```bash
# סטטוס
docker compose ps

# עצירה
docker compose down

# הפעלה מחדש
docker compose restart strapi

# עדכון קוד מ-git
git pull
docker compose up -d --build

# לוגים
docker compose logs -f strapi
docker compose logs -f postgres

# כניסה למיכל
docker exec -it community-strapi sh
docker exec -it community-postgres psql -U strapi -d community
```

---

## 11. בדיקת בריאות מהירה

```bash
curl http://localhost:1337/_health
# תגובה תקינה: 204 No Content
```

זהו — Strapi רץ עם PostgreSQL מאחורי Nginx + SSL.
