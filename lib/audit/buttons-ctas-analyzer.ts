import { PageMetricsData, AuditIssueData } from '../types/audit';

export function analyzeButtonsCtas(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  metrics.buttons.forEach((btn, idx) => {
    const isUnnamed = !btn.text || btn.text.trim() === '' || btn.text.startsWith('Button #') || btn.text.toLowerCase() === 'button';
    const displayName = isUnnamed ? (btn.selector || `Button #${idx + 1}`) : btn.text.trim();

    // 1. Buttons are clickable
    if (!btn.isClickable) {
      score -= 10;
      issues.push({
        issueId: `BTN-001-${idx}`,
        pageUrl,
        category: 'buttons-ctas',
        severity: 'high',
        status: 'FAIL',
        title: `Unclickable / Blocked Button: "${displayName}"`,
        problem: `Button '${displayName}' (${btn.selector}) has pointer-events: none, disabled state without clear reason, or is blocked from click interaction.`,
        expectedBehavior: 'Interactive buttons must be clearly clickable and respond to user clicks/taps.',
        actualBehavior: `Button element (${btn.selector}) cannot be clicked or triggered by user.`,
        recommendation: `Enable pointer events and verify button disabled state logic on ${btn.selector}.`,
        elementSelector: btn.selector,
        elementText: displayName,
        elementBox: btn.box,
        elementInfo: `Button: "${displayName}" | Selector: ${btn.selector}`
      });
    }

    // 2. No dead/empty buttons
    // Ensure button is genuinely dead:
    // - Not an in-page fragment jump (e.g. href="#contact" or href="#project-details" where target.length > 1)
    // - Not an interactive navigation control (e.g. "Next project", "Previous project", sliders, tabs)
    const isFragmentTarget = Boolean(btn.target && btn.target.startsWith('#') && btn.target.length > 1);
    const isNavigationPattern = /(next|prev|previous|slide|slider|carousel|tab|accordion|modal|filter|project)/i.test(displayName);
    const isGenuinelyDead = btn.isDead && !isFragmentTarget && !isNavigationPattern;

    if (isGenuinelyDead) {
      score -= 15;
      const deadTargetDesc = btn.target ? `empty/dead destination target (href="${btn.target}")` : 'no attached click handler, form submit action, or destination URL';
      issues.push({
        issueId: `BTN-002-${idx}`,
        pageUrl,
        category: 'buttons-ctas',
        severity: 'critical',
        status: 'FAIL',
        title: `Dead / Empty Button Action: "${displayName}"`,
        problem: `Button '${displayName}' (${btn.selector}) has ${deadTargetDesc}.`,
        expectedBehavior: 'Every interactive button must trigger a valid navigation URL, form submission, modal, or functional action.',
        actualBehavior: `Button click on ${btn.selector} results in dead action without navigation or event handler (target: "${btn.target || 'none'}").`,
        recommendation: `Assign a valid destination URL or bind an interactive event listener to button '${displayName}' (${btn.selector}).`,
        elementSelector: btn.selector,
        elementText: displayName,
        elementBox: btn.box,
        elementInfo: `Button: "${displayName}" | Selector: ${btn.selector} | Action/Href: ${btn.target || 'None'}`
      });
    }

    // 3. External links open correctly and should open on new tab
    if (btn.isExternal && !btn.opensInNewTab) {
      score -= 5;
      issues.push({
        issueId: `BTN-003-${idx}`,
        pageUrl,
        category: 'buttons-ctas',
        severity: 'low',
        status: 'FAIL',
        title: `External CTA Button Does Not Open in New Tab: "${displayName}"`,
        problem: `Button link '${displayName}' (${btn.selector}) navigates to external domain '${btn.target}' in the same browser tab.`,
        expectedBehavior: 'External/third-party CTA links should open in a new tab (target="_blank" rel="noopener noreferrer").',
        actualBehavior: `Opens external destination (${btn.target}) in the current tab without target="_blank".`,
        recommendation: `Add target="_blank" rel="noopener noreferrer" to external button anchor (${btn.selector}).`,
        elementSelector: btn.selector,
        elementText: displayName,
        elementBox: btn.box,
        elementInfo: `Button: "${displayName}" | External URL: ${btn.target || 'N/A'}`
      });
    }
  });

  return {
    score: Math.max(0, score),
    issues
  };
}

