import { PageMetricsData, AuditIssueData } from '../types/audit';

export function analyzeTechnicalSeo(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  // 1. XML sitemap exists
  if (!metrics.hasSitemapXml) {
    score -= 15;
    issues.push({
      issueId: 'TSEO-001',
      pageUrl,
      category: 'technical-seo',
      severity: 'medium',
      status: 'FAIL',
      title: 'Missing XML Sitemap (/sitemap.xml)',
      problem: 'Could not detect an active XML sitemap at /sitemap.xml on the domain.',
      expectedBehavior: 'A valid XML sitemap should be accessible at /sitemap.xml and linked in robots.txt.',
      actualBehavior: 'HTTP request to /sitemap.xml failed or returned non-200 status.',
      recommendation: 'Generate a dynamic sitemap.xml listing all canonical pages and link it in robots.txt.',
      elementSelector: 'sitemap.xml',
      elementInfo: 'XML Sitemap'
    });
  }

  // 2. Robots.txt exists
  if (!metrics.hasRobotsTxt) {
    score -= 15;
    issues.push({
      issueId: 'TSEO-002',
      pageUrl,
      category: 'technical-seo',
      severity: 'medium',
      status: 'FAIL',
      title: 'Missing robots.txt File',
      problem: 'No robots.txt file was detected at /robots.txt.',
      expectedBehavior: 'A robots.txt file should exist at the site root to guide search engine crawlers.',
      actualBehavior: 'Request to /robots.txt failed or returned 404.',
      recommendation: 'Create a robots.txt file specifying crawler permissions and referencing the sitemap.',
      elementSelector: 'robots.txt',
      elementInfo: 'Robots.txt Directive'
    });
  }

  // 3. HTTPS is enabled
  if (!metrics.isHttps) {
    score -= 25;
    issues.push({
      issueId: 'TSEO-003',
      pageUrl,
      category: 'technical-seo',
      severity: 'critical',
      status: 'FAIL',
      title: 'HTTPS Protocol Is Not Enabled on Page',
      problem: 'The page is served over unencrypted plain HTTP (http://).',
      expectedBehavior: 'All pages must be served securely over HTTPS (https://).',
      actualBehavior: `Page URL uses insecure scheme: ${pageUrl}.`,
      recommendation: 'Install an SSL/TLS certificate and migrate all site routes to HTTPS.',
      elementSelector: 'protocol',
      elementInfo: 'HTTP Protocol Scheme'
    });
  }

  // 4. HTTP redirects to HTTPS
  if (!metrics.httpRedirectsToHttps) {
    score -= 15;
    issues.push({
      issueId: 'TSEO-004',
      pageUrl,
      category: 'technical-seo',
      severity: 'high',
      status: 'FAIL',
      title: 'Insecure HTTP Does Not Redirect to HTTPS',
      problem: 'Requesting the HTTP version of the website does not automatically redirect to HTTPS.',
      expectedBehavior: 'All HTTP traffic should automatically 301 redirect to HTTPS.',
      actualBehavior: 'HTTP request did not return a redirect to HTTPS.',
      recommendation: 'Configure server-level 301 redirection from HTTP (port 80) to HTTPS (port 443).',
      elementSelector: 'server redirect',
      elementInfo: 'HTTP to HTTPS Redirection'
    });
  }

  // 5. 301 redirects work
  if (!metrics.redirects301Work) {
    score -= 10;
    issues.push({
      issueId: 'TSEO-005',
      pageUrl,
      category: 'technical-seo',
      severity: 'medium',
      status: 'FAIL',
      title: 'Improper Redirection Status Codes (Missing 301 Permanent Redirect)',
      problem: 'Redirects on the domain use temporary 302/307 redirects or fail to pass link equity.',
      expectedBehavior: 'Permanent URL changes and HTTP redirects must use HTTP 301 Moved Permanently.',
      actualBehavior: 'Temporary or incomplete redirect chain detected.',
      recommendation: 'Configure 301 permanent redirects in web server (Nginx/Apache/Cloudflare/Vercel) config.',
      elementSelector: 'redirects',
      elementInfo: '301 Permanent Redirects'
    });
  }

  // 6. No 404 pages
  if (metrics.is404Page || metrics.httpStatus === 404) {
    score -= 30;
    issues.push({
      issueId: 'TSEO-006',
      pageUrl,
      category: 'technical-seo',
      severity: 'critical',
      status: 'FAIL',
      title: 'Page Returns HTTP 404 Not Found Status',
      problem: 'The requested URL returned HTTP 404 Not Found error status.',
      expectedBehavior: 'Target URL should resolve with HTTP 200 OK.',
      actualBehavior: `HTTP 404 status received for ${pageUrl}.`,
      recommendation: 'Check URL routing or configure a 301 redirect to the active page.',
      elementSelector: 'body',
      elementInfo: 'HTTP 404 Not Found State'
    });
  }

  // 7. Structured data is implemented
  if (!metrics.hasStructuredData) {
    score -= 15;
    issues.push({
      issueId: 'TSEO-007',
      pageUrl,
      category: 'technical-seo',
      severity: 'medium',
      status: 'FAIL',
      title: 'Missing Structured Data (Schema.org / JSON-LD)',
      problem: 'No JSON-LD (<script type="application/ld+json">) or Schema.org microdata markup found on page.',
      expectedBehavior: 'Pages should include structured data (e.g. WebSite, Organization, Article, Product, BreadcrumbList) for rich search snippets.',
      actualBehavior: 'Zero structured data schemas detected in document.',
      recommendation: 'Implement Schema.org JSON-LD structured data in the HTML head.',
      elementSelector: 'head script[type="application/ld+json"]',
      elementInfo: 'JSON-LD Structured Data'
    });
  }

  // 8. llms.txt considered/implemented
  if (!metrics.hasLlmsTxt) {
    score -= 5;
    issues.push({
      issueId: 'TSEO-008',
      pageUrl,
      category: 'technical-seo',
      severity: 'low',
      status: 'FAIL',
      title: 'llms.txt File Not Implemented (/llms.txt)',
      problem: 'No /llms.txt file was found at the site root to guide LLM agents and AI search engines.',
      expectedBehavior: 'Publish an /llms.txt file at the root to provide structured context for AI search crawlers (Perplexity, ChatGPT, Claude).',
      actualBehavior: 'Request to /llms.txt returned 404.',
      recommendation: 'Create a markdown /llms.txt file summarizing website capabilities, documentation, and key links for AI agents.',
      elementSelector: 'llms.txt',
      elementInfo: 'AI Crawler Context (/llms.txt)'
    });
  }

  return {
    score: Math.max(0, score),
    issues
  };
}
