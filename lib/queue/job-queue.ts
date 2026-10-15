import { prisma } from '../prisma';
import { WebsiteCrawler } from '../crawler/crawler';
import { runMultidisciplinaryAudit } from '../audit/ai-engine';
import { generateAnnotatedScreenshot } from '../annotator/annotator';
import { aggregateSiteScores } from '../audit/scoring-engine';
import { AuditConfig, CategoryScores } from '../types/audit';

interface QueueJob {
  auditId: string;
  inputMethod: string;
  inputs: string[];
  config: AuditConfig;
}

class AuditJobQueue {
  private activeJobs: Set<string> = new Set();

  public async addJob(job: QueueJob) {
    if (this.activeJobs.has(job.auditId)) return;
    this.activeJobs.add(job.auditId);

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
    const { auditId, inputMethod, inputs, config } = job;

    await prisma.audit.update({
      where: { id: auditId },
      data: { status: 'crawling', progressPercentage: 5 }
    });

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
    // shows correctly on the dashboard (e.g. extranet.tangence.com/ewac instead of extranet.tangence.com).
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

    await prisma.audit.update({
      where: { id: auditId },
      data: { status: 'analyzing', progressPercentage: 15 }
    });

    const processedCount = await crawler.crawlSite(
      urlsToProcess,
      auditId,
      async (capturedPage, index) => {
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

        // Generate visual callout annotated screenshot
        const annotatedScreenshot = await generateAnnotatedScreenshot(
          auditId,
          index,
          capturedPage.desktopScreenshotPath,
          auditResult.issues
        );

        // Save PageAudit to DB
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
            scoresJson: JSON.stringify(auditResult.scores)
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

        const pct = Math.min(95, Math.round(15 + (index / Math.max(1, totalPages)) * 80));
        await prisma.audit.update({
          where: { id: auditId },
          data: {
            processedPages: index,
            progressPercentage: pct
          }
        });

        await this.addLog(auditId, 'success', `Completed 10-category checklist audit for page ${index}/${totalPages}: ${capturedPage.url}`);
      }
    );

    // Calculate overall site weighted average scores
    const siteScores = aggregateSiteScores(allPageScores);

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'completed',
        progressPercentage: 100,
        processedPages: processedCount,
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
        lowIssuesCount
      }
    });

    await this.addLog(auditId, 'success', `Site checklist audit complete! Overall health score: ${siteScores.overall}/100.`);
    this.activeJobs.delete(auditId);
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
