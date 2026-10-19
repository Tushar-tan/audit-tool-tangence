import robotsParser from 'robots-parser';
import { capturePageData, capturePageDataAuthenticated, PageCaptureResult } from './browser-session';
import { parseSitemap } from './sitemap-parser';
import { AuditConfig, PageAuthStatus } from '../types/audit';
import {
  establishAuditSession,
  destroyAuditSession,
  createAuthenticatedPage,
  hasActiveSession,
} from './auth-engine';

export interface CrawlProgressCallback {
  (log: { level: 'info' | 'warn' | 'error' | 'success'; message: string; processedPages: number; totalPages: number }): Promise<void>;
}

export interface AuthExpiredError {
  type: 'AUTH_EXPIRED';
  url: string;
  message: string;
}

export class WebsiteCrawler {
  private visitedUrls: Set<string> = new Set();
  private urlQueue: { url: string; depth: number }[] = [];
  private baseDomain: string = '';
  private robots: ReturnType<typeof robotsParser> | null = null;
  private authExpiredAt: string | null = null;

  constructor(
    private config: AuditConfig,
    private onProgress?: CrawlProgressCallback
  ) {}

  public async initialize(inputMethod: string, inputs: string[]): Promise<string[]> {
    const urlsToProcess: string[] = [];

    if (inputMethod === 'urls' || inputMethod === 'csv' || inputMethod === 'txt') {
      inputs.forEach((url) => {
        const normalized = this.normalizeUrl(url);
        if (normalized && !urlsToProcess.includes(normalized)) {
          urlsToProcess.push(normalized);
        }
      });
    } else if (inputMethod === 'sitemap') {
      for (const sitemapUrl of inputs) {
        await this.log('info', `Parsing sitemap: ${sitemapUrl}`);
        const urlsFromSitemap = await parseSitemap(sitemapUrl);
        urlsFromSitemap.forEach((u) => {
          const norm = this.normalizeUrl(u);
          if (norm && !urlsToProcess.includes(norm)) {
            urlsToProcess.push(norm);
          }
        });
      }
    } else if (inputMethod === 'crawler') {
      const seedUrl = this.normalizeUrl(inputs[0]);
      if (seedUrl) {
        urlsToProcess.push(seedUrl);
        try {
          const parsed = new URL(seedUrl);
          this.baseDomain = parsed.hostname;
          if (this.config.respectRobotsTxt) {
            await this.loadRobotsTxt(parsed.origin);
          }
        } catch {
          // ignore
        }
      }
    }

    return urlsToProcess.slice(0, this.config.maxPages);
  }

  /**
   * Crawls using the public (unauthenticated) browser.
   * Existing behavior — unchanged.
   */
  public async crawlSite(
    seedUrls: string[],
    auditId: string,
    onPageCrawled: (result: PageCaptureResult, index: number) => Promise<void>
  ): Promise<number> {
    return this._crawl(seedUrls, auditId, onPageCrawled, false);
  }

