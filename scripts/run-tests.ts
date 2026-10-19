import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { calculatePageScores, aggregateSiteScores } from '../lib/audit/scoring-engine';
import { generateHtmlReport } from '../lib/export/html-exporter';
import { generateMarkdownReport } from '../lib/export/markdown-exporter';
import { generateJsonReport, generateCsvReport } from '../lib/export/json-csv-exporter';
import { analyzeHeaderNav } from '../lib/audit/header-nav-analyzer';
import { analyzeVisualDesign } from '../lib/audit/visual-design-analyzer';
import { analyzeResponsive } from '../lib/audit/responsive-analyzer';
import { analyzeContent } from '../lib/audit/content-analyzer';
import { analyzeButtonsCtas } from '../lib/audit/buttons-ctas-analyzer';
import { analyzeForms } from '../lib/audit/forms-analyzer';
import { analyzeLinks } from '../lib/audit/links-analyzer';
import { analyzeImagesMedia } from '../lib/audit/images-media-analyzer';
import { analyzeSeoOnPage } from '../lib/audit/seo-on-page-analyzer';
import { analyzeTechnicalSeo } from '../lib/audit/technical-seo-analyzer';
import { analyzeSecurity } from '../lib/audit/security-analyzer';

console.log('🧪 Starting Updated Checklist UI/UX Audit Engine Tests...\n');

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// 1. Test Package Dependencies & Setup
test('Package configuration & TypeScript presence', () => {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  assert.strictEqual(fs.existsSync(pkgPath), true, 'package.json must exist');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.ok(pkg.dependencies.next, 'Next.js dependency present');
  assert.ok(pkg.dependencies['@prisma/client'], 'Prisma client present');
});

// 2. Test 11-Category Scoring Engine
test('11-Category Scoring Engine Equal Weighting & Grading', () => {
  const scores = calculatePageScores(90, 95, 88, 92, 85, 90, 95, 85, 90, 92, 95);
  assert.strictEqual(typeof scores.overall, 'number', 'Overall score is numeric');
  assert.ok(scores.overall >= 85, 'Overall score calculation accurate');
  assert.strictEqual(scores.overallGrade, 'A', 'Overall grade is A');

  const aggregated = aggregateSiteScores([scores]);
  assert.strictEqual(aggregated.overall, scores.overall, 'Aggregate site score matches');
  assert.strictEqual(aggregated.headerNav, scores.headerNav, 'Category scores match');
  assert.strictEqual(aggregated.security, scores.security, 'Security score matches');
});

// 3. Test Header & Navigation (Logo home link & # links in nav)
test('Header & Navigation Analyzer flags # navigation links and missing home link', () => {
  const mockMetrics: any = {
    url: 'https://example.com/',
    hasLogo: true,
    logoLinksToHome: false,
    logoHrefs: ['#'],
    navLinks: [
      { text: 'Services', href: '#', isHashLink: true, isBroken: false, selector: 'header nav a' }
    ],
    dropdownMenusCount: 0,
    dropdownsWork: true,
    dropdownCutOff: false,
    navSpacingConsistent: true,
    headerCtaWorks: true,
    hasMobileMenu: false,
    mobileNavOverflow: false
  };

  const res = analyzeHeaderNav(mockMetrics);
  assert.ok(res.issues.length >= 2, 'Flags logo and hash link issues');
  assert.ok(res.issues.some((i) => i.title.includes('Logo Does Not Link to Homepage')));
  assert.ok(res.issues.some((i) => i.title.includes('#')));
});

// 4. Test Visual Design / UI Analyzer
test('Visual Design Analyzer flags overlapping elements and broken layout', () => {
  const mockMetrics: any = {
    url: 'https://example.com/about',
    menuItemUrlsValid: true,
    invalidMenuUrls: [],
    fontFamilies: ['Inter'],
    fontsConsistent: true,
    fontWeights: ['400', '700'],
    fontWeightsConsistent: true,
    fontSizes: [16, 24, 32],
    fontSizesConsistent: true,
    lineHeightsOutOfRangeCount: 0,
    overlappingElementsCount: 1,
    overlappingElementsList: [
      { selector: '.card-hero', box: { x: 0, y: 0, width: 100, height: 100 }, overlapsWith: '.badge' }
    ],
    hasBrokenLayout: true,
    brokenLayoutDetails: ['Content width exceeds document viewport width.'],
    desktopHasHorizontalScroll: true
  };

  const res = analyzeVisualDesign(mockMetrics);
  assert.ok(res.issues.length >= 2, 'Flags overlap and broken layout');
  assert.ok(res.issues.some((i) => i.title.includes('Overlapping Layout Elements')));
});

