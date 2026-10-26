import { prisma } from '../prisma';
import { WebsiteCrawler } from '../crawler/crawler';
import { runMultidisciplinaryAudit } from '../audit/ai-engine';
import { generateAnnotatedScreenshot } from '../annotator/annotator';
import { aggregateSiteScores } from '../audit/scoring-engine';
import { AuditConfig, CategoryScores } from '../types/audit';
import {
  establishAuditSession,
  destroyAuditSession,
} from '../crawler/auth-engine';
import {
  startPeriodicScreenshotCleanup,
  cleanupOldScreenshots
} from '../storage/screenshot-cleanup';

interface QueueJob {
  auditId: string;
  inputMethod: string;
  inputs: string[];
  config: AuditConfig;
  /** Optional: reuse an already-authenticated test session */
  testSessionId?: string;
}

class AuditJobQueue {
  private activeJobs: Set<string> = new Set();

  constructor() {
    // Start periodic background screenshot pruning (3-day retention)
    startPeriodicScreenshotCleanup();
  }

  public async addJob(job: QueueJob) {
    if (this.activeJobs.has(job.auditId)) return;
    this.activeJobs.add(job.auditId);

    // Opportunistically prune old screenshots (>3 days) in background
    cleanupOldScreenshots().catch(() => {});

    // Process asynchronously in background
    setImmediate(() => {
      this.processAudit(job).catch(async (err) => {
        console.error(`Audit job ${job.auditId} failed:`, err);
        await prisma.audit.update({
          where: { id: job.auditId },
          data: { status: 'failed' }
        });
        await this.addLog(job.auditId, 'error', `Audit failed: ${err.message}`);
        this.activeJobs.delete(job.auditId);
      });
    });
  }

