import { Audit, PageAudit, AuditIssue } from '@prisma/client';
import { getIssuesGroupedByPage } from './export-utils';

export function generateJsonReport(
  audit: Audit & { pageAudits: PageAudit[]; issues: AuditIssue[] }
): string {
  const pagesWithIssues = getIssuesGroupedByPage(audit);

  const enrichedAudit = {
    ...audit,
    issuesByPage: pagesWithIssues
  };

  return JSON.stringify(enrichedAudit, null, 2);
}

export function generateCsvReport(
  audit: Audit & { pageAudits: PageAudit[]; issues: AuditIssue[] }
): string {
  const pagesWithIssues = getIssuesGroupedByPage(audit);

  const headers = [
    'Issue ID',
    'Category',
    'Title',
    'Page URL',
    'Viewport',
    'Element Selector',
    'Element Text',
    'Severity',
    'Status',
    'Problem',
    'Expected Behavior',
    'Actual Behavior',
    'Recommendation',
    'Screenshot'
  ];

  const rows: string[][] = [];

  for (const page of pagesWithIssues) {
    for (const issue of page.issues) {
      rows.push([
        issue.issueId || issue.id,
        issue.category,
        escapeCsv(issue.title),
        escapeCsv(issue.pageUrl),
        escapeCsv(issue.viewport || 'N/A'),
        escapeCsv(issue.elementSelector || 'N/A'),
        escapeCsv(issue.elementText || 'N/A'),
        issue.severity,
        issue.status,
        escapeCsv(issue.problem),
        escapeCsv(issue.expectedBehavior),
        escapeCsv(issue.actualBehavior),
        escapeCsv(issue.recommendation),
        escapeCsv(issue.screenshotUrl || 'Screenshot unavailable')
      ]);
    }
  }

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function escapeCsv(str: string): string {
  if (!str) return '""';
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}
