import { PageMetricsData, AuditIssueData } from '../types/audit';

export function analyzeLinks(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  metrics.links.forEach((link, idx) => {
    // 1 & 2 & 3. Internal, External, and 404 / Broken links
    if (link.isBroken || link.linkType === 'broken' || link.linkType === 'empty') {
      score -= 10;
      issues.push({
        issueId: `LNK-001-${idx}`,
        pageUrl,
        category: 'links',
        severity: 'high',
        status: 'FAIL',
        title: `Broken or Empty Link Destination: "${link.text}"`,
        problem: `Link with text '${link.text}' has an empty or invalid href ('${link.href || 'empty'}').`,
        expectedBehavior: 'All internal and external links must have valid, working destination URLs.',
        actualBehavior: `Anchor tag contains href="${link.href || ''}" resulting in a dead link.`,
        recommendation: 'Provide a valid destination URL or convert to a semantic button if triggering an action.',
        elementSelector: link.selector,
        elementText: link.text,
        elementInfo: `Link [${link.linkType}] -> ${link.href || 'empty'}`
      });
    }

    if (link.is404) {
      score -= 15;
      issues.push({
        issueId: `LNK-002-${idx}`,
        pageUrl,
        category: 'links',
        severity: 'high',
        status: 'FAIL',
        title: `Link Returns HTTP 404 Not Found: "${link.text}"`,
        problem: `Link pointing to '${link.href}' returned a 404 Not Found HTTP status.`,
        expectedBehavior: 'All internal and external link destinations must resolve with HTTP 200 OK.',
        actualBehavior: `Destination URL ${link.href} returned 404.`,
        recommendation: 'Update broken link target URL or set up a 301 redirect.',
        elementSelector: link.selector,
        elementText: link.text,
        elementInfo: `404 Link -> ${link.href}`
      });
    }

    // 4. Telephone links work
    if (link.isTel && !link.telWorks) {
      score -= 10;
      issues.push({
        issueId: `LNK-003-${idx}`,
        pageUrl,
        category: 'links',
        severity: 'medium',
        status: 'FAIL',
        viewport: '390px × 844px',
        title: `Improperly Formatted Telephone Link: "${link.text}"`,
        problem: `Phone link '${link.text}' has invalid syntax ('${link.href}') that fails to trigger mobile phone dialer.`,
        expectedBehavior: 'Phone links should use standard tel:+1234567890 format with valid dial digits.',
        actualBehavior: `Invalid tel link syntax: ${link.href}.`,
        recommendation: 'Format phone href as href="tel:+1XXXXXXXXXX" (digits and international code only).',
        elementSelector: link.selector,
        elementText: link.text,
        elementInfo: `Telephone Link -> ${link.href}`
      });
    }

    // 5. Email links work
    if (link.isMailto && !link.emailWorks) {
      score -= 10;
      issues.push({
        issueId: `LNK-004-${idx}`,
        pageUrl,
        category: 'links',
        severity: 'medium',
        status: 'FAIL',
        title: `Improperly Formatted Email Link: "${link.text}"`,
        problem: `Email link '${link.text}' (${link.href}) lacks a valid email address for the mailto protocol.`,
        expectedBehavior: 'Email links should have valid format href="mailto:name@example.com".',
        actualBehavior: `Malformed mailto href attribute: ${link.href}.`,
        recommendation: 'Verify email address format in the mailto link.',
        elementSelector: link.selector,
        elementText: link.text,
        elementInfo: `Email Link -> ${link.href}`
      });
    }

    // 6. Social media links work and should open on new tab
    if (link.isSocial && !link.opensInNewTab) {
      score -= 5;
      issues.push({
        issueId: `LNK-005-${idx}`,
        pageUrl,
        category: 'links',
        severity: 'low',
        status: 'FAIL',
        title: `Social Media Link (${link.socialPlatform || 'Social'}) Does Not Open in New Tab`,
        problem: `Social media link pointing to '${link.href}' opens in the same browser tab, directing users away from the website.`,
        expectedBehavior: 'Social media links should open in a new tab with target="_blank" rel="noopener noreferrer".',
        actualBehavior: 'Social link lacks target="_blank" attribute.',
        recommendation: 'Add target="_blank" rel="noopener noreferrer" to the social media anchor tag.',
        elementSelector: link.selector,
        elementText: link.text,
        elementInfo: `Social Link -> ${link.href}`
      });
    }
  });

  return {
    score: Math.max(0, score),
    issues
  };
}
