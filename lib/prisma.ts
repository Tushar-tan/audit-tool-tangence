import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const isServerless =
  process.env.VERCEL === '1' ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  Boolean(process.env.NOW_REGION);

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "Audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "siteName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "inputMethod" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "overallGrade" TEXT NOT NULL DEFAULT 'A',
    "headerNavScore" INTEGER NOT NULL DEFAULT 0,
    "visualDesignScore" INTEGER NOT NULL DEFAULT 0,
    "responsiveScore" INTEGER NOT NULL DEFAULT 0,
    "contentScore" INTEGER NOT NULL DEFAULT 0,
    "buttonsCtasScore" INTEGER NOT NULL DEFAULT 0,
    "formsScore" INTEGER NOT NULL DEFAULT 0,
    "linksScore" INTEGER NOT NULL DEFAULT 0,
    "imagesMediaScore" INTEGER NOT NULL DEFAULT 0,
    "seoOnPageScore" INTEGER NOT NULL DEFAULT 0,
    "technicalSeoScore" INTEGER NOT NULL DEFAULT 0,
    "securityScore" INTEGER NOT NULL DEFAULT 0,
    "typographyContentScore" INTEGER NOT NULL DEFAULT 0,
    "errorStatesScore" INTEGER NOT NULL DEFAULT 0,
    "seoUxScore" INTEGER NOT NULL DEFAULT 0,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "processedPages" INTEGER NOT NULL DEFAULT 0,
    "pagesWithIssues" INTEGER NOT NULL DEFAULT 0,
    "pagesPassed" INTEGER NOT NULL DEFAULT 0,
    "criticalIssuesCount" INTEGER NOT NULL DEFAULT 0,
    "highIssuesCount" INTEGER NOT NULL DEFAULT 0,
    "mediumIssuesCount" INTEGER NOT NULL DEFAULT 0,
    "lowIssuesCount" INTEGER NOT NULL DEFAULT 0,
    "authType" TEXT NOT NULL DEFAULT 'public',
    "authLoginUrl" TEXT,
    "authStatus" TEXT NOT NULL DEFAULT 'not_required',
    "authPagesAuthenticated" INTEGER NOT NULL DEFAULT 0,
    "authPagesFailed" INTEGER NOT NULL DEFAULT 0,
    "authExpiredAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "PageAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pageTitle" TEXT,
    "httpStatus" INTEGER NOT NULL DEFAULT 200,
    "loadTimeMs" INTEGER NOT NULL DEFAULT 0,
    "desktopScreenshot" TEXT,
    "tabletScreenshot" TEXT,
    "mobileScreenshot" TEXT,
    "fullPageScreenshot" TEXT,
    "annotatedScreenshot" TEXT,
    "metricsJson" TEXT NOT NULL,
    "scoresJson" TEXT NOT NULL,
    "authStatus" TEXT NOT NULL DEFAULT 'public',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AuditIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT,
    "pageAuditId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FAIL',
    "viewport" TEXT,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "expectedBehavior" TEXT NOT NULL,
    "actualBehavior" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "elementSelector" TEXT,
    "elementText" TEXT,
    "elementInfo" TEXT,
    "elementBoxJson" TEXT,
    "screenshotUrl" TEXT,
    "isGrouped" BOOLEAN NOT NULL DEFAULT false,
    "affectedCount" INTEGER NOT NULL DEFAULT 1,
    "affectedUrlsJson" TEXT,
    "rootCause" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "CrawlLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
`;

function getDatabaseConfig(): { url: string; isSQLiteInTmp: boolean } {
  let dbUrl = process.env.DATABASE_URL || 'file:./dev.db';

  // If using SQLite in a serverless / Vercel environment where /var/task is read-only
  if (isServerless && (dbUrl.startsWith('file:') || !dbUrl.includes('://'))) {
    const tmpDbPath = path.join('/tmp', 'dev.db');
    let isNew = false;

    if (!fs.existsSync(tmpDbPath)) {
      // Check if template.db exists in project
      const possibleTemplatePaths = [
        path.join(process.cwd(), 'prisma', 'template.db'),
        path.join(process.cwd(), 'prisma', 'dev.db'),
        path.join(process.cwd(), 'template.db'),
        path.join(__dirname, '..', 'prisma', 'template.db')
      ];

      const foundTemplate = possibleTemplatePaths.find((p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      });

      if (foundTemplate) {
        try {
          fs.copyFileSync(foundTemplate, tmpDbPath);
        } catch {
          isNew = true;
        }
      } else {
        isNew = true;
      }
    }

    const resolvedUrl = `file:${tmpDbPath}`;
    process.env.DATABASE_URL = resolvedUrl;
    return { url: resolvedUrl, isSQLiteInTmp: isNew };
  }

  return { url: dbUrl, isSQLiteInTmp: false };
}

const { url: finalDbUrl, isSQLiteInTmp } = getDatabaseConfig();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  initializedTmpDb: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: finalDbUrl
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// If /tmp/dev.db was newly created without a template, initialize its schema on first call
if (isSQLiteInTmp && !globalForPrisma.initializedTmpDb) {
  globalForPrisma.initializedTmpDb = true;
  (async () => {
    try {
      const statements = SCHEMA_DDL.split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const sql of statements) {
        await prisma.$executeRawUnsafe(sql);
      }
    } catch (err) {
      console.warn('Failed to auto-initialize /tmp/dev.db schema:', err);
    }
  })();
}
