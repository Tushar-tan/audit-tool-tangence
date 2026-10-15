import { PageMetricsData, AuditIssueData, ElementBox } from '../types/audit';

export function analyzeResponsive(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  // 1. Horizontal Scrolling (Consolidated across all viewports)
  const scrollFailingVps = metrics.viewportChecks.filter((vp) => vp.hasHorizontalScroll && vp.overflowAmount > 3);
  if (scrollFailingVps.length > 0) {
    const worstVp = scrollFailingVps.reduce((prev, curr) => (curr.overflowAmount > prev.overflowAmount ? curr : prev), scrollFailingVps[0]);
    const vpLabels = scrollFailingVps.map((vp) => `${vp.width}px`).join(', ');
    const maxOverflow = Math.round(worstVp.overflowAmount);
    
    score -= Math.min(25, 8 + Math.round(maxOverflow / 8));
    issues.push({
      issueId: 'RSP-001',
      pageUrl,
      category: 'responsive-design',
      severity: scrollFailingVps.some((vp) => vp.width < 768) ? 'high' : 'medium',
      status: 'FAIL',
      viewport: vpLabels,
      title: `Horizontal Scrolling on ${scrollFailingVps.length} Viewport(s) (${vpLabels})`,
      problem: `Page width exceeds screen viewport width by up to ${maxOverflow}px (scrollWidth: ${worstVp.scrollWidth}px vs clientWidth: ${worstVp.clientWidth}px) across ${scrollFailingVps.length} viewport(s): ${vpLabels}.`,
      expectedBehavior: 'Page content must fit completely within all screen viewport widths without horizontal scrolling.',
      actualBehavior: `Up to ${maxOverflow}px horizontal overflow detected on ${vpLabels}.`,
      recommendation: 'Apply max-width: 100%; box-sizing: border-box; overflow-x: hidden on root and wide section containers.',
      elementSelector: 'body, .main-container',
      elementInfo: `Failing Viewports: ${vpLabels}`,
      screenshotUrl: worstVp.screenshotPath
    });
  }

  // 2. Text Overflows Viewport (Consolidated per unique text element)
  const textOverflowMap = new Map<string, {
    selector: string;
    text: string;
    box: ElementBox;
    maxOverflowPx: number;
    viewports: string[];
    screenshotUrl?: string;
  }>();

  metrics.viewportChecks.forEach((vp) => {
    const items = vp.overflowingTextItems || [];
    items.forEach((item) => {
      const key = `${item.selector}::${item.text.slice(0, 30)}`;
      if (textOverflowMap.has(key)) {
        const existing = textOverflowMap.get(key)!;
        existing.viewports.push(`${vp.width}px`);
        if (item.overflowPx > existing.maxOverflowPx) {
          existing.maxOverflowPx = item.overflowPx;
          existing.box = item.box;
        }
        if (!existing.screenshotUrl && vp.screenshotPath) {
          existing.screenshotUrl = vp.screenshotPath;
        }
      } else {
        textOverflowMap.set(key, {
          selector: item.selector,
          text: item.text,
          box: item.box,
          maxOverflowPx: item.overflowPx,
          viewports: [`${vp.width}px`],
          screenshotUrl: vp.screenshotPath
        });
      }
    });
  });

  let textIssueIdx = 0;
  textOverflowMap.forEach((entry) => {
    textIssueIdx++;
    score -= Math.min(15, 5 + Math.round(entry.maxOverflowPx / 10));
    const vpSummary = entry.viewports.join(', ');
    issues.push({
      issueId: `RSP-002-${textIssueIdx}`,
      pageUrl,
      category: 'responsive-design',
      severity: entry.viewports.some((v) => parseInt(v, 10) < 768) ? 'high' : 'medium',
      status: 'FAIL',
      viewport: vpSummary,
      title: `Text Overflows Viewport: "${entry.text}"`,
      problem: `Text content in element '${entry.selector}' extends outside container or screen bounds by ${entry.maxOverflowPx}px on viewport(s): ${vpSummary}.`,
      expectedBehavior: 'Text should wrap cleanly within the available screen width at all viewports.',
      actualBehavior: `Text "${entry.text}" overflows container bounds by ${entry.maxOverflowPx}px on ${vpSummary}.`,
      recommendation: 'Use word-break: break-word; overflow-wrap: anywhere; and responsive typography sizing (e.g. clamp() / text-base md:text-lg).',
      elementSelector: entry.selector,
      elementText: entry.text,
      elementBox: entry.box,
      elementInfo: `Overflowing Text on ${vpSummary}`,
      screenshotUrl: entry.screenshotUrl
    });
  });

  // 3. Images Resize Correctly (Consolidated per unique image)
  const imageResizeMap = new Map<string, {
    selector: string;
    src: string;
    width: number;
    naturalWidth: number;
    box: ElementBox;
    viewports: string[];
    screenshotUrl?: string;
  }>();

  metrics.viewportChecks.forEach((vp) => {
    const items = vp.failingImageItems || [];
    items.forEach((item) => {
      const key = `${item.selector}::${item.src}`;
      if (imageResizeMap.has(key)) {
        const existing = imageResizeMap.get(key)!;
        existing.viewports.push(`${vp.width}px`);
        if (!existing.screenshotUrl && vp.screenshotPath) {
          existing.screenshotUrl = vp.screenshotPath;
        }
      } else {
        imageResizeMap.set(key, {
          selector: item.selector,
          src: item.src,
          width: item.width,
          naturalWidth: item.naturalWidth,
          box: item.box,
          viewports: [`${vp.width}px`],
          screenshotUrl: vp.screenshotPath
        });
      }
    });
  });

  let imgIssueIdx = 0;
  imageResizeMap.forEach((entry) => {
    imgIssueIdx++;
    score -= 10;
    const vpSummary = entry.viewports.join(', ');
    const filename = (() => {
      try {
        const clean = entry.src.split('?')[0].split('#')[0];
        const parts = clean.split('/').filter(Boolean);
        return parts[parts.length - 1] ? decodeURIComponent(parts[parts.length - 1]) : entry.src;
      } catch {
        return entry.src;
      }
    })();

    issues.push({
      issueId: `RSP-003-${imgIssueIdx}`,
      pageUrl,
      category: 'responsive-design',
      severity: 'medium',
      status: 'FAIL',
      viewport: vpSummary,
      title: `Image Does Not Resize Responsively: "${filename}"`,
      problem: `Image "${filename}" has a fixed display width (${entry.width}px) exceeding viewport width on: ${vpSummary}. Source URL: ${entry.src}`,
      expectedBehavior: 'Images must scale dynamically with screen width using max-width: 100%; height: auto.',
      actualBehavior: `Image "${filename}" display width (${entry.width}px) exceeds screen container bounds on ${vpSummary}. (Selector: ${entry.selector})`,
      recommendation: `Add CSS max-width: 100%; height: auto; to image element (${entry.selector}).`,
      elementSelector: entry.selector,
      elementText: filename,
      elementBox: entry.box,
      elementInfo: `Image URL: ${entry.src}`,
      screenshotUrl: entry.screenshotUrl
    });
  });

  // 4. Navigation Works on Mobile (Consolidated for mobile viewports)
  const mobileNavFailingVps = metrics.viewportChecks.filter((vp) => vp.width < 768 && !vp.navWorksOnMobile);
  if (mobileNavFailingVps.length > 0) {
    score -= 15;
    const vpLabels = mobileNavFailingVps.map((vp) => `${vp.width}px`).join(', ');
    issues.push({
      issueId: 'RSP-004',
      pageUrl,
      category: 'responsive-design',
      severity: 'high',
      status: 'FAIL',
      viewport: vpLabels,
      title: `Navigation Does Not Adapt on Mobile Screens (${vpLabels})`,
      problem: `Desktop horizontal navigation fails to collapse into a functional mobile menu drawer on mobile viewports (${vpLabels}).`,
      expectedBehavior: 'Navigation should collapse into an accessible hamburger menu drawer at screen widths <768px.',
      actualBehavior: 'Desktop navigation remains uncollapsed or overflows mobile screen.',
      recommendation: 'Implement a mobile hamburger toggle button and drawer for screen widths <768px.',
      elementSelector: 'header nav, .navigation',
      elementInfo: `Mobile Navigation (${vpLabels})`,
      screenshotUrl: mobileNavFailingVps[0]?.screenshotPath
    });
  }

  // 5. Forms Work on Mobile (Consolidated per unique form)
  const formResizeMap = new Map<string, {
    selector: string;
    width: number;
    box: ElementBox;
    viewports: string[];
    screenshotUrl?: string;
  }>();

  metrics.viewportChecks.filter((vp) => vp.width < 768).forEach((vp) => {
    const items = vp.failingFormItems || [];
    items.forEach((item) => {
      const key = item.selector;
      if (formResizeMap.has(key)) {
        const existing = formResizeMap.get(key)!;
        existing.viewports.push(`${vp.width}px`);
        if (!existing.screenshotUrl && vp.screenshotPath) {
          existing.screenshotUrl = vp.screenshotPath;
        }
      } else {
        formResizeMap.set(key, {
          selector: item.selector,
          width: item.width,
          box: item.box,
          viewports: [`${vp.width}px`],
          screenshotUrl: vp.screenshotPath
        });
      }
    });
  });

  let formIssueIdx = 0;
  formResizeMap.forEach((entry) => {
    formIssueIdx++;
    score -= 15;
    const vpSummary = entry.viewports.join(', ');
    issues.push({
      issueId: `RSP-005-${formIssueIdx}`,
      pageUrl,
      category: 'responsive-design',
      severity: 'high',
      status: 'FAIL',
      viewport: vpSummary,
      title: `Form Layout Breaks on Mobile Screens: "${entry.selector}"`,
      problem: `Form inputs in '${entry.selector}' have fixed widths that overflow mobile viewports (${vpSummary}).`,
      expectedBehavior: 'Form fields should stack vertically with 100% width on mobile screens.',
      actualBehavior: `Form input width (${entry.width}px) extends past mobile viewport boundaries on ${vpSummary}.`,
      recommendation: 'Set form input widths to 100% and stack form rows into a single column on mobile viewports.',
      elementSelector: entry.selector,
      elementBox: entry.box,
      elementInfo: `Form: ${entry.selector}`,
      screenshotUrl: entry.screenshotUrl
    });
  });

  return {
    score: Math.max(0, score),
    issues
  };
}
