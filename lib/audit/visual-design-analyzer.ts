import { PageMetricsData, AuditIssueData } from '../types/audit';

export function analyzeVisualDesign(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  // 1. All menu items have correct URLs
  if (!metrics.menuItemUrlsValid && metrics.invalidMenuUrls.length > 0) {
    score -= Math.min(20, metrics.invalidMenuUrls.length * 5);
    issues.push({
      issueId: 'VIS-001',
      pageUrl,
      category: 'visual-design',
      severity: 'high',
      status: 'FAIL',
      title: `Menu Items Contain Missing or Invalid URLs (${metrics.invalidMenuUrls.length} Found)`,
      problem: `Menu links lack valid destination URLs (found "${metrics.invalidMenuUrls.map((m) => `${m.text} -> ${m.href}`).slice(0, 3).join(', ')}").`,
      expectedBehavior: 'All menu items must point to well-formed, working destination paths.',
      actualBehavior: `Identified ${metrics.invalidMenuUrls.length} menu link(s) with empty or placeholder URLs.`,
      recommendation: 'Update menu links with proper routes (e.g. /services, /about, /contact).',
      elementSelector: metrics.invalidMenuUrls[0]?.selector || 'header nav a',
      elementText: metrics.invalidMenuUrls[0]?.text,
      elementInfo: 'Navigation Menu Item'
    });
  }

  // 2. Fonts are consistent
  if (!metrics.fontsConsistent && metrics.fontFamilies.length > 3) {
    score -= 10;
    issues.push({
      issueId: 'VIS-002',
      pageUrl,
      category: 'visual-design',
      severity: 'low',
      status: 'FAIL',
      title: `Inconsistent Font Families Used on Page (${metrics.fontFamilies.length} Detected)`,
      problem: `Detected ${metrics.fontFamilies.length} different font families (${metrics.fontFamilies.slice(0, 5).join(', ')}), disrupting typography cohesion.`,
      expectedBehavior: 'Websites should use at most 2-3 harmonious font families (e.g. one primary font for headings and one for body copy).',
      actualBehavior: `Multiple mismatched font families (${metrics.fontFamilies.slice(0, 4).join(', ')}) rendered on the same page.`,
      recommendation: 'Standardize typography tokens to 1-2 core brand font families in your global CSS design system.',
      elementSelector: 'body',
      elementInfo: 'Typography Font Families'
    });
  }

  // 3. Font weights are consistent
  if (!metrics.fontWeightsConsistent && metrics.fontWeights.length > 5) {
    score -= 10;
    issues.push({
      issueId: 'VIS-003',
      pageUrl,
      category: 'visual-design',
      severity: 'low',
      status: 'FAIL',
      title: `Inconsistent Font Weights Used across Typography`,
      problem: `Found ${metrics.fontWeights.length} differing font weights (${metrics.fontWeights.slice(0, 6).join(', ')}), creating an erratic visual hierarchy.`,
      expectedBehavior: 'Maintain a disciplined scale of 2-3 standard weights (e.g. Regular 400, Medium 500, Bold 700).',
      actualBehavior: `Too many arbitrary font weights rendered across page elements.`,
      recommendation: 'Standardize typography font-weight values across body copy and headings.',
      elementSelector: 'body, p, h1, h2, h3',
      elementInfo: 'Typography Font Weights'
    });
  }

  // 4. Font sizes are consistent
  if (!metrics.fontSizesConsistent) {
    score -= 10;
    issues.push({
      issueId: 'VIS-004',
      pageUrl,
      category: 'visual-design',
      severity: 'low',
      status: 'FAIL',
      title: 'Inconsistent Typography Font Size Scale',
      problem: 'Page elements use arbitrary or non-standard font sizes that deviate from a unified typography scale.',
      expectedBehavior: 'Font sizes should follow a structured modular scale (e.g. 12px, 14px, 16px, 20px, 24px, 32px, 48px).',
      actualBehavior: 'Disjointed font size values detected across text elements.',
      recommendation: 'Apply a standard typography scale in your CSS design system tokens.',
      elementSelector: 'body, p, span',
      elementInfo: 'Typography Size Scale'
    });
  }

  // 5. Line heights of the texts are appropriate (not much excessive not much less)
  if (metrics.lineHeightsOutOfRangeCount > 4) {
    score -= 10;
    issues.push({
      issueId: 'VIS-005',
      pageUrl,
      category: 'visual-design',
      severity: 'medium',
      status: 'FAIL',
      title: 'Inappropriate Text Line Heights (Too Cramped or Too Excessive)',
      problem: `Found ${metrics.lineHeightsOutOfRangeCount} text elements with line heights outside comfortable reading range (<1.1 or >2.2 ratio).`,
      expectedBehavior: 'Text should feature comfortable line-heights (1.4 - 1.7 for body text, 1.1 - 1.3 for headings) for legibility.',
      actualBehavior: 'Line-height values are either cramped or excessively spaced.',
      recommendation: 'Set line-height: 1.5 to 1.6 on body text and line-height: 1.2 to 1.3 on headings.',
      elementSelector: 'p, h2, h3',
      elementInfo: 'Typography Line Height'
    });
  }

  // 6. No overlapping elements
  if (metrics.overlappingElementsCount > 0) {
    score -= Math.min(25, metrics.overlappingElementsCount * 12);
    const firstOverlap = metrics.overlappingElementsList[0];
    issues.push({
      issueId: 'VIS-006',
      pageUrl,
      category: 'visual-design',
      severity: 'high',
      status: 'FAIL',
      title: 'Overlapping Layout Elements Detected on Page',
      problem: `Detected ${metrics.overlappingElementsCount} occurrence(s) where visual elements unintentionally collide or overlap.`,
      expectedBehavior: 'All UI components and text elements should maintain clean separation without collision.',
      actualBehavior: firstOverlap
        ? `Element '${firstOverlap.selector}' overlaps with '${firstOverlap.overlapsWith}'.`
        : 'Multiple DOM elements overlap in page layout.',
      recommendation: 'Adjust CSS margins, flex/grid alignment, or clear fixed heights to prevent element collisions.',
      elementSelector: firstOverlap?.selector || '.container',
      elementText: firstOverlap?.text,
      elementBox: firstOverlap?.box,
      elementInfo: 'Overlapping UI Component'
    });
  }

  // 7. Layout of the page should not be broken
  if (metrics.hasBrokenLayout || metrics.desktopHasHorizontalScroll) {
    score -= 20;
    issues.push({
      issueId: 'VIS-007',
      pageUrl,
      category: 'visual-design',
      severity: 'high',
      status: 'FAIL',
      title: 'Broken Page Layout / Content Exceeds Container',
      problem: 'Page layout container boundaries are broken, causing uncontained horizontal width or layout distortion.',
      expectedBehavior: 'Page layout must remain cleanly contained within standard desktop viewport boundaries without breaking.',
      actualBehavior: metrics.brokenLayoutDetails[0] || 'Content width exceeds document viewport width.',
      recommendation: 'Ensure all containers have max-width: 100%; box-sizing: border-box; and clear fixed-width child elements.',
      elementSelector: 'body, .main-container',
      elementInfo: 'Page Layout Wrapper'
    });
  }

  return {
    score: Math.max(0, score),
    issues
  };
}
