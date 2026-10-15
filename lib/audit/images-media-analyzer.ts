import { PageMetricsData, AuditIssueData } from '../types/audit';

function extractImageInfo(src: string): { filename: string; cleanUrl: string } {
  if (!src) return { filename: 'unknown-image', cleanUrl: '' };
  try {
    const urlObj = new URL(src, 'https://example.com');
    const pathname = urlObj.pathname;
    const parts = pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    const filename = lastPart ? decodeURIComponent(lastPart) : src;
    return { filename: filename || src, cleanUrl: src };
  } catch {
    const clean = src.split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    return { filename: lastPart || src, cleanUrl: src };
  }
}

export function analyzeImagesMedia(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  metrics.images.forEach((img, idx) => {
    const { filename, cleanUrl } = extractImageInfo(img.src);

    // 1. No broken images
    if (img.isBroken) {
      score -= 20;
      issues.push({
        issueId: `IMG-001-${idx}`,
        pageUrl,
        category: 'images-media',
        severity: 'critical',
        status: 'FAIL',
        title: `Broken Image Asset: "${filename}"`,
        problem: `Image file "${filename}" failed to load (0px natural dimensions) or returned an HTTP error status. Image URL: ${cleanUrl}`,
        expectedBehavior: 'All image elements must render valid image data without broken placeholders.',
        actualBehavior: `Failed image asset: ${cleanUrl} (Selector: ${img.selector})`,
        recommendation: `Check the image file path on the server or replace with an active media asset at: ${cleanUrl}`,
        elementSelector: img.selector,
        elementText: filename,
        elementBox: img.box,
        elementInfo: `Image URL: ${cleanUrl}`
      });
    }

    // 2. Images have appropriate alt text
    if (!img.hasAlt && !img.isDecorative) {
      score -= 5;
      issues.push({
        issueId: `IMG-002-${idx}`,
        pageUrl,
        category: 'images-media',
        severity: 'medium',
        status: 'FAIL',
        title: `Image Missing Alt Text: "${filename}"`,
        problem: `Image "${filename}" lacks an alt attribute or has empty alt text. Image URL: ${cleanUrl}`,
        expectedBehavior: 'Informative images must have concise, descriptive alt text explaining the content; decorative images should specify alt="".',
        actualBehavior: `Image element has missing or empty alt attribute. Source URL: ${cleanUrl} (Selector: ${img.selector})`,
        recommendation: `Add a descriptive alt="Description of ${filename}" attribute to image element (${img.selector}).`,
        elementSelector: img.selector,
        elementText: filename,
        elementBox: img.box,
        elementInfo: `Image URL: ${cleanUrl}`
      });
    }

    // 3. Images which are heavy like JPG and PNG (>= 1MB) should be compressed to WebP/AVIF
    const isJpgOrPng = img.format === 'jpg' || img.format === 'png' || /\.jpe?g($|\?)/i.test(img.src) || /\.png($|\?)/i.test(img.src);
    const ONE_MB = 1024 * 1024; // 1 MB (1,048,576 bytes)
    const isHeavyImage = isJpgOrPng && (img.fileSizeBytes !== undefined ? img.fileSizeBytes >= ONE_MB : img.isHeavyRaster);

    if (isHeavyImage) {
      score -= 5;
      const sizeMbStr = img.fileSizeBytes ? `${(img.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB` : '>= 1 MB';
      issues.push({
        issueId: `IMG-003-${idx}`,
        pageUrl,
        category: 'images-media',
        severity: 'low',
        status: 'FAIL',
        title: `Heavy ${img.format.toUpperCase()} Image (${sizeMbStr}) Should Be Compressed to WebP: "${filename}"`,
        problem: `Image "${filename}" (${sizeMbStr}, ${img.naturalWidth}×${img.naturalHeight}px) uses uncompressed legacy ${img.format.toUpperCase()} format with file size >= 1 MB. Image URL: ${cleanUrl}`,
        expectedBehavior: 'Heavy JPG and PNG images (>= 1 MB) should be converted and compressed to WebP/AVIF to reduce payload and boost load speed.',
        actualBehavior: `Served in uncompressed legacy ${img.format.toUpperCase()} format with heavy file size of ${sizeMbStr} (exceeds 1 MB threshold, ${img.naturalWidth}×${img.naturalHeight}px). Source URL: ${cleanUrl}`,
        recommendation: `Convert "${filename}" (${cleanUrl}) from ${sizeMbStr} ${img.format.toUpperCase()} to WebP or AVIF format for 70-90% smaller file size without visual quality loss.`,
        elementSelector: img.selector,
        elementText: filename,
        elementBox: img.box,
        elementInfo: `Image URL: ${cleanUrl} (${sizeMbStr}, ${img.naturalWidth}x${img.naturalHeight}px, ${img.format.toUpperCase()})`
      });
    }
  });

  return {
    score: Math.max(0, score),
    issues
  };
}

