import { Audit, PageAudit, AuditIssue } from '@prisma/client';
import { getIssuesGroupedByPage } from './export-utils';

export function generateHtmlReport(
  audit: Audit & { pageAudits: PageAudit[]; issues: AuditIssue[] }
): string {
  const dateStr = new Date(audit.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const criticalCount = audit.criticalIssuesCount || audit.issues.filter((i) => i.severity === 'critical').length;
  const highCount = audit.highIssuesCount || audit.issues.filter((i) => i.severity === 'high').length;
  const mediumCount = audit.mediumIssuesCount || audit.issues.filter((i) => i.severity === 'medium').length;
  const lowCount = audit.lowIssuesCount || audit.issues.filter((i) => i.severity === 'low').length;
  const pagesWithIssues = audit.pagesWithIssues || (audit.issues.length > 0 ? audit.totalPages : 0);
  const pagesPassed = audit.pagesPassed || Math.max(0, audit.totalPages - pagesWithIssues);

  const categoryLabels: Record<string, string> = {
    'header-navigation': 'Header & Navigation',
    'visual-design': 'Visual Design / UI',
    'overall-visual-design': 'Visual Design / UI',
    'responsive-design': 'Responsive Design',
    'content': 'Content',
    'typography-content': 'Content',
    'buttons-ctas': 'Buttons & CTAs',
    'forms': 'Forms',
    'links': 'Links',
    'images-media': 'Images & Media',
    'seo-on-page': 'SEO – On Page',
    'seo-ux': 'SEO – On Page',
    'technical-seo': 'Technical SEO',
    'error-empty-states': 'Technical SEO',
    'security': 'Security'
  };

  const categoryCounts: Record<string, number> = {};
  Object.keys(categoryLabels).forEach((cat) => {
    categoryCounts[cat] = audit.issues.filter((i) => i.category === cat).length;
  });

  const groupedPages = getIssuesGroupedByPage(audit);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>UI/UX Audit Report - ${audit.siteName}</title>
  <style>
    :root {
      --primary: #0c8ce9;
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --critical: #ef4444;
      --high: #f97316;
      --medium: #eab308;
      --low: #3b82f6;
    }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      margin: 0;
      padding: 40px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { border-bottom: 2px solid var(--border); padding-bottom: 24px; margin-bottom: 32px; }
    .header h1 { font-size: 32px; margin: 0 0 8px 0; color: #38bdf8; }
    .meta { color: var(--text-muted); font-size: 14px; }
    
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .stat-card .val {
      font-size: 28px;
      font-weight: bold;
      margin-top: 6px;
      color: #38bdf8;
    }
    
    .cat-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 36px;
      border: 1px solid var(--border);
    }
    .cat-table th, .cat-table td {
      padding: 12px 20px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    .cat-table th {
      background: #111827;
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 12px;
    }
    
    .page-section {
      margin-bottom: 40px;
    }
    .page-header {
      background: #1e293b;
      border: 1px solid var(--border);
      border-left: 6px solid #38bdf8;
      border-radius: 8px;
      padding: 16px 24px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .page-url {
      font-size: 16px;
      font-weight: bold;
      color: #38bdf8;
      word-break: break-all;
    }
    
    .issue-card {
      background: var(--card);
      border-left: 4px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .issue-card.critical { border-left-color: var(--critical); }
    .issue-card.high { border-left-color: var(--high); }
    .issue-card.medium { border-left-color: var(--medium); }
    .issue-card.low { border-left-color: var(--low); }
    
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      margin-right: 8px;
    }
    .badge-critical { background: rgba(239,68,68,0.2); color: #f87171; }
    .badge-high { background: rgba(249,115,22,0.2); color: #fb923c; }
    .badge-medium { background: rgba(234,179,8,0.2); color: #facc15; }
    .badge-low { background: rgba(59,130,246,0.2); color: #60a5fa; }
    
    .issue-field {
      margin-bottom: 8px;
      font-size: 13px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .issue-field strong {
      color: var(--text-muted);
      display: inline-block;
      min-width: 140px;
    }
    .recommendation-box {
      background: rgba(14, 165, 233, 0.1);
      border: 1px solid rgba(14, 165, 233, 0.3);
      border-radius: 6px;
      padding: 12px 16px;
      margin-top: 12px;
      font-size: 13px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>UI/UX Audit Report: ${audit.siteName}</h1>
      <div class="meta">Domain: ${audit.domain} | Date: ${dateStr}</div>
    </div>

    <!-- Summary Dashboard -->
    <h2>Summary Dashboard</h2>
    <div class="dashboard-grid">
      <div class="stat-card"><div>Total Pages Audited</div><div class="val">${audit.totalPages}</div></div>
      <div class="stat-card"><div>Total Issues</div><div class="val">${audit.issues.length}</div></div>
      <div class="stat-card"><div>Critical Severity</div><div class="val" style="color:#f87171;">${criticalCount}</div></div>
      <div class="stat-card"><div>High Severity</div><div class="val" style="color:#fb923c;">${highCount}</div></div>
      <div class="stat-card"><div>Medium Severity</div><div class="val" style="color:#facc15;">${mediumCount}</div></div>
      <div class="stat-card"><div>Low Severity</div><div class="val" style="color:#60a5fa;">${lowCount}</div></div>
      <div class="stat-card"><div>Pages With Issues</div><div class="val">${pagesWithIssues}</div></div>
      <div class="stat-card"><div>Pages Passed</div><div class="val" style="color:#4ade80;">${pagesPassed}</div></div>
    </div>

    <!-- Category Breakdown -->
    <h2>Issues Grouped by Category</h2>
    <table class="cat-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Score</th>
          <th>Issues Flagged</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Header & Navigation</td><td>${audit.headerNavScore}/100</td><td>${(categoryCounts['header-navigation'] || 0)}</td></tr>
        <tr><td>Visual Design / UI</td><td>${(audit.visualDesignScore)}/100</td><td>${(categoryCounts['visual-design'] || categoryCounts['overall-visual-design'] || 0)}</td></tr>
        <tr><td>Responsive Design</td><td>${(audit.responsiveScore)}/100</td><td>${(categoryCounts['responsive-design'] || 0)}</td></tr>
        <tr><td>Content</td><td>${(audit.contentScore ?? audit.typographyContentScore ?? 0)}/100</td><td>${(categoryCounts['content'] || categoryCounts['typography-content'] || 0)}</td></tr>
        <tr><td>Buttons & CTAs</td><td>${audit.buttonsCtasScore}/100</td><td>${(categoryCounts['buttons-ctas'] || 0)}</td></tr>
        <tr><td>Forms</td><td>${audit.formsScore}/100</td><td>${(categoryCounts['forms'] || 0)}</td></tr>
        <tr><td>Links</td><td>${audit.linksScore}/100</td><td>${(categoryCounts['links'] || 0)}</td></tr>
        <tr><td>Images & Media</td><td>${audit.imagesMediaScore}/100</td><td>${(categoryCounts['images-media'] || 0)}</td></tr>
        <tr><td>SEO – On Page</td><td>${(audit.seoOnPageScore ?? audit.seoUxScore ?? 0)}/100</td><td>${(categoryCounts['seo-on-page'] || categoryCounts['seo-ux'] || 0)}</td></tr>
        <tr><td>Technical SEO</td><td>${(audit.technicalSeoScore ?? audit.errorStatesScore ?? 0)}/100</td><td>${(categoryCounts['technical-seo'] || categoryCounts['error-empty-states'] || 0)}</td></tr>
        <tr><td>Security</td><td>${(audit.securityScore ?? 0)}/100</td><td>${(categoryCounts['security'] || 0)}</td></tr>
      </tbody>
    </table>

    <!-- Page-Based Detailed Issue Findings -->
    <h2>Page-Based Detailed Issue Findings (${audit.issues.length} Issues)</h2>
    ${groupedPages
      .map(
        (page) => `
      <div class="page-section">
        <div class="page-header">
          <div>
            <div class="page-url">🌐 ${page.url}</div>
            ${page.pageTitle ? `<div style="color:var(--text-muted); font-size:12px;">${page.pageTitle}</div>` : ''}
          </div>
          <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 13px;">${page.issues.length} Issue(s)</span>
        </div>

        ${page.issues
          .map(
            (issue) => `
          <div class="issue-card ${issue.severity}">
            <div style="margin-bottom:12px;">
              <span class="badge badge-${issue.severity}">${issue.severity}</span>
              <span class="badge" style="background: rgba(255,255,255,0.1);">${categoryLabels[issue.category] || issue.category}</span>
              <span class="badge" style="background: rgba(16,185,129,0.15); color:#34d399;">${issue.status}</span>
            </div>

            <h3 style="margin: 0 0 12px 0;">${issue.title}</h3>

            <div class="issue-field"><strong>Page URL:</strong> <code>${issue.pageUrl}</code></div>
            ${issue.viewport ? `<div class="issue-field"><strong>Viewport:</strong> <code>${issue.viewport}</code></div>` : ''}
            <div class="issue-field"><strong>Element / Selector:</strong> <code>${issue.elementSelector || 'N/A'}</code> ${issue.elementText ? `("${issue.elementText}")` : ''}</div>
            ${issue.elementInfo ? `<div class="issue-field"><strong>Asset / Target Details:</strong> <code>${issue.elementInfo}</code></div>` : ''}
            <div class="issue-field"><strong>Problem:</strong> ${issue.problem}</div>
            <div class="issue-field"><strong>Expected Behavior:</strong> ${issue.expectedBehavior}</div>
            <div class="issue-field"><strong>Actual Behavior:</strong> ${issue.actualBehavior}</div>
            <div class="issue-field"><strong>Screenshot:</strong> ${issue.screenshotUrl ? `<a href="${issue.screenshotUrl}" target="_blank" style="color:#38bdf8;">View Attached Screenshot</a>` : 'Screenshot unavailable'}</div>

            <div class="recommendation-box">
              <strong>Recommendation:</strong> ${issue.recommendation}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `
      )
      .join('')}
  </div>
</body>
</html>`;
}
