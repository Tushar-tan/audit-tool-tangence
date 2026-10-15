import { getBrowser } from '../crawler/browser-session';
import { generateHtmlReport } from './html-exporter';
import { Audit, PageAudit, AuditIssue } from '@prisma/client';

export async function generatePdfReport(
  audit: Audit & { pageAudits: PageAudit[]; issues: AuditIssue[] }
): Promise<Buffer> {
  const htmlContent = generateHtmlReport(audit);
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '15mm',
      bottom: '15mm',
      left: '15mm',
      right: '15mm'
    }
  });

  await page.close();
  return Buffer.from(pdfBuffer);
}
