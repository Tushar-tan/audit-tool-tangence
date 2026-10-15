# Production Dockerfile for AI UI/UX Website Audit Platform
FROM node:20-alpine AS base

# Install Chromium dependencies for Puppeteer browser automation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma Client & Build Next.js
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

ENV PORT 3000
ENV NODE_ENV production

# Create/update SQLite tables on the persistent volume, then start
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]