// 5. Test Responsive Viewport Analyzer (Consolidated & exact element text/selector)
test('Responsive Analyzer Flags Failing Viewport with exact text snippet and consolidated viewport', () => {
  const mockMetrics: any = {
    url: 'https://example.com/test',
    viewportChecks: [
      {
        width: 390,
        height: 844,
        label: '390px',
        hasHorizontalScroll: true,
        scrollWidth: 408,
        clientWidth: 390,
        overflowAmount: 18,
        textOverflows: true,
        overflowingTextItems: [
          { selector: 'h2.hero-title', text: 'Partner Marketing Services', box: { x: 10, y: 100, width: 420, height: 60 }, overflowPx: 30 }
        ],
        imagesResizeCorrectly: true,
        navWorksOnMobile: true,
        formsWorkOnMobile: true,
        overlappingElements: [],
        cutOffElements: []
      }
    ]
  };

  const res = analyzeResponsive(mockMetrics);
  assert.ok(res.issues.length >= 2, 'Responsive issues detected (Horizontal Scroll + Text Overflow)');
  assert.ok(res.issues[0]?.viewport && res.issues[0].viewport.includes('390px'), 'Exact failing viewport recorded');
  assert.strictEqual(res.issues[0]?.category, 'responsive-design', 'Category matches responsive-design');
  const textIssue = res.issues.find((i) => i.title.includes('Text Overflows Viewport'));
  assert.ok(textIssue, 'Text overflow issue exists');
  assert.strictEqual(textIssue?.elementText, 'Partner Marketing Services', 'Exact element text recorded');
  assert.strictEqual(textIssue?.elementSelector, 'h2.hero-title', 'Exact element selector recorded');
});

// 6. Test Content Analyzer (Spelling, Lorem Ipsum, Placeholder)
test('Content Analyzer Flags Lorem Ipsum and Placeholder Text', () => {
  const mockMetrics: any = {
    url: 'https://example.com/blog',
    spellingGrammarErrors: [{ wordOrPhrase: 'teh', context: 'Found typo "teh"', suggestion: 'Replace with "the".' }],
    duplicateContentBlocks: [],
    placeholderTextDetected: true,
    placeholderPhrases: ['sample text'],
    loremIpsumDetected: true,
    inContentLinksWork: true,
    brokenInContentLinks: []
  };

  const res = analyzeContent(mockMetrics);
  assert.ok(res.issues.length >= 3, 'Flags typo, placeholder, and Lorem Ipsum');
  assert.ok(res.issues.some((i) => i.title.includes('Lorem Ipsum')));
  assert.ok(res.issues.some((i) => i.title.includes('Placeholder')));
});

// 7. Test Buttons & CTAs Analyzer (Dead buttons, external new tab)
test('Buttons & CTAs Analyzer Flags Dead Buttons and External Same-Tab Targets', () => {
  const mockMetrics: any = {
    url: 'https://example.com/pricing',
    buttons: [
      {
        text: 'Get Started',
        selector: '.hero-cta',
        box: { x: 100, y: 200, width: 120, height: 44 },
        isClickable: true,
        isDead: true,
        target: '#',
        isExternal: false,
        opensInNewTab: false,
        isDisabled: false,
        overlaps: false
      },
      {
        text: 'External Partner',
        selector: '.partner-btn',
        box: { x: 300, y: 200, width: 120, height: 44 },
        isClickable: true,
        isDead: false,
        target: 'https://partner.com',
        isExternal: true,
        opensInNewTab: false,
        isDisabled: false,
        overlaps: false
      }
    ]
  };

  const res = analyzeButtonsCtas(mockMetrics);
  assert.ok(res.issues.length >= 2, 'Flags dead button and external new tab');
  assert.ok(res.issues.some((i) => i.title.includes('Dead / Empty Button Action')));
});

