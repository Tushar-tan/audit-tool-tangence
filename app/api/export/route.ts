import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateHtmlReport } from '@/lib/export/html-exporter';
import { generatePdfReport } from '@/lib/export/pdf-exporter';
import { generateDocxReport } from '@/lib/export/docx-exporter';
import { generateMarkdownReport } from '@/lib/export/markdown-exporter';
import { generateJsonReport } from '@/lib/export/json-csv-exporter';
import { generateXlsxReport } from '@/lib/export/xlsx-exporter';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const auditId = searchParams.get('auditId');
    const format = searchParams.get('format') || 'pdf';

    if (!auditId) {
      return NextResponse.json({ error: 'Missing auditId parameter' }, { status: 400 });
    }

    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: {
        pageAudits: true,
        issues: true
      }
    });

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    const sanitizedSite = audit.siteName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (format === 'html') {
      const html = generateHtmlReport(audit);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="audit_report_${sanitizedSite}.html"`
        }
      });
    }

    if (format === 'markdown' || format === 'md') {
      const md = generateMarkdownReport(audit);
      return new NextResponse(md, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="audit_report_${sanitizedSite}.md"`
        }
      });
    }

    if (format === 'json') {
      const jsonStr = generateJsonReport(audit);
      return new NextResponse(jsonStr, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="audit_report_${sanitizedSite}.json"`
        }
      });
    }

    if (format === 'xlsx' || format === 'csv') {
      const xlsxBuffer = await generateXlsxReport(audit);
      return new NextResponse(new Uint8Array(xlsxBuffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="audit_report_${sanitizedSite}.xlsx"`
        }
      });
    }

    if (format === 'docx') {
      const buffer = await generateDocxReport(audit);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="audit_report_${sanitizedSite}.docx"`
        }
      });
    }

    // Default to PDF format
    const pdfBuffer = await generatePdfReport(audit);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="audit_report_${sanitizedSite}.pdf"`
      }
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