  /**
   * Crawls using an authenticated browser context.
   * Requires that establishAuditSession() was called before this method.
   */
  public async crawlSiteAuthenticated(
    seedUrls: string[],
    auditId: string,
    onPageCrawled: (result: PageCaptureResult & { authStatus: PageAuthStatus }, index: number) => Promise<void>
  ): Promise<{ pagesCount: number; authExpiredAt: string | null }> {
    const loginUrl = this.config.authentication?.loginUrl ?? '';
    let pageIndex = 0;

    seedUrls.forEach((url) => {
      this.urlQueue.push({ url, depth: 0 });
    });

    while (this.urlQueue.length > 0 && pageIndex < this.config.maxPages) {
      const current = this.urlQueue.shift();
      if (!current) break;

      const { url, depth } = current;

      if (this.visitedUrls.has(url)) continue;
      this.visitedUrls.add(url);

      // Check robots.txt
      if (this.robots && !this.robots.isAllowed(url, 'AuditToolBot')) {
        await this.log('warn', `Skipped ${url} (blocked by robots.txt)`);
        continue;
      }

      // Check exclude patterns
      if (this.config.excludePatterns.some((pattern) => pattern && url.includes(pattern))) {
        await this.log('warn', `Skipped ${url} (matches exclude pattern)`);
        continue;
      }

      // Check include patterns (crawl scope)
      if (this.config.includePatterns && this.config.includePatterns.length > 0) {
        const allowed = this.config.includePatterns.some((p) => url.includes(p));
        if (!allowed) {
          await this.log('info', `Skipped ${url} (outside crawl scope)`);
          continue;
        }
      }

      await this.log('info', `[Authenticated] Crawling page ${pageIndex + 1}: ${url}`);

      try {
        // Get an authenticated page from the context
        const authPage = await createAuthenticatedPage(auditId);
        if (!authPage) {
          await this.log('error', `No authenticated session available for ${url}. Stopping.`);
          this.authExpiredAt = url;
          break;
        }

        let result: PageCaptureResult & { authStatus: PageAuthStatus };

        try {
          result = await capturePageDataAuthenticated(authPage, url, auditId, pageIndex + 1, loginUrl);
        } finally {
          // Always close the page after capture to avoid resource leaks
          try { await authPage.close(); } catch { /* ignore */ }
        }

        pageIndex++;

        // Detect auth expiry
        if (result.authStatus === 'auth_expired') {
          await this.log('warn', `Authentication session expired while crawling: ${url}`);
          this.authExpiredAt = url;
          await onPageCrawled(result, pageIndex);
          break; // Stop crawl — do not silently continue unauthenticated
        }

        if (result.authStatus === 'auth_required') {
          await this.log('warn', `Page requires authentication (403/401): ${url}`);
          await onPageCrawled(result, pageIndex);
          continue; // Skip but don't stop — may be intentionally gated
        }

        await onPageCrawled(result, pageIndex);
        await this.log('success', `✓ Authenticated | ${url} (${result.loadTimeMs}ms)`);

        // Discover internal links from real rendered frontend DOM
        if (depth < this.config.maxDepth && result.discoveredLinks.length > 0) {
          const host = new URL(url).hostname;
          for (const link of result.discoveredLinks) {
            try {
              const linkUrl = new URL(link);
              if (this.isSameDomain(linkUrl, host)) {
                const norm = this.normalizeUrl(link);
                if (norm && !this.visitedUrls.has(norm) && !this.urlQueue.some((q) => q.url === norm)) {
                  this.urlQueue.push({ url: norm, depth: depth + 1 });
                }
              }
            } catch {
              // ignore invalid URL
            }
          }
        }
      } catch (err) {
        await this.log('error', `Failed to crawl authenticated page ${url}: ${(err as Error).message}`);
      }
    }

    return { pagesCount: pageIndex, authExpiredAt: this.authExpiredAt };
  }

