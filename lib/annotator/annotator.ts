import fs from 'fs/promises';
import path from 'path';
import { AuditIssueData } from '../types/audit';
import { uploadToImgBB, isImgBBEnabled } from '../storage/imgbb-uploader';

export async function generateAnnotatedScreenshot(
  auditId: string,
  pageIndex: number,
  desktopScreenshotRelPath: string,
  issues: AuditIssueData[]
): Promise<string> {
  // Filter issues with bounding box coordinates
  const visualIssues = issues.filter((i) => i.elementBox && i.elementBox.width > 0);

  // Default key callout targets if bounding box coordinates weren't captured directly
  const callouts = visualIssues.length > 0 ? visualIssues : issues.slice(0, 4).map((issue, idx) => ({
    ...issue,
    elementBox: {
      x: 100 + (idx % 2) * 600,
      y: 150 + Math.floor(idx / 2) * 300,
      width: 400,
      height: 120
    }
  }));

  // Create an overlay SVG with numbered pins (#1, #2, etc.), bounding boxes, and legend cards
  let svgContent = `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
    <style>
      .box { fill: rgba(239, 68, 68, 0.15); stroke: #ef4444; stroke-width: 3; stroke-dasharray: 6,4; }
      .badge { fill: #ef4444; stroke: #ffffff; stroke-width: 2; }
      .badge-text { fill: #ffffff; font-family: system-ui, sans-serif; font-size: 16px; font-weight: bold; text-anchor: middle; dominant-baseline: central; }
      .legend-bg { fill: rgba(15, 23, 42, 0.88); rx: 12; }
      .legend-title { fill: #38bdf8; font-family: system-ui, sans-serif; font-size: 16px; font-weight: bold; }
      .legend-item { fill: #f8fafc; font-family: system-ui, sans-serif; font-size: 13px; }
      .legend-sev { fill: #f87171; font-family: system-ui, sans-serif; font-size: 11px; font-weight: bold; }
    </style>
    <g id="callouts">`;

  // Draw legend box in top-right corner
  const legendWidth = 440;
  const legendHeight = 60 + callouts.length * 36;
  const legendX = 1440;
  const legendY = 20;

  svgContent += `
    <rect x="${legendX}" y="${legendY}" width="${legendWidth}" height="${legendHeight}" class="legend-bg" />
    <text x="${legendX + 20}" y="${legendY + 30}" class="legend-title">AUDIT FINDINGS CALLOUTS</text>
  `;

  callouts.forEach((issue, index) => {
    const pinNum = index + 1;
    const box = issue.elementBox!;

    // Clamp coordinates inside 1920x1080 bounds
    const bx = Math.max(20, Math.min(1800, box.x || 100));
    const by = Math.max(20, Math.min(950, box.y || 100));
    const bw = Math.max(80, Math.min(600, box.width || 200));
    const bh = Math.max(40, Math.min(400, box.height || 80));

    // Bounding Box around flagged element
    svgContent += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" class="box" />`;

    // Numbered Badge Pin
    const pinX = bx;
    const pinY = by;
    svgContent += `
      <circle cx="${pinX}" cy="${pinY}" r="16" class="badge" />
      <text x="${pinX}" y="${pinY}" class="badge-text">${pinNum}</text>
    `;

    // Legend item entry
    const ly = legendY + 60 + index * 36;
    const titleTrunc = issue.title.length > 40 ? issue.title.substring(0, 37) + '...' : issue.title;
    svgContent += `
      <circle cx="${legendX + 30}" cy="${ly - 4}" r="10" class="badge" />
      <text x="${legendX + 30}" y="${ly - 4}" class="badge-text" style="font-size: 11px;">${pinNum}</text>
      <text x="${legendX + 50}" y="${ly}" class="legend-item">${escapeXml(titleTrunc)}</text>
    `;
  });

  svgContent += `</g></svg>`;

  // If imgBB is enabled, upload the SVG as a buffer directly to imgBB
  if (isImgBBEnabled()) {
    try {
      const svgBuffer = Buffer.from(svgContent, 'utf-8');
      const result = await uploadToImgBB(svgBuffer, `audit_${auditId}_p${pageIndex}_annotated`);
      if (result) {
        return result.url;
      }
    } catch (err) {
      console.warn('[Annotator] imgBB SVG upload failed, falling back to local:', (err as Error).message);
    }
  }

  // Local disk fallback
  const inputAbsPath = path.join(process.cwd(), 'public', desktopScreenshotRelPath);

  // For local mode, check if base desktop screenshot actually exists on disk
  if (!desktopScreenshotRelPath.startsWith('http')) {
    try {
      await fs.access(inputAbsPath);
    } catch {
      return desktopScreenshotRelPath; // Fallback if image unavailable
    }
  }

  try {
    const svgRelPath = `/uploads/screenshots/${auditId}/p${pageIndex}_annotated.svg`;
    const svgAbsPath = path.join(process.cwd(), 'public', svgRelPath);
    await fs.writeFile(svgAbsPath, svgContent, 'utf-8');

    // Also copy base screenshot to annotated PNG
    const outputAbsPath = path.join(process.cwd(), 'public', `/uploads/screenshots/${auditId}/p${pageIndex}_annotated.png`);
    await fs.copyFile(inputAbsPath, outputAbsPath);

    return svgRelPath;
  } catch (err) {
    console.error('Failed to generate SVG screenshot annotation:', err);
    return desktopScreenshotRelPath;
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
