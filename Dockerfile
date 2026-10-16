# Production Dockerfile for AI UI/UX Website Audit Platform
FROM node:20-alpine AS base

# Install Chromium dependencies for Puppeteer browser automation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    openssl \
    ttf-freefont

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
# Schema must exist before npm ci, because postinstall runs prisma generate
COPY prisma ./prisma
RUN npm ci

COPY . .

# Build Next.js (build script also runs prisma generate)
RUN npm run build

EXPOSE 3000

ENV PORT 3000
ENV NODE_ENV production

# Create/update SQLite tables on the persistent volume, then start
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]