// 7b. Test Buttons & CTAs Analyzer does not flag functional Next project buttons
test('Buttons & CTAs Analyzer Does Not Flag Functional Buttons Like "Next project"', () => {
  const mockMetrics: any = {
    url: 'https://example.com/portfolio',
    buttons: [
      {
        text: 'Next project',
        selector: 'button.next-project-btn',
        box: { x: 500, y: 400, width: 140, height: 44 },
        isClickable: true,
        isDead: false, // Functional interactive button
        target: undefined,
        isExternal: false,
        opensInNewTab: false,
        isDisabled: false,
        overlaps: false
      },
      {
        text: 'Previous project',
        selector: 'a.prev-btn',
        box: { x: 300, y: 400, width: 140, height: 44 },
        isClickable: true,
        isDead: false,
        target: '#case-study-prev',
        isExternal: false,
        opensInNewTab: false,
        isDisabled: false,
        overlaps: false
      }
    ]
  };

  const res = analyzeButtonsCtas(mockMetrics);
  const deadIssues = res.issues.filter((i) => i.title.includes('Dead / Empty Button Action'));
  assert.strictEqual(deadIssues.length, 0, 'No dead button issue for functional Next project buttons');
});

// 8. Test Links Analyzer (Social media links in new tab, tel, mailto)
test('Links Analyzer Flags Social Links Not Opening in New Tab', () => {
  const mockMetrics: any = {
    url: 'https://example.com/',
    links: [
      {
        text: 'Twitter',
        href: 'https://twitter.com/example',
        selector: 'a.twitter',
        linkType: 'social',
        isInternal: false,
        isExternal: true,
        is404: false,
        isTel: false,
        telWorks: true,
        isMailto: false,
        emailWorks: true,
        isSocial: true,
        socialPlatform: 'twitter',
        opensInNewTab: false,
        isBroken: false
      }
    ]
  };

  const res = analyzeLinks(mockMetrics);
  assert.ok(res.issues.length >= 1, 'Flags social link same-tab issue');
  assert.ok(res.issues[0].title.includes('Social Media Link'));
});

// 9. Test Images & Media Analyzer (Heavy JPG/PNG to WebP compression strictly >= 1MB)
test('Images & Media Analyzer Flags Heavy Raster Images (>= 1MB) and Ignores < 1MB Images', () => {
  const mockMetrics: any = {
    url: 'https://example.com/gallery',
    images: [
      {
        src: 'https://example.com/large-banner.jpg',
        selector: 'img.banner',
        alt: 'Hero banner',
        hasAlt: true,
        isDecorative: false,
        isBroken: false,
        isHeavyRaster: true,
        fileSizeBytes: 1.8 * 1024 * 1024, // 1.8 MB (>= 1MB)
        format: 'jpg',
        naturalWidth: 1920,
        naturalHeight: 1080,
        displayWidth: 1200,
        displayHeight: 675,
        box: { x: 0, y: 0, width: 1200, height: 675 }
      },
      {
        src: 'https://example.com/small-photo.png',
        selector: 'img.small',
        alt: 'Thumbnail photo',
        hasAlt: true,
        isDecorative: false,
        isBroken: false,
        isHeavyRaster: false,
        fileSizeBytes: 350 * 1024, // 350 KB (< 1MB)
        format: 'png',
        naturalWidth: 800,
        naturalHeight: 600,
        displayWidth: 400,
        displayHeight: 300,
        box: { x: 0, y: 0, width: 400, height: 300 }
      }
    ]
  };

  const res = analyzeImagesMedia(mockMetrics);
  assert.strictEqual(res.issues.length, 1, 'Flags only the >= 1MB image and ignores the 350KB image');
  assert.ok(res.issues[0].title.includes('large-banner.jpg'));
  assert.ok(res.issues[0].title.includes('Compressed to WebP'));
  assert.ok(res.issues[0].problem.includes('1.80 MB'));
});

