# syntax=docker/dockerfile:1.6

# ---------- Stage 1: build ----------
FROM node:20-alpine AS builder

RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git python3

WORKDIR /opt/app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=2048

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# חייבים לרענן את types/generated לפני קומפילציה - אחרת factories.create* יזרוק שגיאה
# על content-types חדשים שלא נכללים בקובץ ה-types שעלה ב-git.
# Strapi דורש שיהיו ENV vars לתצורה אפילו ב-typegen, נותנים placeholders שאינם משמשים בריצה.
RUN APP_KEYS=build-only-placeholder-key \
    ADMIN_JWT_SECRET=build-only-placeholder \
    API_TOKEN_SALT=build-only-placeholder \
    TRANSFER_TOKEN_SALT=build-only-placeholder \
    JWT_SECRET=build-only-placeholder \
    ENCRYPTION_KEY=build-only-placeholder \
    npx strapi ts:generate-types

RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:20-alpine

RUN apk add --no-cache vips-dev

WORKDIR /opt/app

ENV NODE_ENV=production
ENV PATH=/opt/app/node_modules/.bin:$PATH

COPY --from=builder /opt/app/package.json /opt/app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /opt/app/node_modules ./node_modules
COPY --from=builder /opt/app/dist ./dist
COPY --from=builder /opt/app/config ./config
COPY --from=builder /opt/app/src ./src
COPY --from=builder /opt/app/public ./public
COPY --from=builder /opt/app/database ./database
COPY --from=builder /opt/app/types ./types
COPY --from=builder /opt/app/favicon.png ./favicon.png
COPY --from=builder /opt/app/tsconfig.json ./tsconfig.json

RUN mkdir -p /opt/app/public/uploads && chown -R node:node /opt/app

USER node

EXPOSE 1337

CMD ["npm", "run", "start"]
