import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import { Audit, PageAudit, AuditIssue } from '@prisma/client';
import { getIssuesGroupedByPage } from './export-utils';

export async function generateDocxReport(
  audit: Audit & { pageAudits: PageAudit[]; issues: AuditIssue[] }
): Promise<Buffer> {
  const pagesWithIssues = getIssuesGroupedByPage(audit);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: `UI/UX Audit Report: ${audit.siteName}`,
            heading: HeadingLevel.HEADING_1
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Target Domain: `, bold: true }),
              new TextRun(`${audit.domain} | `),
              new TextRun({ text: `Overall Health Score: `, bold: true }),
              new TextRun(`${audit.overallScore}/100 | `),
              new TextRun({ text: `Overall Grade: `, bold: true }),
              new TextRun(`Grade ${audit.overallGrade || 'A'}`)
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'Summary Dashboard',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            text: `Total Pages Audited: ${audit.totalPages} | Total Issues: ${audit.issues.length} | Critical: ${audit.criticalIssuesCount || 0} | High: ${audit.highIssuesCount || 0} | Medium: ${audit.mediumIssuesCount || 0} | Low: ${audit.lowIssuesCount || 0}`
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'Issues Grouped by Category',
            heading: HeadingLevel.HEADING_2
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Score', bold: true })] })] })
                ]
              }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Header & Navigation' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.headerNavScore}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Visual Design / UI' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.visualDesignScore}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Responsive Design' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.responsiveScore}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Content' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.contentScore ?? audit.typographyContentScore ?? 0}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Buttons & CTAs' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.buttonsCtasScore}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Forms' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.formsScore}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Links' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.linksScore}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Images & Media' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.imagesMediaScore}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'SEO – On Page' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.seoOnPageScore ?? audit.seoUxScore ?? 0}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Technical SEO' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.technicalSeoScore ?? audit.errorStatesScore ?? 0}/100` })] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Security' })] }), new TableCell({ children: [new Paragraph({ text: `${audit.securityScore ?? 0}/100` })] })] })
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'Page-Based Detailed Issue Findings',
            heading: HeadingLevel.HEADING_2
          }),
          ...pagesWithIssues.flatMap((page) => [
            new Paragraph({
              text: `Page URL: ${page.url}${page.pageTitle ? ` (${page.pageTitle})` : ''}`,
              heading: HeadingLevel.HEADING_3
            }),
            ...page.issues.flatMap((issue, i) => [
              new Paragraph({
                text: `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.title}`,
                heading: HeadingLevel.HEADING_4
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Category: ', bold: true }),
                  new TextRun(`${issue.category} | `),
                  new TextRun({ text: 'Status: ', bold: true }),
                  new TextRun(`${issue.status} | `),
                  new TextRun({ text: 'Viewport: ', bold: true }),
                  new TextRun(`${issue.viewport || 'N/A'}`)
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Element: ', bold: true }),
                  new TextRun(`${issue.elementSelector || 'N/A'} ${issue.elementText ? `("${issue.elementText}")` : ''}`)
                ]
              }),
              new Paragraph({ text: `Problem: ${issue.problem}` }),
              new Paragraph({ text: `Expected Behavior: ${issue.expectedBehavior}` }),
              new Paragraph({ text: `Actual Behavior: ${issue.actualBehavior}` }),
              new Paragraph({ text: `Recommendation: ${issue.recommendation}` }),
              new Paragraph({ text: '' })
            ])
          ])
        ]
      }
    ]
  });

  const { Packer } = await import('docx');
  return await Packer.toBuffer(doc);
}
