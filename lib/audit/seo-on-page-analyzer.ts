import { PageMetricsData, AuditIssueData } from '../types/audit';

export function analyzeSeoOnPage(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;
  const meta = metrics.metaTags;

  // 1. Page has unique title tag
  if (!meta.title || meta.title.trim() === '') {
    score -= 20;
    issues.push({
      issueId: 'SEO-001',
      pageUrl,
      category: 'seo-on-page',
      severity: 'critical',
      status: 'FAIL',
      title: 'Missing Document <title> Tag',
      problem: 'The document lacks a <title> tag in the HTML head.',
      expectedBehavior: 'Every page must declare a unique, descriptive title tag (50-60 characters) representing the page.',
      actualBehavior: '<title> tag is missing or empty.',
      recommendation: 'Add a descriptive <title> tag inside the <head> element.',
      elementSelector: 'head title',
      elementInfo: 'HTML <title> Tag'
    });
  }

  // 2. Meta description exists
  if (!meta.description || meta.description.trim() === '') {
    score -= 15;
    issues.push({
      issueId: 'SEO-002',
      pageUrl,
      category: 'seo-on-page',
      severity: 'high',
      status: 'FAIL',
      title: 'Missing Meta Description Tag',
      problem: 'No <meta name="description"> tag was found in the page header.',
      expectedBehavior: 'Include a helpful meta description tag (140-160 characters) summarizing page purpose.',
      actualBehavior: 'meta[name="description"] tag is absent.',
      recommendation: 'Add a <meta name="description" content="..."> tag to the document head.',
      elementSelector: 'head meta[name="description"]',
      elementInfo: 'Meta Description Tag'
    });
  }

  // 3. Only One clear H1 per page
  if (metrics.h1Count === 0) {
    score -= 20;
    issues.push({
      issueId: 'SEO-003',
      pageUrl,
      category: 'seo-on-page',
      severity: 'high',
      status: 'FAIL',
      title: 'Missing Primary <h1> Heading Tag',
      problem: 'The page lacks a main top-level <h1> heading to establish the page topic.',
      expectedBehavior: 'Each page should feature exactly one descriptive <h1> tag summarizing the main page topic.',
      actualBehavior: '0 <h1> heading tags detected in the document structure.',
      recommendation: 'Add a clear <h1> headline at the top of the main hero section.',
      elementSelector: 'main, body, section:first-of-type',
      elementInfo: 'Document Heading Structure'
    });
  } else if (metrics.h1Count > 1) {
    score -= 10;
    issues.push({
      issueId: 'SEO-004',
      pageUrl,
      category: 'seo-on-page',
      severity: 'medium',
      status: 'FAIL',
      title: `Multiple <h1> Headings Detected (${metrics.h1Count} Found)`,
      problem: `Found ${metrics.h1Count} separate <h1> tags (${metrics.h1List.slice(0, 3).map((h) => `"${h}"`).join(', ')}). Search best practices require a single clear <h1> per page.`,
      expectedBehavior: 'Maintain a single primary <h1> for the page title and demote secondary section headings to <h2>.',
      actualBehavior: `${metrics.h1Count} <h1> elements exist on page.`,
      recommendation: 'Keep one main <h1> and convert secondary section headings to <h2>.',
      elementSelector: 'h1',
      elementInfo: 'Multiple <h1> Headings'
    });
  }

  // 4. Images have alt text
  if (metrics.imagesMissingAltCount > 0) {
    score -= Math.min(15, metrics.imagesMissingAltCount * 5);
    issues.push({
      issueId: 'SEO-005',
      pageUrl,
      category: 'seo-on-page',
      severity: 'medium',
      status: 'FAIL',
      title: `Images Missing Alt Text for SEO & Accessibility (${metrics.imagesMissingAltCount} Found)`,
      problem: `Found ${metrics.imagesMissingAltCount} image(s) lacking descriptive alt attributes.`,
      expectedBehavior: 'All meaningful images must have alt text to support search engine crawlers and screen readers.',
      actualBehavior: `${metrics.imagesMissingAltCount} image tags lack alt attribute.`,
      recommendation: 'Add descriptive alt="keyword-rich description" attributes to all informative images.',
      elementSelector: 'img:not([alt])',
      elementInfo: 'Image Alt Tags'
    });
  }

  // 5. Canonical tags are correct
  if (!meta.canonical) {
    score -= 10;
    issues.push({
      issueId: 'SEO-006',
      pageUrl,
      category: 'seo-on-page',
      severity: 'low',
      status: 'FAIL',
      title: 'Missing Canonical Tag (<link rel="canonical">)',
      problem: 'No self-referential canonical URL tag is declared.',
      expectedBehavior: 'Pages should include <link rel="canonical" href="..."> to prevent duplicate URL indexation issues.',
      actualBehavior: 'link[rel="canonical"] is missing in document head.',
      recommendation: 'Add a canonical link tag in <head> pointing to the authoritative URL.',
      elementSelector: 'head link[rel="canonical"]',
      elementInfo: 'Canonical Link Tag'
    });
  }

  // 6. Open Graph tags exist
  if (!metrics.hasOpenGraphTags || !meta.ogTitle || !meta.ogImage) {
    score -= 10;
    issues.push({
      issueId: 'SEO-007',
      pageUrl,
      category: 'seo-on-page',
      severity: 'medium',
      status: 'FAIL',
      title: 'Missing Open Graph Meta Tags (og:title, og:image, og:description)',
      problem: 'The page lacks Open Graph tags needed to render social previews when shared on messaging & social platforms.',
      expectedBehavior: 'Declare <meta property="og:title"> and <meta property="og:image"> for rich social previews.',
      actualBehavior: `og:title: ${meta.ogTitle ? 'present' : 'missing'}, og:image: ${meta.ogImage ? 'present' : 'missing'}.`,
      recommendation: 'Include og:title, og:description, and og:image tags in <head>.',
      elementSelector: 'head meta[property^="og:"]',
      elementInfo: 'Open Graph Social Metadata'
    });
  }

  // 7. Twitter/X card tags exist
  if (!metrics.hasTwitterCardTags || !meta.twitterCard) {
    score -= 10;
    issues.push({
      issueId: 'SEO-008',
      pageUrl,
      category: 'seo-on-page',
      severity: 'low',
      status: 'FAIL',
      title: 'Missing Twitter/X Card Meta Tags',
      problem: 'Page lacks twitter:card, twitter:title, or twitter:image metadata tags.',
      expectedBehavior: 'Include <meta name="twitter:card" content="summary_large_image"> for rich Twitter/X card previews.',
      actualBehavior: 'Twitter card meta tags are missing.',
      recommendation: 'Add twitter:card, twitter:title, and twitter:image tags to the document head.',
      elementSelector: 'head meta[name^="twitter:"]',
      elementInfo: 'Twitter/X Card Metadata'
    });
  }

  return {
    score: Math.max(0, score),
    issues
  };
}
