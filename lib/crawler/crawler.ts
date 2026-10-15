import robotsParser from 'robots-parser';
import { capturePageData, PageCaptureResult } from './browser-session';
import { parseSitemap } from './sitemap-parser';
import { AuditConfig } from '../types/audit';

export interface CrawlProgressCallback {
  (log: { level: 'info' | 'warn' | 'error' | 'success'; message: string; processedPages: number; totalPages: number }): Promise<void>;
}

export class WebsiteCrawler {
  private visitedUrls: Set<string> = new Set();
  private urlQueue: { url: string; depth: number }[] = [];
  private baseDomain: string = '';
  private robots: ReturnType<typeof robotsParser> | null = null;

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

  public async crawlSite(
    seedUrls: string[],
    auditId: string,
    onPageCrawled: (result: PageCaptureResult, index: number) => Promise<void>
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

      await this.log('info', `Crawling page ${pageIndex + 1}/${Math.min(this.config.maxPages, seedUrls.length || this.config.maxPages)}: ${url}`);

      try {
        const result = await capturePageData(url, auditId, pageIndex + 1);
        pageIndex++;

        await onPageCrawled(result, pageIndex);
        await this.log('success', `Successfully analyzed ${url} (${result.loadTimeMs}ms)`);

        // If crawling mode enabled and depth allows, discover new internal links
        if (depth < this.config.maxDepth && result.discoveredLinks.length > 0) {
          const host = new URL(url).hostname;
          for (const link of result.discoveredLinks) {
            try {
              const linkUrl = new URL(link);
              if (linkUrl.hostname === host) {
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

  private async loadRobotsTxt(origin: string) {
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

  private normalizeUrl(urlStr: string): string | null {
    try {
      let trimmed = urlStr.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        trimmed = 'https://' + trimmed;
      }
      const u = new URL(trimmed);
      u.hash = ''; // Strip fragment
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
