import ExcelJS from 'exceljs';
import { Audit, PageAudit, AuditIssue } from '@prisma/client';
import { getIssuesGroupedByPage } from './export-utils';

// ─── Color palette ──────────────────────────────────────────────────────────
const CLR = {
  // Brand
  headerBg:    '0F172A',   // dark navy
  headerFg:    'F8FAFC',   // near-white
  accentBlue:  '38BDF8',   // sky-400
  brandPurple: '818CF8',   // indigo-400

  // Severity fills (solid backgrounds for rows)
  critical:    'FEE2E2',   // rose-100
  high:        'FEF3C7',   // amber-100
  medium:      'FEF9C3',   // yellow-100
  low:         'DBEAFE',   // blue-100
  pass:        'D1FAE5',   // emerald-100

  // Severity font colours
  criticalFg:  'B91C1C',
  highFg:      'B45309',
  mediumFg:    'CA8A04',
  lowFg:       '1D4ED8',
  passFg:      '047857',

  // General
  sectionHead: '1E293B',   // slate-800
  alt:         'F1F5F9',   // slate-100 (alternating row)
  white:       'FFFFFF',
  border:      'CBD5E1',   // slate-300
  muted:       '64748B',   // slate-500
};

function border(style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style, color: { argb: `FF${CLR.border}` } };
  return { top: s, left: s, bottom: s, right: s };
}

function fill(hex: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } };
}

function font(opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: 'Calibri', size: 10, ...opts };
}

function applyHeaderRow(row: ExcelJS.Row, cols: number, bgHex: string, fgHex: string) {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > cols) return;
    cell.fill = fill(bgHex);
    cell.font = font({ bold: true, color: { argb: `FF${fgHex}` }, size: 11 });
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border();
  });
}