// 9b. Test Images & Media Analyzer (Broken image only shown when actually broken)
test('Images & Media Analyzer Flags Broken Images Only When Actually Broken', () => {
  const mockMetrics: any = {
    url: 'https://example.com/products',
    images: [
      {
        src: 'https://example.com/broken-photo.jpg',
        selector: 'img.broken',
        alt: 'Broken photo',
        hasAlt: true,
        isDecorative: false,
        isBroken: true,
        isHeavyRaster: false,
        fileSizeBytes: 0,
        format: 'jpg',
        naturalWidth: 0,
        naturalHeight: 0,
        displayWidth: 0,
        displayHeight: 0,
        box: { x: 0, y: 0, width: 0, height: 0 }
      },
      {
        src: 'https://example.com/valid-rendered.png',
        selector: 'img.working',
        alt: 'Working photo',
        hasAlt: true,
        isDecorative: false,
        isBroken: false, // Working image
        isHeavyRaster: false,
        fileSizeBytes: 120000,
        format: 'png',
        naturalWidth: 400,
        naturalHeight: 300,
        displayWidth: 400,
        displayHeight: 300,
        box: { x: 0, y: 0, width: 400, height: 300 }
      },
      {
        src: 'https://example.com/logo.svg',
        selector: 'img.logo',
        alt: 'Logo',
        hasAlt: true,
        isDecorative: false,
        isBroken: false, // SVG with 0 natural dimensions but valid asset
        isHeavyRaster: false,
        fileSizeBytes: 15000,
        format: 'svg',
        naturalWidth: 0,
        naturalHeight: 0,
        displayWidth: 150,
        displayHeight: 50,
        box: { x: 10, y: 10, width: 150, height: 50 }
      }
    ]
  };

  const res = analyzeImagesMedia(mockMetrics);
  const brokenIssues = res.issues.filter((i) => i.title.includes('Broken Image Asset'));
  assert.strictEqual(brokenIssues.length, 1, 'Only the actually broken image is flagged');
  assert.ok(brokenIssues[0].title.includes('broken-photo.jpg'));
});

// 10. Test SEO – On Page Analyzer
test('SEO – On Page Analyzer Flags Multiple H1 and Missing Description', () => {
  const mockMetrics: any = {
    url: 'https://example.com/services',
    metaTags: { title: 'Services Page', description: '' },
    hasUniqueTitle: true,
    hasMetaDescription: false,
    h1Count: 2,
    h1List: ['Main Service', 'Secondary Service'],
    imagesMissingAltCount: 0,
    hasValidCanonical: true,
    hasOpenGraphTags: true,
    hasTwitterCardTags: true
  };

  const res = analyzeSeoOnPage(mockMetrics);
  assert.ok(res.issues.length >= 2, 'Flags multiple H1s and missing meta description');
  assert.ok(res.issues.some((i) => i.title.includes('Multiple <h1>')));
  assert.ok(res.issues.some((i) => i.title.includes('Missing Meta Description')));
});

// 11. Test Technical SEO Analyzer (Sitemap, robots, llms.txt)
test('Technical SEO Analyzer Flags Missing Sitemap, Robots, and llms.txt', () => {
  const mockMetrics: any = {
    url: 'https://example.com/',
    hasSitemapXml: false,
    hasRobotsTxt: false,
    isHttps: true,
    httpRedirectsToHttps: true,
    redirects301Work: true,
    is404Page: false,
    hasStructuredData: false,
    hasLlmsTxt: false
  };

  const res = analyzeTechnicalSeo(mockMetrics);
  assert.ok(res.issues.length >= 4, 'Flags technical SEO missing elements');
  assert.ok(res.issues.some((i) => i.title.includes('sitemap.xml')));
  assert.ok(res.issues.some((i) => i.title.includes('robots.txt')));
  assert.ok(res.issues.some((i) => i.title.includes('llms.txt')));
});

// 12. Test Security Analyzer (Google Analytics & SSL)
test('Security Analyzer Flags Missing Google Analytics', () => {
  const mockMetrics: any = {
    url: 'https://example.com/',
    sslValid: true,
    httpsEnforced: true,
    googleAnalyticsInstalled: false
  };

  const res = analyzeSecurity(mockMetrics);
  assert.ok(res.issues.length >= 1, 'Flags missing analytics');
  assert.ok(res.issues[0].title.includes('Google Analytics'));
});

