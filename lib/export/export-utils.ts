import { Audit, PageAudit, AuditIssue } from '@prisma/client';

export interface PageWithIssues {
  url: string;
  pageTitle?: string | null;
  issues: AuditIssue[];
}

export function getIssuesGroupedByPage(
  audit: Audit & { pageAudits?: PageAudit[]; issues: AuditIssue[] }
): PageWithIssues[] {
  const pageMap = new Map<string, PageWithIssues>();

  if (audit.pageAudits && audit.pageAudits.length > 0) {
    for (const pa of audit.pageAudits) {
      pageMap.set(pa.id, {
        url: pa.url,
        pageTitle: pa.pageTitle,
        issues: []
      });
    }
  }

  const unassignedIssues: AuditIssue[] = [];

  for (const issue of audit.issues) {
    if (issue.pageAuditId && pageMap.has(issue.pageAuditId)) {
      pageMap.get(issue.pageAuditId)!.issues.push(issue);
    } else {
      unassignedIssues.push(issue);
    }
  }

  const result: PageWithIssues[] = [];

  for (const [, pageData] of pageMap) {
    if (pageData.issues.length > 0) {
      result.push(pageData);
    }
  }

  const defaultUrl = audit.domain
    ? (audit.domain.startsWith('http://') || audit.domain.startsWith('https://')
        ? audit.domain
        : `https://${audit.domain}`)
    : 'Site-Wide';

  if (unassignedIssues.length > 0) {
    result.push({
      url: defaultUrl,
      pageTitle: 'General / Site-Wide Findings',
      issues: unassignedIssues
    });
  }

  if (result.length === 0 && audit.issues.length > 0) {
    result.push({
      url: defaultUrl,
      pageTitle: 'All Audited Pages',
      issues: audit.issues
    });
  }

  return result;
}