  private async _crawl(
    seedUrls: string[],
    auditId: string,
    onPageCrawled: (result: PageCaptureResult, index: number) => Promise<void>,
    _authenticated: boolean
  ): Promise<number> {
    seedUrls.forEach((url) => {
      this.urlQueue.push({ url, depth: 0 });
    });

    let pageIndex = 0;

    while (this.urlQueue.length > 0 && pageIndex < this.config.maxPages) {
      const current = this.urlQueue.shift();
      if (!current) break;

      const { url, depth } = current;

      if (this.visitedUrls.has(url)) continue;
      this.visitedUrls.add(url);

      // Check robots.txt
      if (this.robots && !this.robots.isAllowed(url, 'AuditToolBot')) {
        await this.log('warn', `Skipped ${url} (blocked by robots.txt)`);
        continue;
      }

      // Check exclude patterns
      if (this.config.excludePatterns.some((pattern) => pattern && url.includes(pattern))) {
        await this.log('warn', `Skipped ${url} (matches exclude pattern)`);
        continue;
      }

      // Check include patterns (crawl scope)
      if (this.config.includePatterns && this.config.includePatterns.length > 0) {
        const allowed = this.config.includePatterns.some((p) => p && url.includes(p));
        if (!allowed) {
          await this.log('info', `Skipped ${url} (outside crawl scope)`);
          continue;
        }
      }

      await this.log('info', `Crawling page ${pageIndex + 1}/${Math.min(this.config.maxPages, Math.max(seedUrls.length, this.urlQueue.length + pageIndex + 1))}: ${url}`);

      try {
        const result = await capturePageData(url, auditId, pageIndex + 1);
        pageIndex++;

        await onPageCrawled(result, pageIndex);
        await this.log('success', `Successfully analyzed ${url} (${result.loadTimeMs}ms)`);

        // If crawling mode enabled and depth allows, discover new internal links from real frontend DOM
        if (depth < this.config.maxDepth && result.discoveredLinks.length > 0) {
          const host = new URL(url).hostname;
          for (const link of result.discoveredLinks) {
            try {
              const linkUrl = new URL(link);
              if (this.isSameDomain(linkUrl, host)) {
                const norm = this.normalizeUrl(link);
                if (norm && !this.visitedUrls.has(norm) && !this.urlQueue.some((q) => q.url === norm)) {
                  this.urlQueue.push({ url: norm, depth: depth + 1 });
                }
              }
            } catch {
              // ignore invalid url
            }
          }
        }
      } catch (err) {
        await this.log('error', `Failed to crawl page ${url}: ${(err as Error).message}`);
      }
    }

    return pageIndex;
  }

  public getQueuedPagesCount(): number {
    return this.visitedUrls.size + this.urlQueue.length;
  }

  private isSameDomain(linkUrl: URL, currentHost: string): boolean {
    const clean = (h: string) => h.replace(/^www\./i, '').toLowerCase();
    const base = clean(this.baseDomain || currentHost);
    const target = clean(linkUrl.hostname);
    return target === base || target.endsWith('.' + base);
  }

  private async loadRobotsTxt(origin: string) {
    if (!this.config.respectRobotsTxt) {
      this.robots = null;
      return;
    }
    try {
      const robotsUrl = `${origin}/robots.txt`;
      const res = await fetch(robotsUrl);
      if (res.ok) {
        const txt = await res.text();
        this.robots = robotsParser(robotsUrl, txt);
      }
    } catch {
      this.robots = null;
    }
  }

  public normalizeUrl(urlStr: string): string | null {
    try {
      let trimmed = urlStr.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        trimmed = 'https://' + trimmed;
      }
      const u = new URL(trimmed);
      u.hash = ''; // Strip fragment

      // Remove marketing and tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', '_ga', 'ref', 'source', 'mc_cid', 'mc_eid'];
      trackingParams.forEach((p) => u.searchParams.delete(p));

      // Remove trailing slash for consistency (keep root '/')
      if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1);
      }

      // Ignore non-HTML static asset files
      const nonHtmlExtensions = /\.(pdf|zip|tar|gz|rar|exe|dmg|iso|docx?|xlsx?|pptx?|jpe?g|png|gif|webp|svg|ico|bmp|mp4|webm|mp3|wav|ogg|avi|mov|css|js|map|xml|json|rss|atom)($|\?)/i;
      if (nonHtmlExtensions.test(u.pathname)) {
        return null;
      }

      return u.toString();
    } catch {
      return null;
    }
  }

  private async log(level: 'info' | 'warn' | 'error' | 'success', message: string) {
    if (this.onProgress) {
      await this.onProgress({
        level,
        message,
        processedPages: this.visitedUrls.size,
        totalPages: Math.max(this.visitedUrls.size, this.urlQueue.length + this.visitedUrls.size)
      });
    }
  }
}