function severityColors(sev: string): { bg: string; fg: string } {
  switch (sev.toLowerCase()) {
    case 'critical': return { bg: CLR.critical, fg: CLR.criticalFg };
    case 'high':     return { bg: CLR.high,     fg: CLR.highFg     };
    case 'medium':   return { bg: CLR.medium,   fg: CLR.mediumFg   };
    case 'low':      return { bg: CLR.low,       fg: CLR.lowFg     };
    case 'pass':     return { bg: CLR.pass,      fg: CLR.passFg    };
    default:         return { bg: CLR.white,     fg: '000000'      };
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  'header-navigation':    'Header & Navigation',
  'visual-design':        'Visual Design / UI',
  'overall-visual-design':'Visual Design / UI',
  'responsive-design':    'Responsive Design',
  'content':              'Content',
  'typography-content':   'Content',
  'buttons-ctas':         'Buttons & CTAs',
  'forms':                'Forms',
  'links':                'Links',
  'images-media':         'Images & Media',
  'seo-on-page':          'SEO – On Page',
  'seo-ux':               'SEO – On Page',
  'technical-seo':        'Technical SEO',
  'error-empty-states':   'Technical SEO',
  'security':             'Security',
};

// ─── Main export function ────────────────────────────────────────────────────
export async function generateXlsxReport(
  audit: Audit & { pageAudits: PageAudit[]; issues: AuditIssue[] }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tangence Audit Tool';
  wb.lastModifiedBy = 'Tangence Audit Tool';
  wb.created = new Date();
  wb.modified = new Date();

  const pagesWithIssues = getIssuesGroupedByPage(audit);

  // ── 1. Cover / Summary Sheet ──────────────────────────────────────────────
  const coverSh = wb.addWorksheet('📊 Summary Dashboard', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    views: [{ showGridLines: false }],
  });
  coverSh.properties.defaultRowHeight = 18;

  // Title block
  coverSh.mergeCells('A1:G1');
  coverSh.mergeCells('A2:G2');
  coverSh.mergeCells('A3:G3');
  coverSh.mergeCells('A4:G4');

  const t1 = coverSh.getCell('A1');
  t1.value = 'UI/UX AUDIT REPORT';
  t1.font = { name: 'Calibri', size: 22, bold: true, color: { argb: `FF${CLR.headerFg}` } };
  t1.fill = fill(CLR.headerBg);
  t1.alignment = { vertical: 'middle', horizontal: 'center' };
  coverSh.getRow(1).height = 42;

  const t2 = coverSh.getCell('A2');
  t2.value = audit.siteName;
  t2.font = { name: 'Calibri', size: 15, bold: true, color: { argb: `FF${CLR.accentBlue}` } };
  t2.fill = fill(CLR.headerBg);
  t2.alignment = { vertical: 'middle', horizontal: 'center' };
  coverSh.getRow(2).height = 28;

  const t3 = coverSh.getCell('A3');
  t3.value = `Domain: ${audit.domain}   |   Date: ${new Date(audit.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  t3.font = { name: 'Calibri', size: 10, color: { argb: `FF${CLR.muted}` } };
  t3.fill = fill(CLR.headerBg);
  t3.alignment = { vertical: 'middle', horizontal: 'center' };
  coverSh.getRow(3).height = 20;

  coverSh.getRow(4).height = 10; // spacer
  coverSh.getCell('A4').fill = fill(CLR.headerBg);

  // Section: Audit Health Snapshot
  coverSh.getRow(5).height = 26;
  coverSh.mergeCells('A5:G5');
  const snapH = coverSh.getCell('A5');
  snapH.value = 'AUDIT HEALTH SNAPSHOT';
  snapH.font = font({ bold: true, size: 12, color: { argb: `FF${CLR.headerFg}` } });
  snapH.fill = fill(CLR.sectionHead);
  snapH.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Metric cards (row 6-8)
  const metrics = [
    { label: 'Pages Audited',   value: audit.totalPages,           col: 'A' },
    { label: 'Total Issues',    value: audit.issues.length,        col: 'B' },
    { label: 'Critical',        value: audit.criticalIssuesCount,  col: 'C', clr: CLR.criticalFg },
    { label: 'High',            value: audit.highIssuesCount,      col: 'D', clr: CLR.highFg     },
    { label: 'Medium',          value: audit.mediumIssuesCount,    col: 'E', clr: CLR.mediumFg   },
    { label: 'Low',             value: audit.lowIssuesCount,       col: 'F', clr: CLR.lowFg      },
    { label: 'Overall Grade',   value: `${audit.overallGrade} (${audit.overallScore}/100)`, col: 'G', clr: CLR.passFg },
  ];

  for (const m of metrics) {
    coverSh.mergeCells(`${m.col}6:${m.col}7`);
    coverSh.mergeCells(`${m.col}8:${m.col}8`);

    const valCell = coverSh.getCell(`${m.col}6`);
    valCell.value = m.value;
    valCell.font = { name: 'Calibri', size: 22, bold: true, color: { argb: `FF${m.clr || CLR.accentBlue}` } };
    valCell.fill = fill(CLR.alt);
    valCell.alignment = { vertical: 'middle', horizontal: 'center' };
    valCell.border = border();
    coverSh.getRow(6).height = 32;

    const lblCell = coverSh.getCell(`${m.col}8`);
    lblCell.value = m.label;
    lblCell.font = font({ bold: true, size: 9, color: { argb: `FF${CLR.muted}` } });
    lblCell.fill = fill(CLR.white);
    lblCell.alignment = { vertical: 'middle', horizontal: 'center' };
    lblCell.border = border();
    coverSh.getRow(8).height = 18;
  }

  // Spacer
  coverSh.getRow(9).height = 8;

  // Section: Category Scores
  coverSh.getRow(10).height = 26;
  coverSh.mergeCells('A10:G10');
  const catHead = coverSh.getCell('A10');
  catHead.value = 'CATEGORY SCORES';
  catHead.font = font({ bold: true, size: 12, color: { argb: `FF${CLR.headerFg}` } });
  catHead.fill = fill(CLR.sectionHead);
  catHead.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const catHeaders = ['Category', 'Score', 'Grade', 'Issues Found', 'Status'];
  const catHRow = coverSh.getRow(11);
  catHeaders.forEach((h, i) => {
    const cell = catHRow.getCell(i + 1);
    cell.value = h;
  });
  applyHeaderRow(catHRow, catHeaders.length, CLR.accentBlue, CLR.headerBg);
  catHRow.height = 20;

  const categories = [
    { name: 'Header & Navigation',  score: audit.headerNavScore,   catId: 'header-navigation'  },
    { name: 'Visual Design / UI',   score: audit.visualDesignScore, catId: 'visual-design'       },
    { name: 'Responsive Design',    score: audit.responsiveScore,  catId: 'responsive-design'   },
    { name: 'Content',              score: audit.contentScore,     catId: 'content'             },
    { name: 'Buttons & CTAs',       score: audit.buttonsCtasScore, catId: 'buttons-ctas'        },
    { name: 'Forms',                score: audit.formsScore,       catId: 'forms'               },
    { name: 'Links',                score: audit.linksScore,       catId: 'links'               },
    { name: 'Images & Media',       score: audit.imagesMediaScore, catId: 'images-media'        },
    { name: 'SEO – On Page',        score: audit.seoOnPageScore,   catId: 'seo-on-page'         },
    { name: 'Technical SEO',        score: audit.technicalSeoScore,catId: 'technical-seo'       },
    { name: 'Security',             score: audit.securityScore,    catId: 'security'            },
  ];

  categories.forEach((cat, i) => {
    const issueCount = audit.issues.filter(
      (is) => is.category === cat.catId || CATEGORY_LABELS[is.category] === cat.name
    ).length;
    const grade = (cat.score ?? 0) >= 90 ? 'A' : (cat.score ?? 0) >= 75 ? 'B' : (cat.score ?? 0) >= 60 ? 'C' : (cat.score ?? 0) >= 40 ? 'D' : 'F';
    const status = issueCount === 0 ? 'PASS' : issueCount <= 2 ? 'WARN' : 'FAIL';
    const isAlt = i % 2 === 0;

    const row = coverSh.getRow(12 + i);
    row.height = 20;
    const vals = [cat.name, `${cat.score ?? 0}/100`, grade, issueCount, status];
    vals.forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = v;
      cell.fill = fill(isAlt ? CLR.alt : CLR.white);
      cell.border = border();
      cell.font = font({ bold: j === 0, color: { argb: j === 4 ? `FF${status === 'PASS' ? CLR.passFg : status === 'WARN' ? CLR.highFg : CLR.criticalFg}` : undefined } });
      cell.alignment = { vertical: 'middle', horizontal: j === 0 ? 'left' : 'center', indent: j === 0 ? 1 : 0 };
    });
  });

  // Column widths on cover
  coverSh.columns = [
    { width: 28 },
    { width: 14 },
    { width: 12 },
    { width: 16 },
    { width: 12 },
    { width: 14 },
    { width: 22 },
  ];

  // ── 2. All Issues Sheet ───────────────────────────────────────────────────
  const allSh = wb.addWorksheet('📋 All Issues', {
    views: [{ state: 'frozen', ySplit: 2, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });
  allSh.properties.defaultRowHeight = 16;

  // Sheet title row
  allSh.mergeCells('A1:N1');
  const allTitle = allSh.getCell('A1');
  allTitle.value = `All Audit Issues — ${audit.siteName} (${audit.issues.length} Total)`;
  allTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: `FF${CLR.headerFg}` } };
  allTitle.fill = fill(CLR.headerBg);
  allTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  allSh.getRow(1).height = 28;

  const issueHeaders = [
    '#', 'Issue ID', 'Category', 'Severity', 'Status', 'Page URL',
    'Viewport', 'Title', 'Element / Selector', 'Asset / Target',
    'Problem Description', 'Expected Behavior', 'Actual Behavior', 'Recommendation'
  ];
  const allHRow = allSh.getRow(2);
  issueHeaders.forEach((h, i) => { allHRow.getCell(i + 1).value = h; });
  applyHeaderRow(allHRow, issueHeaders.length, CLR.sectionHead, CLR.accentBlue);

  let rowIdx = 3;
  let issueNum = 0;
  for (const page of pagesWithIssues) {
    for (const issue of page.issues) {
      issueNum++;
      const sev = issue.severity || 'low';
      const { bg, fg } = severityColors(sev);
      const isAlt = issueNum % 2 === 0;
      const rowBg = isAlt ? CLR.alt : CLR.white;

      const dataRow = allSh.getRow(rowIdx++);
      dataRow.height = 46;

      const vals = [
        issueNum,
        issue.issueId || issue.id.slice(0, 12),
        CATEGORY_LABELS[issue.category] || issue.category,
        sev.toUpperCase(),
        issue.status,
        issue.pageUrl,
        issue.viewport || '—',
        issue.title,
        `${issue.elementSelector || ''}${issue.elementText ? ` ("${issue.elementText}")` : ''}`,
        issue.elementInfo || '—',
        issue.problem,
        issue.expectedBehavior,
        issue.actualBehavior,
        issue.recommendation,
      ];

      vals.forEach((v, j) => {
        const cell = dataRow.getCell(j + 1);
        cell.value = v;
        cell.border = border();
        cell.alignment = { vertical: 'top', horizontal: j < 2 ? 'center' : 'left', wrapText: true, indent: j > 1 ? 1 : 0 };

        // Severity column gets the severity fill, rest get alternating
        if (j === 3) {
          cell.fill = fill(bg);
          cell.font = font({ bold: true, color: { argb: `FF${fg}` } });
        } else {
          cell.fill = fill(rowBg);
          cell.font = font({ size: j >= 7 ? 10 : 10 });
        }
      });
    }
  }

  // Auto filter
  allSh.autoFilter = { from: 'A2', to: `N2` };

  // Column widths
  allSh.columns = [
    { width: 4  },  // #
    { width: 14 },  // Issue ID
    { width: 22 },  // Category
    { width: 12 },  // Severity
    { width: 8  },  // Status
    { width: 36 },  // Page URL
    { width: 14 },  // Viewport
    { width: 40 },  // Title
    { width: 28 },  // Selector
    { width: 36 },  // Asset/Target
    { width: 42 },  // Problem
    { width: 36 },  // Expected
    { width: 36 },  // Actual
    { width: 42 },  // Recommendation
  ];

  // ── 3. Per-Page Sheets ───────────────────────────────────────────────────
  pagesWithIssues.forEach((page, pageIdx) => {
    const safeTitle = page.url
      .replace(/^https?:\/\//, '')
      .replace(/[\\/*?:[\]]/g, '_')
      .slice(0, 28);
    const sheetName = `${pageIdx + 1}. ${safeTitle}`;

    const pgSh = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });
    pgSh.properties.defaultRowHeight = 16;

    // Page header
    pgSh.mergeCells('A1:M1');
    const pgTitle = pgSh.getCell('A1');
    pgTitle.value = `Page Audit: ${page.pageTitle || page.url}`;
    pgTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: `FF${CLR.headerFg}` } };
    pgTitle.fill = fill(CLR.headerBg);
    pgTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    pgSh.getRow(1).height = 28;

    pgSh.mergeCells('A2:M2');
    const pgUrl = pgSh.getCell('A2');
    pgUrl.value = page.url;
    pgUrl.font = { name: 'Calibri', size: 10, color: { argb: `FF${CLR.accentBlue}` } };
    pgUrl.fill = fill(CLR.sectionHead);
    pgUrl.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    pgSh.getRow(2).height = 18;

    const pgHeaders = [
      '#', 'Category', 'Severity', 'Status', 'Title',
      'Element / Selector', 'Asset / Target', 'Viewport',
      'Problem', 'Expected Behavior', 'Actual Behavior', 'Recommendation', 'Screenshot'
    ];
    const pgHRow = pgSh.getRow(3);
    pgHeaders.forEach((h, i) => { pgHRow.getCell(i + 1).value = h; });
    applyHeaderRow(pgHRow, pgHeaders.length, CLR.sectionHead, CLR.accentBlue);

    page.issues.forEach((issue, ii) => {
      const sev = issue.severity || 'low';
      const { bg, fg } = severityColors(sev);
      const isAlt = ii % 2 === 0;

      const r = pgSh.addRow([
        ii + 1,
        CATEGORY_LABELS[issue.category] || issue.category,
        sev.toUpperCase(),
        issue.status,
        issue.title,
        `${issue.elementSelector || ''}${issue.elementText ? ` ("${issue.elementText}")` : ''}`,
        issue.elementInfo || '—',
        issue.viewport || '—',
        issue.problem,
        issue.expectedBehavior,
        issue.actualBehavior,
        issue.recommendation,
        issue.screenshotUrl || '—',
      ]);
      r.height = 50;

      r.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col > pgHeaders.length) return;
        cell.border = border();
        cell.alignment = { vertical: 'top', horizontal: col <= 1 ? 'center' : 'left', wrapText: true, indent: col > 1 ? 1 : 0 };
        if (col === 3) {
          cell.fill = fill(bg);
          cell.font = font({ bold: true, color: { argb: `FF${fg}` } });
        } else {
          cell.fill = fill(isAlt ? CLR.alt : CLR.white);
          cell.font = font();
        }
      });
    });

    pgSh.autoFilter = { from: 'A3', to: `M3` };
    pgSh.columns = [
      { width: 4  },
      { width: 22 },
      { width: 12 },
      { width: 8  },
      { width: 40 },
      { width: 28 },
      { width: 36 },
      { width: 14 },
      { width: 42 },
      { width: 36 },
      { width: 36 },
      { width: 42 },
      { width: 20 },
    ];
  });

  // ── 4. Category Breakdown Sheet ───────────────────────────────────────────
  const catSh = wb.addWorksheet('📂 By Category', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  });
  catSh.properties.defaultRowHeight = 16;

  catSh.mergeCells('A1:F1');
  const catShTitle = catSh.getCell('A1');
  catShTitle.value = 'Issues Grouped by Category';
  catShTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: `FF${CLR.headerFg}` } };
  catShTitle.fill = fill(CLR.headerBg);
  catShTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  catSh.getRow(1).height = 30;

  let catRow = 2;

  const allCategories = Array.from(
    new Set(audit.issues.map((i) => CATEGORY_LABELS[i.category] || i.category))
  );

  for (const catLabel of allCategories) {
    const catIssues = audit.issues.filter(
      (i) => (CATEGORY_LABELS[i.category] || i.category) === catLabel
    );

    // Category header
    const catHr = catSh.getRow(catRow++);
    catHr.height = 24;
    catSh.mergeCells(`A${catRow - 1}:F${catRow - 1}`);
    const catCell = catSh.getCell(`A${catRow - 1}`);
    catCell.value = `${catLabel}  (${catIssues.length} issue${catIssues.length !== 1 ? 's' : ''})`;
    catCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${CLR.headerFg}` } };
    catCell.fill = fill(CLR.sectionHead);
    catCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    catCell.border = border();

    // Sub-headers
    const subH = catSh.getRow(catRow++);
    subH.height = 18;
    ['#', 'Severity', 'Title', 'Page URL', 'Element', 'Recommendation'].forEach((h, i) => {
      subH.getCell(i + 1).value = h;
    });
    applyHeaderRow(subH, 6, CLR.accentBlue, CLR.headerBg);

    catIssues.forEach((issue, ii) => {
      const sev = issue.severity || 'low';
      const { bg, fg } = severityColors(sev);
      const r = catSh.getRow(catRow++);
      r.height = 36;
      const vals = [
        ii + 1,
        sev.toUpperCase(),
        issue.title,
        issue.pageUrl,
        `${issue.elementSelector || ''}${issue.elementText ? ` ("${issue.elementText}")` : ''}`,
        issue.recommendation,
      ];
      vals.forEach((v, j) => {
        const cell = r.getCell(j + 1);
        cell.value = v;
        cell.border = border();
        cell.alignment = { vertical: 'top', horizontal: j <= 1 ? 'center' : 'left', wrapText: true, indent: j > 1 ? 1 : 0 };
        if (j === 1) {
          cell.fill = fill(bg);
          cell.font = font({ bold: true, color: { argb: `FF${fg}` } });
        } else {
          cell.fill = fill(ii % 2 === 0 ? CLR.alt : CLR.white);
          cell.font = font();
        }
      });
    });

    // Spacer
    catSh.getRow(catRow++).height = 6;
  }

  catSh.columns = [
    { width: 4  },
    { width: 12 },
    { width: 44 },
    { width: 38 },
    { width: 28 },
    { width: 44 },
  ];

  // ── Write to buffer ───────────────────────────────────────────────────────
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