  private async processAudit(job: QueueJob) {
    const { auditId, inputMethod, inputs, config, testSessionId } = job;
    const isAuthenticated = !!config.authentication;

    await prisma.audit.update({
      where: { id: auditId },
      data: { status: 'crawling', progressPercentage: 5 }
    });

    // ─── Authentication Setup ──────────────────────────────────────────────────
    if (isAuthenticated && config.authentication) {
      await this.addLog(auditId, 'info', `Setting up authenticated browser session (method: ${config.authentication.method})...`);

      const authSuccess = await establishAuditSession(
        auditId,
        config.authentication,
        testSessionId,
        (msg) => this.addLog(auditId, 'info', msg)
      );

      if (!authSuccess) {
        await prisma.audit.update({
          where: { id: auditId },
          data: {
            status: 'failed',
            authStatus: 'failed',
          }
        });
        await this.addLog(auditId, 'error', 'Authentication failed. Audit cannot proceed. Check credentials and login URL.');
        this.activeJobs.delete(auditId);
        return;
      }

      // Record auth metadata (NEVER store credentials/password)
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          authType: config.authentication.method,
          authLoginUrl: config.authentication.loginUrl,
          authStatus: 'authenticated',
        }
      });

      await this.addLog(auditId, 'success', '✓ Authentication successful — authenticated browser session established.');
    }

    await this.addLog(auditId, 'info', 'Initializing multi-viewport crawler & browser session...');

    const crawler = new WebsiteCrawler(config, async (progress) => {
      await this.addLog(auditId, progress.level, progress.message);
    });

    const urlsToProcess = await crawler.initialize(inputMethod, inputs);
    const totalPages = urlsToProcess.length;

    await prisma.audit.update({
      where: { id: auditId },
      data: { totalPages }
    });

    // After the crawler resolves the actual target URLs, if it's a single-URL audit
    // with a path (slug), update domain & siteName to include that slug so it
    // shows correctly on the dashboard.
    if (urlsToProcess.length === 1) {
      try {
        const u = new URL(urlsToProcess[0]);
        if (u.pathname && u.pathname !== '/' && u.pathname !== '') {
          const slugLabel = `${u.hostname}${u.pathname}`;
          const currentAudit = await prisma.audit.findUnique({ where: { id: auditId }, select: { siteName: true, domain: true } });
          if (currentAudit) {
            const isGenericSiteName = currentAudit.siteName === currentAudit.domain || currentAudit.siteName === u.hostname;
            await prisma.audit.update({
              where: { id: auditId },
              data: {
                domain: slugLabel,
                siteName: isGenericSiteName ? slugLabel : currentAudit.siteName
              }
            });
          }
        }
      } catch {
        // ignore URL parse errors
      }
    }

    await this.addLog(auditId, 'info', `Queued ${totalPages} page(s) for 10-category checklist audit.`);

    const allPageScores: CategoryScores[] = [];
    let criticalIssuesCount = 0;
    let highIssuesCount = 0;
    let mediumIssuesCount = 0;
    let lowIssuesCount = 0;
    let pagesWithIssuesCount = 0;
    let pagesPassedCount = 0;
    let authPagesAuthenticated = 0;
    let authPagesFailed = 0;

    await prisma.audit.update({
      where: { id: auditId },
      data: { status: 'analyzing', progressPercentage: 15 }
    });

    // ─── Page processing callback (shared between public and auth crawl) ───────
    const processPage = async (capturedPage: any, index: number) => {
      await this.addLog(auditId, 'info', `Auditing 10-category checklist across 13 viewports for ${capturedPage.url}...`);

      // Run 10-category checklist audit
      const auditResult = await runMultidisciplinaryAudit(
        capturedPage.url,
        capturedPage.metrics,
        config
      );

      allPageScores.push(auditResult.scores);

      if (auditResult.issues.length > 0) {
        pagesWithIssuesCount++;
      } else {
        pagesPassedCount++;
      }

      // Count severity levels
      for (const issue of auditResult.issues) {
        if (issue.severity === 'critical') criticalIssuesCount++;
        else if (issue.severity === 'high') highIssuesCount++;
        else if (issue.severity === 'medium') mediumIssuesCount++;
        else if (issue.severity === 'low') lowIssuesCount++;
      }

      // Track auth status per page
      const pageAuthStatus = capturedPage.authStatus ?? 'public';
      if (pageAuthStatus === 'authenticated') authPagesAuthenticated++;
      else if (pageAuthStatus === 'auth_required' || pageAuthStatus === 'auth_expired') authPagesFailed++;

      // Generate visual callout annotated screenshot
      const annotatedScreenshot = await generateAnnotatedScreenshot(
        auditId,
        index,
        capturedPage.desktopScreenshotPath,
        auditResult.issues
      );

      // Save PageAudit to DB (no credentials stored here)
      const pageAudit = await prisma.pageAudit.create({
        data: {
          auditId,
          url: capturedPage.url,
          pageTitle: capturedPage.pageTitle,
          httpStatus: capturedPage.httpStatus,
          loadTimeMs: capturedPage.loadTimeMs,
          desktopScreenshot: capturedPage.desktopScreenshotPath,
          tabletScreenshot: capturedPage.tabletScreenshotPath,
          mobileScreenshot: capturedPage.mobileScreenshotPath,
          fullPageScreenshot: capturedPage.fullPageScreenshotPath,
          annotatedScreenshot,
          metricsJson: JSON.stringify(capturedPage.metrics),
          scoresJson: JSON.stringify(auditResult.scores),
          authStatus: pageAuthStatus,
        }
      });

      // Save AuditIssues to DB
      for (const issue of auditResult.issues) {
        await prisma.auditIssue.create({
          data: {
            pageAuditId: pageAudit.id,
            auditId,
            issueId: issue.issueId || null,
            pageUrl: issue.pageUrl || capturedPage.url,
            category: issue.category,
            severity: issue.severity,
            status: issue.status || 'FAIL',
            viewport: issue.viewport || null,
            title: issue.title,
            problem: issue.problem,
            expectedBehavior: issue.expectedBehavior,
            actualBehavior: issue.actualBehavior,
            recommendation: issue.recommendation,
            elementSelector: issue.elementSelector || null,
            elementText: issue.elementText || null,
            elementInfo: issue.elementInfo || null,
            elementBoxJson: issue.elementBox ? JSON.stringify(issue.elementBox) : null,
            screenshotUrl: issue.screenshotUrl || null,
            isGrouped: issue.isGrouped || false,
            affectedCount: issue.affectedCount || 1,
            affectedUrlsJson: issue.affectedUrls ? JSON.stringify(issue.affectedUrls) : null,
            rootCause: issue.rootCause || null
          }
        });
      }

      const activeTotal = Math.min(config.maxPages, Math.max(totalPages, index, crawler.getQueuedPagesCount()));
      const pct = Math.min(95, Math.round(15 + (index / Math.max(1, activeTotal)) * 80));
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          processedPages: index,
          totalPages: activeTotal,
          progressPercentage: pct
        }
      });

      await this.addLog(auditId, 'success', `Completed 10-category checklist audit for page ${index}/${activeTotal}: ${capturedPage.url}`);
    };

    // ─── Execute Crawl ─────────────────────────────────────────────────────────
    let processedCount = 0;
    let authExpiredAt: string | null = null;

    try {
      if (isAuthenticated) {
        // Authenticated crawl path
        const crawlResult = await crawler.crawlSiteAuthenticated(
          urlsToProcess,
          auditId,
          processPage
        );
        processedCount = crawlResult.pagesCount;
        authExpiredAt = crawlResult.authExpiredAt;

        if (authExpiredAt) {
          await this.addLog(auditId, 'warn', `⚠ Authentication session expired at: ${authExpiredAt}. Crawl stopped safely.`);
        }
      } else {
        // Public crawl path (unchanged behavior)
        processedCount = await crawler.crawlSite(urlsToProcess, auditId, processPage);
      }
    } finally {
      // ─── SECURITY: Always destroy the authenticated session ────────────────
      if (isAuthenticated) {
        await destroyAuditSession(auditId);
        await this.addLog(auditId, 'info', 'Authenticated browser session closed and cleaned up.');
      }
    }

    // Calculate overall site weighted average scores
    const siteScores = aggregateSiteScores(allPageScores);

    const finalAuthStatus = authExpiredAt
      ? 'expired'
      : isAuthenticated
      ? 'authenticated'
      : 'not_required';

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'completed',
        progressPercentage: 100,
        processedPages: processedCount,
        totalPages: Math.max(totalPages, processedCount),
        overallScore: siteScores.overall,
        overallGrade: siteScores.overallGrade,
        headerNavScore: siteScores.headerNav,
        visualDesignScore: siteScores.visualDesign,
        responsiveScore: siteScores.responsive,
        contentScore: siteScores.content,
        buttonsCtasScore: siteScores.buttonsCtas,
        formsScore: siteScores.forms,
        linksScore: siteScores.links,
        imagesMediaScore: siteScores.imagesMedia,
        seoOnPageScore: siteScores.seoOnPage,
        technicalSeoScore: siteScores.technicalSeo,
        securityScore: siteScores.security,
        typographyContentScore: siteScores.content,
        errorStatesScore: siteScores.technicalSeo,
        seoUxScore: siteScores.seoOnPage,
        pagesWithIssues: pagesWithIssuesCount,
        pagesPassed: pagesPassedCount,
        criticalIssuesCount,
        highIssuesCount,
        mediumIssuesCount,
        lowIssuesCount,
        // Auth summary
        authStatus: finalAuthStatus,
        authPagesAuthenticated,
        authPagesFailed,
        authExpiredAt: authExpiredAt ?? undefined,
      }
    });

    await this.addLog(auditId, 'success', `Site checklist audit complete! Overall health score: ${siteScores.overall}/100.`);
    if (isAuthenticated) {
      await this.addLog(auditId, 'success', `Authenticated pages crawled: ${authPagesAuthenticated} | Failed: ${authPagesFailed}`);
    }
    this.activeJobs.delete(auditId);

    // Prune expired screenshots after audit completes
    cleanupOldScreenshots().catch(() => {});
  }

  private async addLog(auditId: string, level: string, message: string) {
    try {
      await prisma.crawlLog.create({
        data: {
          auditId,
          level,
          message
        }
      });
    } catch {
      // ignore log write errors
    }
  }
}

export const auditQueue = new AuditJobQueue();
