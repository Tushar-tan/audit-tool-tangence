import { PageMetricsData, AuditIssueData } from '../types/audit';

export function analyzeHeaderNav(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  // 1. Logo links to homepage
  if (metrics.hasLogo && !metrics.logoLinksToHome) {
    score -= 15;
    issues.push({
      issueId: 'NAV-001',
      pageUrl,
      category: 'header-navigation',
      severity: 'medium',
      status: 'FAIL',
      title: 'Logo Does Not Link to Homepage',
      problem: 'The header logo element does not link to the homepage (/ or site root).',
      expectedBehavior: 'Clicking the header logo should navigate the user directly to the homepage.',
      actualBehavior: `Logo element destination is '${metrics.logoHrefs.join(', ') || 'empty'}'.`,
      recommendation: 'Wrap the header logo in an <a href="/"> anchor tag pointing to the homepage.',
      elementSelector: 'header img, header .logo, header svg',
      elementInfo: 'Header Brand Logo'
    });
  }

  // 2. Navigation links work correctly, no #links should be there
  const hashNavLinks = metrics.navLinks.filter((l) => l.isHashLink || l.isBroken);
  if (hashNavLinks.length > 0) {
    score -= Math.min(20, hashNavLinks.length * 5);
    issues.push({
      issueId: 'NAV-002',
      pageUrl,
      category: 'header-navigation',
      severity: 'high',
      status: 'FAIL',
      title: `Placeholder / '#' Links Found in Navigation (${hashNavLinks.length} Found)`,
      problem: `Navigation contains placeholder href="#" or unconfigured empty destination links: ${hashNavLinks.map((l) => `"${l.text}" (${l.href})`).slice(0, 3).join(', ')}.`,
      expectedBehavior: 'All navigation menu links must point to valid, functioning target page URLs without placeholder "#" destinations.',
      actualBehavior: `Detected ${hashNavLinks.length} placeholder navigation item(s).`,
      recommendation: 'Assign valid destination URLs to all navigation menu items.',
      elementSelector: hashNavLinks[0]?.selector || 'header nav a',
      elementText: hashNavLinks[0]?.text,
      elementInfo: 'Navigation Menu Links'
    });
  }

  // 3. Dropdown menus work correctly
  if (metrics.dropdownMenusCount > 0 && !metrics.dropdownsWork) {
    score -= 15;
    issues.push({
      issueId: 'NAV-003',
      pageUrl,
      category: 'header-navigation',
      severity: 'high',
      status: 'FAIL',
      title: 'Dropdown Navigation Menu Does Not Open / Function',
      problem: 'Dropdown menu triggers fail to display sub-navigation items upon interaction.',
      expectedBehavior: 'Interacting with dropdown parent elements should reliably reveal nested menu links.',
      actualBehavior: 'Dropdown submenu items did not become visible or accessible.',
      recommendation: 'Ensure hover/focus/click event handlers properly toggle dropdown visibility and aria-expanded state.',
      elementSelector: 'header .dropdown, header [aria-haspopup="true"]',
      elementInfo: 'Navigation Dropdown Trigger'
    });
  }

  // 4. Dropdowns are not cut off
  if (metrics.dropdownCutOff) {
    score -= 15;
    issues.push({
      issueId: 'NAV-004',
      pageUrl,
      category: 'header-navigation',
      severity: 'high',
      status: 'FAIL',
      title: 'Navigation Dropdown Menu Is Cut Off by Screen Edge',
      problem: 'The navigation dropdown menu extends outside the visible viewport or is clipped by parent overflow boundaries.',
      expectedBehavior: 'Dropdown menus must remain fully visible within viewport boundaries.',
      actualBehavior: 'Dropdown sub-menu extends beyond the screen edge.',
      recommendation: 'Adjust dropdown positioning coordinates or dynamic alignment (e.g. right: 0 or left: auto) to prevent clipping.',
      elementSelector: 'header .dropdown-menu, header [aria-haspopup="true"] ul',
      elementInfo: 'Dropdown Navigation Menu'
    });
  }

  // 5. Navigation has consistent spacing
  if (!metrics.navSpacingConsistent && metrics.navLinks.length > 2) {
    score -= 10;
    issues.push({
      issueId: 'NAV-005',
      pageUrl,
      category: 'header-navigation',
      severity: 'low',
      status: 'FAIL',
      title: 'Inconsistent Spacing in Navigation Menu Items',
      problem: 'Spacing between top header navigation links varies unevenly across menu items.',
      expectedBehavior: 'Navigation items should maintain consistent spacing (e.g. equal gap or padding intervals).',
      actualBehavior: 'Uneven horizontal gap/padding intervals detected across top navigation links.',
      recommendation: 'Use a consistent CSS gap or flex distribution (e.g. gap: 1.5rem) on the navigation container.',
      elementSelector: 'header nav, nav ul',
      elementInfo: 'Navigation Menu Container'
    });
  }

  // 6. Header CTA works
  if (metrics.headerCtaSelector && !metrics.headerCtaWorks) {
    score -= 15;
    issues.push({
      issueId: 'NAV-006',
      pageUrl,
      category: 'header-navigation',
      severity: 'high',
      status: 'FAIL',
      title: 'Header Call-to-Action (CTA) Not Functional',
      problem: `Header CTA '${metrics.headerCtaText || 'CTA'}' has missing href or non-functional click destination.`,
      expectedBehavior: 'Header CTA button should navigate to the intended conversion destination URL or trigger action.',
      actualBehavior: 'CTA button contains empty href or placeholder target.',
      recommendation: 'Assign a valid destination URL or working action handler to the header CTA.',
      elementSelector: metrics.headerCtaSelector,
      elementText: metrics.headerCtaText,
      elementInfo: 'Header Call-to-Action Button'
    });
  }

  // 7. Mobile menu opens correctly
  if (metrics.hasMobileMenu && !metrics.mobileMenuOpens) {
    score -= 20;
    issues.push({
      issueId: 'NAV-007',
      pageUrl,
      category: 'header-navigation',
      severity: 'critical',
      status: 'FAIL',
      viewport: '390px × 844px',
      title: 'Mobile Navigation Menu Does Not Open',
      problem: 'Triggering the mobile hamburger menu button failed to open the navigation drawer.',
      expectedBehavior: 'Tapping the mobile menu toggle button should open the navigation drawer.',
      actualBehavior: 'Mobile menu drawer remained hidden or unresponsive.',
      recommendation: 'Verify mobile menu toggle JavaScript click handlers and ensure no z-index conflicts block overlay visibility.',
      elementSelector: 'button.hamburger, button[aria-label*="menu"]',
      elementInfo: 'Mobile Menu Hamburger Button'
    });
  }

  // 8. Mobile menu closes correctly
  if (metrics.hasMobileMenu && !metrics.mobileMenuCloses) {
    score -= 10;
    issues.push({
      issueId: 'NAV-008',
      pageUrl,
      category: 'header-navigation',
      severity: 'medium',
      status: 'FAIL',
      viewport: '390px × 844px',
      title: 'Mobile Navigation Menu Cannot Be Closed',
      problem: 'Once opened, the mobile navigation drawer cannot be dismissed or closed.',
      expectedBehavior: 'Users must be able to dismiss the mobile menu overlay via a close button or backdrop tap.',
      actualBehavior: 'Close button missing or unresponsive.',
      recommendation: 'Provide an accessible close button and close-on-backdrop-click interaction.',
      elementSelector: '.mobile-menu-close, .mobile-nav-close',
      elementInfo: 'Mobile Menu Close Trigger'
    });
  }

  // 9. No navigation overflow on mobile
  if (metrics.mobileNavOverflow) {
    score -= 15;
    issues.push({
      issueId: 'NAV-009',
      pageUrl,
      category: 'header-navigation',
      severity: 'high',
      status: 'FAIL',
      viewport: '390px × 844px',
      title: 'Navigation Overflows Container on Mobile',
      problem: 'Header navigation items exceed available viewport width, causing off-screen overflow.',
      expectedBehavior: 'Navigation items should fit cleanly within the header or collapse into a mobile drawer.',
      actualBehavior: 'Navigation container overflows mobile viewport width.',
      recommendation: 'Collapse top menu into a mobile hamburger navigation drawer at mobile screen widths.',
      elementSelector: 'header, header nav',
      elementInfo: 'Header Container'
    });
  }

  return {
    score: Math.max(0, score),
    issues
  };
}
