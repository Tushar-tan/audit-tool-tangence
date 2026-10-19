import { Audit, PageAudit, AuditIssue } from '@prisma/client';
import { getIssuesGroupedByPage } from './export-utils';

export function generateMarkdownReport(
  audit: Audit & { pageAudits: PageAudit[]; issues: AuditIssue[] }
): string {
  const pagesWithIssues = getIssuesGroupedByPage(audit);

  const criticalCount = audit.criticalIssuesCount || audit.issues.filter((i) => i.severity === 'critical').length;
  const highCount = audit.highIssuesCount || audit.issues.filter((i) => i.severity === 'high').length;
  const mediumCount = audit.mediumIssuesCount || audit.issues.filter((i) => i.severity === 'medium').length;
  const lowCount = audit.lowIssuesCount || audit.issues.filter((i) => i.severity === 'low').length;
  const pagesWithIssuesCount = audit.pagesWithIssues || (audit.issues.length > 0 ? audit.totalPages : 0);
  const pagesPassedCount = audit.pagesPassed || Math.max(0, audit.totalPages - pagesWithIssuesCount);

  return `# UI/UX Audit Report: ${audit.siteName}

- **Target Domain:** https://${audit.domain}
- **Audit Date:** ${new Date(audit.createdAt).toLocaleDateString()}
${audit.authType && audit.authType !== 'public' ? `- **Authentication:** ${audit.authType === 'credentials' ? 'Credentials (Username & Password)' : 'Manual Login'} (Status: ${audit.authStatus || 'active'}, Authenticated Pages: ${audit.authPagesAuthenticated ?? 0})\n` : ''}- **Total Pages Audited:** ${audit.totalPages}
- **Overall Health Score:** ${audit.overallScore}/100 (Grade ${audit.overallGrade || 'A'})

---

## 1. Summary Dashboard

- **Total Pages Audited:** ${audit.totalPages}
- **Total Issues:** ${audit.issues.length}
- **Critical:** ${criticalCount}
- **High:** ${highCount}
- **Medium:** ${mediumCount}
- **Low:** ${lowCount}
- **Pages With Issues:** ${pagesWithIssuesCount}
- **Pages Passed:** ${pagesPassedCount}

---

## 2. Issues Grouped by Category

| Category | Score |
| :--- | :--- |
| **Header & Navigation** | ${audit.headerNavScore}/100 |
| **Visual Design / UI** | ${audit.visualDesignScore}/100 |
| **Responsive Design** | ${audit.responsiveScore}/100 |
| **Content** | ${audit.contentScore ?? audit.typographyContentScore ?? 0}/100 |
| **Buttons & CTAs** | ${audit.buttonsCtasScore}/100 |
| **Forms** | ${audit.formsScore}/100 |
| **Links** | ${audit.linksScore}/100 |
| **Images & Media** | ${audit.imagesMediaScore}/100 |
| **SEO – On Page** | ${audit.seoOnPageScore ?? audit.seoUxScore ?? 0}/100 |
| **Technical SEO** | ${audit.technicalSeoScore ?? audit.errorStatesScore ?? 0}/100 |
| **Security** | ${audit.securityScore ?? 0}/100 |

---

## 3. Page-Based Detailed Issue Findings (${audit.issues.length} Issues)

${pagesWithIssues
  .map(
    (page) => `
### 🌐 Page: ${page.url} ${page.pageTitle ? `*(${page.pageTitle})*` : ''}
*Found ${page.issues.length} issue(s) on this page.*

${page.issues
  .map(
    (issue, i) => `
#### ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.title}

- **Category:** ${issue.category}
- **Page URL:** ${issue.pageUrl}
${issue.viewport ? `- **Viewport:** ${issue.viewport}` : ''}
- **Element:** \`${issue.elementSelector || 'N/A'}\` ${issue.elementText ? `("${issue.elementText}")` : ''}
${issue.elementInfo ? `- **Asset / Target Details:** \`${issue.elementInfo}\`` : ''}
- **Severity:** ${issue.severity}
- **Status:** ${issue.status}
- **Problem:** ${issue.problem}
- **Expected Behavior:** ${issue.expectedBehavior}
- **Actual Behavior:** ${issue.actualBehavior}
- **Screenshot:** ${issue.screenshotUrl ? `[View Screenshot](${issue.screenshotUrl})` : 'Screenshot unavailable'}

> **Recommendation:** ${issue.recommendation}
`
  )
  .join('\n')}`
  )
  .join('\n---\n\n')}
`;
}