// 13. Test Exporters format with 11-Category Dashboard
test('Report Export Generators (HTML, Markdown, JSON, CSV)', () => {
  const mockAudit: any = {
    id: 'test-audit-123',
    siteName: 'Acme SaaS',
    domain: 'acme.com',
    inputMethod: 'urls',
    configJson: '{}',
    status: 'completed',
    progressPercentage: 100,
    overallScore: 88,
    overallGrade: 'B',
    headerNavScore: 90,
    visualDesignScore: 85,
    responsiveScore: 80,
    contentScore: 90,
    buttonsCtasScore: 80,
    formsScore: 85,
    linksScore: 90,
    imagesMediaScore: 85,
    seoOnPageScore: 85,
    technicalSeoScore: 95,
    securityScore: 90,
    totalPages: 1,
    processedPages: 1,
    pagesWithIssues: 1,
    pagesPassed: 0,
    criticalIssuesCount: 0,
    highIssuesCount: 1,
    mediumIssuesCount: 1,
    lowIssuesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    pageAudits: [
      {
        id: 'p1',
        auditId: 'test-audit-123',
        url: 'https://acme.com/',
        pageTitle: 'Home',
        httpStatus: 200,
        loadTimeMs: 1200,
        desktopScreenshot: '/uploads/screenshots/test/p1_1920.png',
        tabletScreenshot: '/uploads/screenshots/test/p1_768.png',
        mobileScreenshot: '/uploads/screenshots/test/p1_390.png',
        fullPageScreenshot: '/uploads/screenshots/test/p1_full.png',
        annotatedScreenshot: '/uploads/screenshots/test/p1_annotated.png',
        metricsJson: '{}',
        scoresJson: '{}',
        createdAt: new Date()
      }
    ],
    issues: [
      {
        id: 'issue-1',
        issueId: 'RSP-001',
        pageAuditId: 'p1',
        auditId: 'test-audit-123',
        pageUrl: 'https://acme.com/',
        category: 'responsive-design',
        severity: 'high',
        status: 'FAIL',
        viewport: '390px × 844px',
        title: 'Horizontal Scrolling on 390px Viewport',
        problem: '18px horizontal overflow detected.',
        expectedBehavior: 'Page should fit within the viewport without horizontal scrolling.',
        actualBehavior: '18px horizontal overflow detected.',
        recommendation: 'Apply max-width: 100% on container elements.',
        elementSelector: '.main-container',
        elementText: null,
        elementInfo: 'Main Container',
        elementBoxJson: null,
        screenshotUrl: '/uploads/screenshots/test/p1_vp_390.png',
        isGrouped: false,
        affectedCount: 1,
        affectedUrlsJson: null,
        rootCause: null,
        createdAt: new Date()
      }
    ]
  };

  const html = generateHtmlReport(mockAudit);
  assert.ok(html.includes('Summary Dashboard'), 'HTML contains Summary Dashboard');
  assert.ok(html.includes('Responsive Design'), 'HTML contains Responsive Design');
  assert.ok(html.includes('Technical SEO'), 'HTML contains Technical SEO');

  const md = generateMarkdownReport(mockAudit);
  assert.ok(md.includes('Summary Dashboard'), 'Markdown contains Summary Dashboard');
  assert.ok(md.includes('Technical SEO'), 'Markdown contains Technical SEO');

  const json = generateJsonReport(mockAudit);
  assert.ok(json.includes('acme.com'), 'JSON contains domain');

  const csv = generateCsvReport(mockAudit);
  assert.ok(csv.includes('390px × 844px'), 'CSV contains Viewport column');
  assert.ok(csv.includes('responsive-design'), 'CSV contains category identifier');
});

console.log(`\n📊 Test Execution Summary: ${passedTests}/${totalTests} Passed.`);
if (passedTests === totalTests) {
  console.log('✨ All Updated Checklist UI/UX Audit Integration Tests Passed Successfully!');
  process.exit(0);
} else {
  console.error('❌ Some tests failed.');
  process.exit(1);
}
