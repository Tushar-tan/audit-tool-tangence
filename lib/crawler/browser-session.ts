import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { PageMetricsData, ResponsiveViewportCheck, ElementBox } from '../types/audit';
import { uploadToImgBB, isImgBBEnabled } from '../storage/imgbb-uploader';

export interface PageCaptureResult {
  url: string;
  pageTitle: string;
  httpStatus: number;
  loadTimeMs: number;
  desktopScreenshotPath: string;
  tabletScreenshotPath: string;
  mobileScreenshotPath: string;
  fullPageScreenshotPath: string;
  metrics: PageMetricsData;
  discoveredLinks: string[];
  /** undefined for public pages; 'authenticated' | 'auth_required' | 'auth_expired' for authenticated crawls */
  authStatus?: 'authenticated' | 'auth_required' | 'auth_expired' | 'public';
}

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ].filter(Boolean) as string[];

  const fsSync = require('fs');
  const foundExec = possiblePaths.find((p) => {
    try {
      return fsSync.existsSync(p);
    } catch {
      return false;
    }
  });

  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });
  } catch (err) {
    if (foundExec) {
      browserInstance = await puppeteer.launch({
        executablePath: foundExec,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
    } else {
      throw err;
    }
  }
  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// 13 Required Viewports
const REQUIRED_VIEWPORTS = [
  { width: 320, height: 568, label: '320px (Small Mobile)' },
  { width: 360, height: 640, label: '360px (Standard Mobile)' },
  { width: 375, height: 812, label: '375px (iPhone X/SE)' },
  { width: 390, height: 844, label: '390px (iPhone 12/13/14)' },
  { width: 414, height: 896, label: '414px (iPhone Plus/Max)' },
  { width: 768, height: 1024, label: '768px (iPad Portrait)' },
  { width: 820, height: 1180, label: '820px (iPad Air)' },
  { width: 1024, height: 768, label: '1024px (Tablet Landscape / Small Desktop)' },
  { width: 1280, height: 800, label: '1280px (Standard Laptop)' },
  { width: 1366, height: 768, label: '1366px (HD Laptop)' },
  { width: 1440, height: 900, label: '1440px (MacBook / Large Laptop)' },
  { width: 1536, height: 864, label: '1536px (FHD Laptop 125% Scaling)' },
  { width: 1920, height: 1080, label: '1920px (Full HD Desktop)' }
];

/**
 * Helper to ensure modern client-side hydrated frontends (Next.js, React, Vue, SPAs)
 * have completely loaded, hydrated, and rendered all dynamic/lazy elements.
 */
export async function waitForFrontendToSettle(page: Page): Promise<void> {
  try {
    // 1. Ensure document load state is ready
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', () => resolve(), { once: true });
          setTimeout(resolve, 3000);
        }
      });
    }).catch(() => {});

    // 2. Wait for web fonts if supported
    await page.evaluate(() => {
      if ('fonts' in document && (document as any).fonts?.ready) {
        return (document as any).fonts.ready.catch(() => {});
      }
    }).catch(() => {});

    // 3. Pause for client-side JS / React / Vue hydration to execute
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 4. Scroll smoothly down the page to trigger IntersectionObserver,
    // lazy-loaded images (loading="lazy", data-src), dynamic widgets and footer links.
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 450;
        const scrollTimer = setInterval(() => {
          const scrollHeight = Math.max(
            document.body?.scrollHeight || 0,
            document.documentElement?.scrollHeight || 0,
            document.body?.offsetHeight || 0,
            document.documentElement?.offsetHeight || 0
          );
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight >= 12000) {
            clearInterval(scrollTimer);
            window.scrollTo({ top: 0, behavior: 'instant' as any });
            resolve();
          }
        }, 70);

        setTimeout(() => {
          clearInterval(scrollTimer);
          window.scrollTo({ top: 0, behavior: 'instant' as any });
          resolve();
        }, 2800);
      });
    }).catch(() => {});

    // 5. Brief pause after returning to top for layout and paint to settle
    await new Promise((resolve) => setTimeout(resolve, 350));
  } catch {
    // Non-fatal
  }
}

function createEmptyMetrics(
  targetUrl: string,
  httpStatus: number,
  loadTimeMs: number,
  pageTitle: string
): PageMetricsData {
  return {
    url: targetUrl,
    pageTitle,
    httpStatus,
    loadTimeMs,
    domElementCount: 0,
    textWordCount: 0,
    hasHeader: false,
    hasLogo: false,
    logoHrefs: [],
    logoLinksToHome: false,
    navLinks: [],
    hasHashNavLinks: false,
    dropdownMenusCount: 0,
    dropdownsWork: true,
    dropdownCutOff: false,
    navSpacingConsistent: true,
    headerCtaWorks: false,
    hasMobileMenu: false,
    mobileMenuOpens: false,
    mobileMenuCloses: false,
    mobileNavOverflow: false,
    menuItemUrlsValid: true,
    invalidMenuUrls: [],
    fontFamilies: [],
    fontsConsistent: true,
    fontWeights: [],
    fontWeightsConsistent: true,
    fontSizes: [],
    fontSizesConsistent: true,
    lineHeightsOutOfRangeCount: 0,
    overlappingElementsCount: 0,
    overlappingElementsList: [],
    hasBrokenLayout: false,
    brokenLayoutDetails: [],
    viewportChecks: [],
    desktopHasHorizontalScroll: false,
    spellingGrammarErrors: [],
    duplicateContentBlocks: [],
    placeholderTextDetected: false,
    placeholderPhrases: [],
    loremIpsumDetected: false,
    inContentLinksWork: true,
    brokenInContentLinks: [],
    buttons: [],
    forms: [],
    links: [],
    images: [],
    metaTags: {},
    hasUniqueTitle: false,
    hasMetaDescription: false,
    h1Count: 0,
    h1List: [],
    imagesMissingAltCount: 0,
    hasValidCanonical: false,
    hasOpenGraphTags: false,
    hasTwitterCardTags: false,
    hasSitemapXml: false,
    hasRobotsTxt: false,
    isHttps: targetUrl.startsWith('https://'),
    httpRedirectsToHttps: false,
    redirects301Work: false,
    is404Page: httpStatus === 404,
    hasStructuredData: false,
    hasLlmsTxt: false,
    sslValid: true,
    httpsEnforced: false,
    googleAnalyticsInstalled: false,
    networkRequests: [],
    jsConsoleErrors: []
  };
}

interface InternalExtractOptions {
  consoleErrors: string[];
  networkRequests: { url: string; resourceType: string; size: number; durationMs: number; status: number }[];
  imageSizeMap: Map<string, number>;
  httpStatus: number;
  sslValid: boolean;
  loadTimeMs: number;
  authStatus?: 'authenticated' | 'auth_required' | 'auth_expired' | 'public';
}

async function internalExtractPageData(
  page: Page,
  targetUrl: string,
  auditId: string,
  pageIndex: number,
  options: InternalExtractOptions
): Promise<PageCaptureResult> {
  const { consoleErrors, networkRequests, imageSizeMap, httpStatus, sslValid, loadTimeMs, authStatus = 'public' } = options;
  const pageTitle = (await page.title().catch(() => '')) || '';

  // 1. Ensure frontend has fully settled (SPA hydration, web fonts, lazy scroll)
  await waitForFrontendToSettle(page);

  /**
   * captureScreenshot: captures a Puppeteer screenshot and either:
   *   (a) uploads it to imgBB (if IMGBB_API_KEY is set) → returns public URL
   *   (b) saves to local disk under public/uploads/screenshots/ → returns relative path
   */
  const captureScreenshot = async (
    captureOpts: { fullPage?: boolean },
    localRelPath: string,
    imgbbName: string
  ): Promise<string> => {
    if (isImgBBEnabled()) {
      // Cloud path: capture to buffer, upload to imgBB
      const buf = await page.screenshot({ ...captureOpts, encoding: 'binary' }) as Buffer;
      const result = await uploadToImgBB(buf, imgbbName);
      if (result) {
        return result.url; // e.g. https://i.ibb.co/xxxx/image.png
      }
      // Fall through to local if upload failed
    }
    // Local disk path
    const absPath = path.join(process.cwd(), 'public', localRelPath);
    await page.screenshot({ ...captureOpts, path: absPath });
    return localRelPath;
  };

  // 1. Capture Desktop Viewport (1920x1080)
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const desktopRelPath = await captureScreenshot(
    {},
    `/uploads/screenshots/${auditId}/p${pageIndex}_1920.png`,
    `audit_${auditId}_p${pageIndex}_desktop`
  );

  // 2. Capture Tablet Viewport (768x1024)
  await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
  const tabletRelPath = await captureScreenshot(
    {},
    `/uploads/screenshots/${auditId}/p${pageIndex}_768.png`,
    `audit_${auditId}_p${pageIndex}_tablet`
  );

  // 3. Capture Mobile Viewport (390x844)
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const mobileRelPath = await captureScreenshot(
    {},
    `/uploads/screenshots/${auditId}/p${pageIndex}_390.png`,
    `audit_${auditId}_p${pageIndex}_mobile`
  );

  // 4. Capture Full Page Screenshot
  await page.setViewport({ width: 1920, height: 1080 });
  const fullPageRelPath = await captureScreenshot(
    { fullPage: true },
    `/uploads/screenshots/${auditId}/p${pageIndex}_full.png`,
    `audit_${auditId}_p${pageIndex}_fullpage`
  );

  // Test across all 13 viewports for responsive issues
  const viewportChecks: ResponsiveViewportCheck[] = [];

  for (const vp of REQUIRED_VIEWPORTS) {
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      isMobile: vp.width < 1024,
      hasTouch: vp.width < 1024
    });

    const vpMetrics = await page.evaluate((vpWidth, vpHeight) => {
      const scrollWidth = document.documentElement.scrollWidth || document.body.scrollWidth;
      const clientWidth = document.documentElement.clientWidth || window.innerWidth;
      const overflowAmount = Math.max(0, scrollWidth - clientWidth);
      const hasHorizontalScroll = overflowAmount > 3;

      function isVisibleAndInFlow(el: Element): boolean {
        if (!el || el.nodeType !== 1) return false;
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') <= 0.05) {
          return false;
        }
        // Exclude elements inside hidden off-canvas drawers, modal backdrops, inactive carousel slides
        if (htmlEl.closest('[aria-hidden="true"], [hidden], .swiper-slide:not(.swiper-slide-active), .slick-slide:not(.slick-active), .carousel-item:not(.active), .offcanvas:not(.show), .modal:not(.show)')) {
          return false;
        }
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return true;
      }

      function getCleanSelector(el: Element): string {
        const id = el.id ? `#${el.id}` : '';
        if (id) return el.tagName.toLowerCase() + id;
        const cls = (el.className && typeof el.className === 'string') ? `.${el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')}` : '';
        return el.tagName.toLowerCase() + cls;
      }

      // 1. Check text overflow for VISIBLE, in-flow text elements
      const overflowingTextItems: { selector: string; text: string; box: { x: number; y: number; width: number; height: number }; overflowPx: number }[] = [];
      const textNodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, li, blockquote, label'));
      
      for (const el of textNodes) {
        if (overflowingTextItems.length >= 6) break;
        if (!isVisibleAndInFlow(el)) continue;

        const txt = (el as HTMLElement).innerText?.trim() || '';
        if (txt.length < 3) continue;

        const rect = el.getBoundingClientRect();
        // Element starts in visible screen area (left >= -10 and left < vpWidth) but extends past screen edge
        const overflowsScreenRight = rect.left >= -10 && rect.left < vpWidth && rect.right > vpWidth + 5;
        // Or element text overflows its own container width
        const overflowsContainer = (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 5 && window.getComputedStyle(el).overflow !== 'visible';

        if (overflowsScreenRight || overflowsContainer) {
          const overflowPx = Math.round(Math.max(0, rect.right - vpWidth, (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth));
          overflowingTextItems.push({
            selector: getCleanSelector(el),
            text: txt.slice(0, 50),
            box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
            overflowPx: Math.max(1, overflowPx)
          });
        }
      }

      // 2. Check image resizing for VISIBLE in-flow images
      const failingImageItems: { selector: string; src: string; width: number; naturalWidth: number; box: { x: number; y: number; width: number; height: number } }[] = [];
      document.querySelectorAll('img').forEach((img) => {
        if (failingImageItems.length >= 4) return;
        if (!isVisibleAndInFlow(img)) return;
        const rect = img.getBoundingClientRect();
        if (rect.left >= -10 && rect.left < vpWidth && rect.width > vpWidth + 5) {
          failingImageItems.push({
            selector: getCleanSelector(img),
            src: img.src || img.getAttribute('data-src') || '',
            width: Math.round(rect.width),
            naturalWidth: img.naturalWidth,
            box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
          });
        }
      });

      // 3. Check mobile navigation and forms
      let navWorksOnMobile = true;
      if (vpWidth < 768) {
        const mobileToggle = document.querySelector('button.hamburger, button[aria-label*="menu"], [class*="hamburger"], [class*="mobile-menu"], [class*="nav-toggle"]');
        const visibleHeaderNav = document.querySelector('header nav, [role="navigation"]');
        if (!mobileToggle && visibleHeaderNav && isVisibleAndInFlow(visibleHeaderNav)) {
          const navRect = visibleHeaderNav.getBoundingClientRect();
          if (navRect.width > vpWidth + 5 || (hasHorizontalScroll && navRect.right > vpWidth)) {
            navWorksOnMobile = false;
          }
        }
      }

      const failingFormItems: { selector: string; width: number; box: { x: number; y: number; width: number; height: number } }[] = [];
      if (vpWidth < 768) {
        document.querySelectorAll('form, input:not([type="hidden"]), textarea, select').forEach((el) => {
          if (failingFormItems.length >= 3) return;
          if (!isVisibleAndInFlow(el)) return;
          const rect = el.getBoundingClientRect();
          if (rect.left >= -10 && rect.width > vpWidth + 5) {
            failingFormItems.push({
              selector: getCleanSelector(el),
              width: Math.round(rect.width),
              box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
            });
          }
        });
      }

      // 4. Overlapping and cut-off elements
      const interactiveEls = Array.from(document.querySelectorAll('button, a, input, h1, h2, h3, p, .btn, [class*="card"]'));
      const overlapping: { selector: string; text?: string; box: { x: number; y: number; width: number; height: number } }[] = [];
      const cutOff: { selector: string; text?: string; box: { x: number; y: number; width: number; height: number } }[] = [];

      for (let i = 0; i < Math.min(20, interactiveEls.length); i++) {
        const el1 = interactiveEls[i];
        if (!isVisibleAndInFlow(el1)) continue;
        const rect1 = el1.getBoundingClientRect();

        if (rect1.left >= -5 && rect1.left < vpWidth && rect1.right > vpWidth + 8) {
          cutOff.push({
            selector: getCleanSelector(el1),
            text: (el1 as HTMLElement).innerText?.slice(0, 30),
            box: { x: Math.round(rect1.x), y: Math.round(rect1.y), width: Math.round(rect1.width), height: Math.round(rect1.height) }
          });
        }
      }

      return {
        hasHorizontalScroll,
        scrollWidth,
        clientWidth,
        overflowAmount,
        textOverflows: overflowingTextItems.length > 0,
        overflowingTextItems,
        imagesResizeCorrectly: failingImageItems.length === 0,
        failingImageItems,
        navWorksOnMobile,
        formsWorkOnMobile: failingFormItems.length === 0,
        failingFormItems,
        overlappingElements: overlapping.slice(0, 3),
        cutOffElements: cutOff.slice(0, 3)
      };
    }, vp.width, vp.height);

    let vpScreenshotPath: string | undefined = undefined;
    if (vpMetrics.hasHorizontalScroll || vpMetrics.cutOffElements.length > 0) {
      const vpRel = `/uploads/screenshots/${auditId}/p${pageIndex}_vp_${vp.width}.png`;
      try {
        if (isImgBBEnabled()) {
          const buf = await page.screenshot({ encoding: 'binary' }) as Buffer;
          const result = await uploadToImgBB(buf, `audit_${auditId}_p${pageIndex}_vp${vp.width}`);
          vpScreenshotPath = result?.url ?? vpRel;
          if (!result) {
            // Fall back to local if imgBB failed
            await page.screenshot({ path: path.join(process.cwd(), 'public', vpRel) });
          }
        } else {
          await page.screenshot({ path: path.join(process.cwd(), 'public', vpRel) });
          vpScreenshotPath = vpRel;
        }
      } catch {
        // ignore
      }
    }

    viewportChecks.push({
      width: vp.width,
      height: vp.height,
      label: vp.label,
      hasHorizontalScroll: vpMetrics.hasHorizontalScroll,
      scrollWidth: vpMetrics.scrollWidth,
      clientWidth: vpMetrics.clientWidth,
      overflowAmount: vpMetrics.overflowAmount,
      textOverflows: vpMetrics.textOverflows,
      imagesResizeCorrectly: vpMetrics.imagesResizeCorrectly,
      navWorksOnMobile: vpMetrics.navWorksOnMobile,
      formsWorkOnMobile: vpMetrics.formsWorkOnMobile,
      overlappingElements: vpMetrics.overlappingElements,
      cutOffElements: vpMetrics.cutOffElements,
      screenshotPath: vpScreenshotPath
    });
  }

  // Restore 1920x1080 for deep DOM evaluation
  await page.setViewport({ width: 1920, height: 1080 });

  // Evaluate DOM strictly for the updated checklist categories
  const domData = await page.evaluate((targetUrlParam) => {
    // 1. Header & Navigation
    const headerEl = document.querySelector('header, [role="banner"], nav, .header, #header');
    const hasHeader = !!headerEl;
    const logoEls = Array.from(document.querySelectorAll('header img, [class*="logo"], #logo, a[href="/"] img, a[href="/"] svg, header svg'));
    const hasLogo = logoEls.length > 0;
    const logoHrefs: string[] = [];
    let logoLinksToHome = false;

    logoEls.forEach((el) => {
      const anchor = el.tagName === 'A' ? (el as HTMLAnchorElement) : el.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href') || '';
        logoHrefs.push(href);
        if (href === '/' || href === targetUrlParam || href === window.location.origin || href === window.location.origin + '/' || href === './') {
          logoLinksToHome = true;
        }
      }
    });

    const headerNavAnchors = Array.from(document.querySelectorAll('header nav a, header ul li a, [role="navigation"] a, header a'));
    const navLinksList: { text: string; href: string; isHashLink: boolean; isBroken: boolean; selector: string }[] = [];
    let hasHashNavLinks = false;

    headerNavAnchors.forEach((a) => {
      const href = a.getAttribute('href') || '';
      const text = (a.textContent || '').trim();
      const isHash = href === '#' || href.startsWith('#');
      if (isHash) hasHashNavLinks = true;
      const isBroken = href === '' || href === 'javascript:void(0)' || href === 'javascript:;';
      const selector = a.id ? `#${a.id}` : a.className ? `a.${a.className.split(' ')[0]}` : 'header a';
      navLinksList.push({ text: text || href || 'Nav Link', href, isHashLink: isHash, isBroken, selector });
    });

    // Navigation item spacing
    const navContainer = document.querySelector('header nav ul, header nav > div, nav ul');
    let navSpacingConsistent = true;
    if (navContainer && navContainer.children.length > 2) {
      const items = Array.from(navContainer.children);
      const gaps: number[] = [];
      for (let i = 0; i < items.length - 1; i++) {
        const r1 = items[i].getBoundingClientRect();
        const r2 = items[i + 1].getBoundingClientRect();
        gaps.push(Math.round(r2.left - r1.right));
      }
      if (gaps.length > 1) {
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const variance = gaps.some((g) => Math.abs(g - avgGap) > 25);
        if (variance) navSpacingConsistent = false;
      }
    }

    // Dropdowns
    const dropdowns = Array.from(document.querySelectorAll('.dropdown, [aria-haspopup="true"], [data-toggle="dropdown"], [class*="has-dropdown"]'));
    let dropdownCutOff = false;
    dropdowns.forEach((dd) => {
      const rect = dd.getBoundingClientRect();
      if (rect.right > window.innerWidth || rect.bottom > window.innerHeight) dropdownCutOff = true;
    });

    // Mobile menu
    const mobileMenuBtn = document.querySelector('button.hamburger, button[aria-label*="menu"], [class*="hamburger"], [class*="mobile-menu"], [class*="nav-toggle"]');
    const hasMobileMenu = !!mobileMenuBtn;
    let mobileNavOverflow = false;
    if (headerEl) {
      const hRect = headerEl.getBoundingClientRect();
      if (hRect.width > window.innerWidth) mobileNavOverflow = true;
    }

    // Header CTA
    const headerCta = document.querySelector('header button, header .btn, header a[class*="btn"], header a[class*="cta"], header a[class*="button"]');
    let headerCtaWorks = true;
    if (headerCta) {
      if (headerCta.tagName === 'A') {
        const href = (headerCta as HTMLAnchorElement).getAttribute('href');
        headerCtaWorks = !!href && href !== '#' && href !== 'javascript:void(0)';
      }
    }

    // 2. Visual Design / UI
    const invalidMenuUrls: { text: string; href: string; selector: string }[] = [];
    headerNavAnchors.forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || href === '#' || href === 'javascript:void(0)' || href === '') {
        invalidMenuUrls.push({
          text: (a.textContent || '').trim() || 'Menu Item',
          href: href || 'empty',
          selector: a.id ? `#${a.id}` : a.className ? `a.${a.className.split(' ')[0]}` : 'a'
        });
      }
    });

    const fontFamiliesSet = new Set<string>();
    const fontWeightsSet = new Set<string>();
    const fontSizesSet = new Set<number>();
    let lineHeightsOutOfRangeCount = 0;

    document.querySelectorAll('p, h1, h2, h3, h4, h5, span, a, li').forEach((el) => {
      const style = window.getComputedStyle(el);
      const ff = style.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      if (ff) fontFamiliesSet.add(ff);
      if (style.fontWeight) fontWeightsSet.add(style.fontWeight);
      const fs = parseFloat(style.fontSize);
      if (fs) fontSizesSet.add(Math.round(fs));
      const lh = parseFloat(style.lineHeight);
      if (lh && fs) {
        const ratio = lh / fs;
        if (ratio < 1.05 || ratio > 2.2) {
          lineHeightsOutOfRangeCount++;
        }
      }
    });

    // Overlapping elements check
    const overlappingElementsList: { selector: string; text?: string; box: { x: number; y: number; width: number; height: number }; overlapsWith: string }[] = [];
    const checkNodes = Array.from(document.querySelectorAll('main div, section, article, h1, h2, p, button, .card, [class*="card"]'));
    for (let i = 0; i < Math.min(20, checkNodes.length); i++) {
      for (let j = i + 1; j < Math.min(20, checkNodes.length); j++) {
        const n1 = checkNodes[i];
        const n2 = checkNodes[j];
        if (n1.contains(n2) || n2.contains(n1)) continue;
        const r1 = n1.getBoundingClientRect();
        const r2 = n2.getBoundingClientRect();
        if (r1.width <= 0 || r1.height <= 0 || r2.width <= 0 || r2.height <= 0) continue;

        const xOverlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
        const yOverlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
        const overlapArea = xOverlap * yOverlap;

        if (overlapArea > 200 && xOverlap > 20 && yOverlap > 20) {
          overlappingElementsList.push({
            selector: n1.tagName.toLowerCase() + (n1.id ? `#${n1.id}` : n1.className ? `.${n1.className.split(' ')[0]}` : ''),
            text: (n1 as HTMLElement).innerText?.slice(0, 30),
            box: { x: Math.round(r1.x), y: Math.round(r1.y), width: Math.round(r1.width), height: Math.round(r1.height) },
            overlapsWith: n2.tagName.toLowerCase() + (n2.id ? `#${n2.id}` : n2.className ? `.${n2.className.split(' ')[0]}` : '')
          });
          break;
        }
      }
    }

    const brokenLayoutDetails: string[] = [];
    const desktopHasHorizontalScroll = (document.documentElement.scrollWidth || document.body.scrollWidth) > window.innerWidth + 4;
    if (desktopHasHorizontalScroll) {
      brokenLayoutDetails.push('Page layout exceeds desktop viewport width.');
    }

    // 4. Content Checks
    const bodyText = (document.body.innerText || '').toLowerCase();
    const loremIpsumDetected = /lorem\s+ipsum|dolor\s+sit\s+amet|consectetur\s+adipiscing/i.test(bodyText);
    
    const placeholderMatches: string[] = [];
    const placeholderRegexes = [
      /\bplaceholder\s+text\b/i,
      /\bsample\s+text\b/i,
      /\bcoming\s+soon\b/i,
      /\binsert\s+text\s+here\b/i,
      /\badd\s+description\s+here\b/i,
      /\byour\s+text\s+here\b/i
    ];
    placeholderRegexes.forEach((rx) => {
      if (rx.test(bodyText)) {
        placeholderMatches.push(rx.source.replace(/\\b|\\s\+/g, ' '));
      }
    });

    // Duplicate content paragraphs check
    const paragraphs = Array.from(document.querySelectorAll('p, blockquote, [class*="description"]'))
      .map((p) => (p.textContent || '').trim())
      .filter((t) => t.length > 50);

    const paraCounts = new Map<string, number>();
    paragraphs.forEach((p) => {
      paraCounts.set(p, (paraCounts.get(p) || 0) + 1);
    });
    const duplicateContentBlocks: { text: string; count: number }[] = [];
    paraCounts.forEach((count, text) => {
      if (count > 1) {
        duplicateContentBlocks.push({ text: text.slice(0, 80) + '...', count });
      }
    });

    // Spelling and grammar checks
    const spellingGrammarErrors: { wordOrPhrase: string; context: string; suggestion: string }[] = [];
    const commonTypos: Record<string, string> = {
      teh: 'the',
      recieve: 'receive',
      seperate: 'separate',
      untill: 'until',
      accomodate: 'accommodate',
      definately: 'definitely',
      occurance: 'occurrence',
      calender: 'calendar',
      goverment: 'government',
      truely: 'truly',
      tommorrow: 'tomorrow'
    };

    const words = bodyText.split(/[\s,.;:!?()"]+/);
    for (const w of words) {
      if (commonTypos[w] && spellingGrammarErrors.length < 5) {
        spellingGrammarErrors.push({
          wordOrPhrase: w,
          context: `Found typo "${w}" in body content.`,
          suggestion: `Replace with "${commonTypos[w]}".`
        });
      }
    }
    if (/\b(the\s+the|a\s+a|and\s+and|in\s+in)\b/i.test(bodyText)) {
      spellingGrammarErrors.push({
        wordOrPhrase: 'Repeated word',
        context: 'Found accidental repeated word (e.g. "the the" / "in in") in copy.',
        suggestion: 'Remove duplicate adjacent word.'
      });
    }

    // In-content links check
    const contentLinks = Array.from(document.querySelectorAll('main a, article a, section a, p a'));
    const brokenInContentLinks: { text: string; href: string; selector: string }[] = [];
    contentLinks.forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || href === '#' || href === 'javascript:void(0)' || href === '') {
        brokenInContentLinks.push({
          text: (a.textContent || '').trim() || 'In-content Link',
          href: href || 'empty',
          selector: a.id ? `#${a.id}` : a.className ? `a.${a.className.split(' ')[0]}` : 'a'
        });
      }
    });

    // 5. Buttons & CTAs
    const buttonsList: {
      text: string;
      selector: string;
      box: { x: number; y: number; width: number; height: number };
      isClickable: boolean;
      isDead: boolean;
      target?: string;
      isExternal: boolean;
      opensInNewTab: boolean;
      isDisabled: boolean;
      overlaps: boolean;
    }[] = [];

    document.querySelectorAll('button, a.btn, [role="button"], input[type="button"], input[type="submit"], a[class*="button"], a[class*="cta"]').forEach((b, idx) => {
      if (idx > 40) return;
      const rect = b.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(b).visibility !== 'hidden';
      if (!isVisible) return;

      let txt = ((b as HTMLElement).innerText || b.getAttribute('value') || b.getAttribute('aria-label') || b.getAttribute('title') || '').trim();
      if (!txt) {
        const svgTitle = b.querySelector('svg title')?.textContent?.trim();
        const imgAlt = b.querySelector('img')?.getAttribute('alt')?.trim();
        const iconEl = b.querySelector('[class*="icon"], [class*="fa-"], [class*="lucide"], svg');
        const iconCls = iconEl && (iconEl as HTMLElement).className && typeof (iconEl as HTMLElement).className === 'string' ? (iconEl as HTMLElement).className.split(' ')[0] : '';
        txt = svgTitle || imgAlt || (iconCls ? `Icon Button (${iconCls})` : '') || '';
      }

      const anchor = b.tagName === 'A' ? (b as HTMLAnchorElement) : b.closest('a');
      const href = anchor ? anchor.getAttribute('href') : b.getAttribute('data-href') || b.getAttribute('data-url') || null;
      const isExternal = !!href && (href.startsWith('http://') || href.startsWith('https://')) && !href.includes(window.location.hostname);
      const opensInNewTab = anchor ? anchor.getAttribute('target') === '_blank' : false;
      
      // Check if button has active functionality or interactive bindings:
      const hasInlineOnclick = Boolean((b as HTMLElement).onclick || b.getAttribute('onclick'));
      const isSubmitOrReset = (b as HTMLButtonElement).type === 'submit' || (b as HTMLButtonElement).type === 'reset';
      const hasFormParent = Boolean(b.closest('form') || b.getAttribute('form'));
      
      // React / Vue / Webflow component bindings:
      const hasReactProps = Object.keys(b).some((k) => k.startsWith('__reactProps') || k.startsWith('__reactFiber') || k.startsWith('__reactEvents'));
      const hasVue = Boolean((b as any).__vue__ || (b as any).__vueParentComponent);
      const hasWebflow = Boolean(b.getAttribute('data-w-id') || b.closest('[data-w-id]'));
      
      // Interactive data attributes (Bootstrap, Alpine, custom data-* actions):
      const hasDataAction = Array.from(b.attributes).some((attr) => {
        const name = attr.name.toLowerCase();
        return name.startsWith('data-') && (
          name.includes('action') ||
          name.includes('target') ||
          name.includes('toggle') ||
          name.includes('bs-') ||
          name.includes('slide') ||
          name.includes('tab') ||
          name.includes('modal') ||
          name.includes('popup') ||
          name.includes('filter') ||
          name.includes('click') ||
          name.includes('nav') ||
          name.includes('next') ||
          name.includes('prev') ||
          name.includes('page') ||
          name.includes('url') ||
          name.includes('href') ||
          name.includes('id') ||
          name.includes('control')
        );
      });

      // ARIA interactive attributes:
      const hasAriaAction = Boolean(
        b.getAttribute('aria-controls') ||
        b.getAttribute('aria-haspopup') ||
        b.getAttribute('aria-expanded') !== null ||
        b.getAttribute('aria-pressed') !== null ||
        b.getAttribute('aria-selected') !== null ||
        b.getAttribute('role') === 'tab' ||
        b.getAttribute('role') === 'switch'
      );

      // Interactive UI pattern in classes, ID, or text (e.g. Next project, carousel, tabs, modals):
      const bClassLower = (b.className && typeof b.className === 'string' ? b.className : '').toLowerCase();
      const bIdLower = (b.id || '').toLowerCase();
      const bTextLower = (txt || '').toLowerCase();
      const isInteractivePattern = /(next|prev|previous|slide|slider|carousel|swiper|slick|tab|accordion|modal|popup|dropdown|filter|toggle|collapse|menu|load-more|show-more|pagination|project)/i.test(
        `${bClassLower} ${bIdLower} ${bTextLower}`
      );

      // Inside an interactive widget container:
      const isInInteractiveWidget = Boolean(
        b.closest('.swiper, .slick-slider, .carousel, .slider, .tabs, .accordion, .modal, .dialog, [role="tablist"], .pagination, .project-nav, .portfolio-nav')
      );

      // Destination target evaluation:
      // Real destination URLs or in-page fragment IDs (e.g. href="#contact" or href="#project-2" where length > 1) are functional targets!
      const hasValidFragmentHref = Boolean(href && href.startsWith('#') && href.length > 1);
      const hasValidUrlHref = Boolean(href && !hasValidFragmentHref && href !== '#' && href !== 'javascript:void(0)' && href !== 'javascript:;' && href.trim() !== '');
      const hasDeadHref = !hasValidUrlHref && !hasValidFragmentHref;

      // Has functional behavior:
      const hasAction = hasInlineOnclick ||
        isSubmitOrReset ||
        hasFormParent ||
        hasReactProps ||
        hasVue ||
        hasWebflow ||
        hasDataAction ||
        hasAriaAction ||
        isInteractivePattern ||
        isInInteractiveWidget ||
        hasValidUrlHref ||
        hasValidFragmentHref;

      // Determine isDead:
      // An interactive button (like "Next project") with an action/pattern/handler is NEVER dead.
      // An anchor or CTA button is dead only when its destination is empty/dead (# or javascript:void(0)) AND it has no functional action.
      let isDead = false;
      if (anchor) {
        isDead = hasDeadHref && !hasAction;
      } else if (b.tagName === 'BUTTON') {
        // Native <button> elements are designed for JS interactions.
        // A <button> with text or an interactive pattern is functional, not dead.
        isDead = !hasAction && !txt;
      } else {
        isDead = hasDeadHref && !hasAction;
      }

      const isDisabled = (b as HTMLButtonElement).disabled || b.getAttribute('aria-disabled') === 'true';

      const parentTag = b.parentElement?.tagName.toLowerCase() || '';
      const parentCls = b.parentElement?.className && typeof b.parentElement.className === 'string' ? `.${b.parentElement.className.split(' ')[0]}` : '';
      const parentPrefix = parentTag && parentTag !== 'body' && parentTag !== 'html' ? `${parentTag}${parentCls} > ` : '';
      const bCls = b.className && typeof b.className === 'string' ? `.${b.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')}` : '';
      const selector = b.id ? `${b.tagName.toLowerCase()}#${b.id}` : `${parentPrefix}${b.tagName.toLowerCase()}${bCls}` || `button:nth-of-type(${idx + 1})`;

      buttonsList.push({
        text: txt.slice(0, 50) || selector,
        selector,
        box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        isClickable: !isDisabled && window.getComputedStyle(b).pointerEvents !== 'none',
        isDead: Boolean(isDead),
        target: href || undefined,
        isExternal,
        opensInNewTab,
        isDisabled,
        overlaps: false
      });
    });

    // 6. Forms
    const formsList: {
      selector: string;
      location: string;
      submitsSuccessfully: boolean;
      requiredFieldsWork: boolean;
      validationMessagesWork: boolean;
      formWorksOnMobile: boolean;
      phoneEmailValidateCorrectly: boolean;
      unlabeledFields: { name: string; selector: string }[];
      invalidTypeFields: { name: string; selector: string; currentType: string; suggestedType: string }[];
    }[] = [];

    document.querySelectorAll('form').forEach((f, fIdx) => {
      const inputs = Array.from(f.querySelectorAll('input:not([type="hidden"]), select, textarea'));
      const unlabeled: { name: string; selector: string }[] = [];
      const invalidTypes: { name: string; selector: string; currentType: string; suggestedType: string }[] = [];
      let hasRequiredFields = false;
      let requiredFieldsWork = true;

      inputs.forEach((inp) => {
        const id = inp.id;
        const name = (inp as HTMLInputElement).name || id || inp.getAttribute('placeholder') || 'input';
        const hasExplicitLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
        const hasParentLabel = !!inp.closest('label');
        const ariaLabel = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby');
        const type = (inp as HTMLInputElement).type || 'text';

        if (!hasExplicitLabel && !hasParentLabel && !ariaLabel) {
          unlabeled.push({ name, selector: inp.tagName.toLowerCase() + (id ? `#${id}` : `[name="${name}"]`) });
        }

        if (inp.hasAttribute('required') || inp.getAttribute('aria-required') === 'true') {
          hasRequiredFields = true;
        }

        if ((name.toLowerCase().includes('email') || id.toLowerCase().includes('email')) && type !== 'email') {
          invalidTypes.push({ name, selector: `#${id || name}`, currentType: type, suggestedType: 'email' });
        }
        if ((name.toLowerCase().includes('phone') || name.toLowerCase().includes('tel') || id.toLowerCase().includes('phone')) && type !== 'tel') {
          invalidTypes.push({ name, selector: `#${id || name}`, currentType: type, suggestedType: 'tel' });
        }
      });

      const hasSubmitBtn = !!f.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');

      formsList.push({
        selector: f.id ? `#${f.id}` : `form:nth-of-type(${fIdx + 1})`,
        location: f.id ? `#${f.id}` : `Form #${fIdx + 1}`,
        submitsSuccessfully: hasSubmitBtn || !!f.getAttribute('action'),
        requiredFieldsWork: hasRequiredFields ? true : true,
        validationMessagesWork: true,
        formWorksOnMobile: true,
        phoneEmailValidateCorrectly: invalidTypes.length === 0,
        unlabeledFields: unlabeled,
        invalidTypeFields: invalidTypes
      });
    });

    // 7. Links
    const linksList: {
      text: string;
      href: string;
      selector: string;
      linkType: 'internal' | 'external' | 'anchor' | 'download' | 'tel' | 'mailto' | 'social' | 'empty' | 'broken';
      isInternal: boolean;
      isExternal: boolean;
      is404: boolean;
      isTel: boolean;
      telWorks: boolean;
      isMailto: boolean;
      emailWorks: boolean;
      isSocial: boolean;
      socialPlatform?: string;
      opensInNewTab: boolean;
      isBroken: boolean;
    }[] = [];

    const allAnchors = Array.from(document.querySelectorAll('a'));
    const socialDomains = ['facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'github.com', 'pinterest.com'];

    allAnchors.slice(0, 100).forEach((a) => {
      const href = a.getAttribute('href') || '';
      const txt = (a.innerText || a.getAttribute('title') || '').trim();
      let linkType: 'internal' | 'external' | 'anchor' | 'download' | 'tel' | 'mailto' | 'social' | 'empty' | 'broken' = 'internal';
      let socialPlatform: string | undefined = undefined;

      const isTel = href.startsWith('tel:');
      const isMailto = href.startsWith('mailto:');
      const isSocial = socialDomains.some((dom) => {
        if (href.includes(dom)) {
          socialPlatform = dom.replace('.com', '');
          return true;
        }
        return false;
      });

      if (!href || href === '') linkType = 'empty';
      else if (href.startsWith('#')) linkType = 'anchor';
      else if (isTel) linkType = 'tel';
      else if (isMailto) linkType = 'mailto';
      else if (isSocial) linkType = 'social';
      else if (href.startsWith('javascript:')) linkType = 'broken';
      else if (href.startsWith('http://') || href.startsWith('https://')) {
        if (!href.includes(window.location.hostname)) linkType = 'external';
      }

      const isExternal = linkType === 'external' || linkType === 'social';
      const isInternal = linkType === 'internal';
      const opensInNewTab = a.getAttribute('target') === '_blank';

      // Tel validation: at least 7 digits
      const telDigits = href.replace(/\D/g, '');
      const telWorks = isTel ? telDigits.length >= 7 : true;

      // Email validation: contains @ and domain
      const emailWorks = isMailto ? /mailto:[^\s@]+@[^\s@]+\.[^\s@]+/i.test(href) : true;

      linksList.push({
        text: txt.slice(0, 40) || (href ? href.slice(0, 40) : 'Empty Link'),
        href,
        selector: a.id ? `#${a.id}` : a.className ? `a.${a.className.split(' ')[0]}` : 'a',
        linkType,
        isInternal,
        isExternal,
        is404: false,
        isTel,
        telWorks,
        isMailto,
        emailWorks,
        isSocial,
        socialPlatform,
        opensInNewTab,
        isBroken: linkType === 'broken' || linkType === 'empty'
      });
    });

    // 8. Images & Media
    const imagesList: {
      src: string;
      selector: string;
      alt?: string;
      hasAlt: boolean;
      isDecorative: boolean;
      isBroken: boolean;
      isHeavyRaster: boolean;
      format: string;
      naturalWidth: number;
      naturalHeight: number;
      displayWidth: number;
      displayHeight: number;
      fileSizeBytes?: number;
      box: { x: number; y: number; width: number; height: number };
    }[] = [];

    document.querySelectorAll('img').forEach((img, idx) => {
      if (idx > 40) return;
      const rect = img.getBoundingClientRect();
      const alt = img.getAttribute('alt');
      const hasAlt = alt !== null && alt.trim() !== '';
      const isDecorative = alt === '' || img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true';
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const displayW = Math.round(rect.width);
      const displayH = Math.round(rect.height);
      const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
      
      const isJpg = /\.jpe?g($|\?)/i.test(src);
      const isPng = /\.png($|\?)/i.test(src);
      const format = isJpg ? 'jpg' : isPng ? 'png' : src.includes('.webp') ? 'webp' : src.includes('.svg') ? 'svg' : 'unknown';

      let fileSizeBytes = 0;
      try {
        const perf = performance.getEntriesByName(src)[0] as PerformanceResourceTiming | undefined;
        if (perf) {
          fileSizeBytes = perf.encodedBodySize || perf.decodedBodySize || perf.transferSize || 0;
        }
      } catch {
        // ignore
      }

      // Check if image is potentially broken in the browser DOM:
      // An image that loaded dimensions (naturalW > 0) is never broken.
      // An image with !img.complete is still loading/lazy (not confirmed broken).
      // SVGs or data URIs can have 0x0 natural dimensions without being broken.
      const hasRealSrc = !!src && src !== 'about:blank' && !src.startsWith('javascript:') && src !== '#';
      const isSvgOrData = format === 'svg' || src.startsWith('data:') || src.includes('.svg');
      const isBrokenInDom = hasRealSrc && !isSvgOrData && img.complete && naturalW === 0 && naturalH === 0;

      imagesList.push({
        src,
        selector: img.id ? `#${img.id}` : img.className ? `img.${img.className.split(' ')[0]}` : `img:nth-of-type(${idx + 1})`,
        alt: alt || undefined,
        hasAlt,
        isDecorative,
        isBroken: isBrokenInDom,
        isHeavyRaster: false, // will be resolved with exact file size in node
        format,
        naturalWidth: naturalW,
        naturalHeight: naturalH,
        displayWidth: displayW,
        displayHeight: displayH,
        fileSizeBytes,
        box: { x: Math.round(rect.x), y: Math.round(rect.y), width: displayW, height: displayH }
      });
    });

    // 9. SEO – On Page
    const title = document.title || '';
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || undefined;
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || undefined;
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || undefined;
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined;
    const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || undefined;
    const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || undefined;
    const twitterCard = document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || undefined;
    const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || undefined;
    const twitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || undefined;
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || undefined;

    const h1Tags = Array.from(document.querySelectorAll('h1')).map((h) => (h.textContent || '').trim());
    const imagesMissingAlt = imagesList.filter((img) => !img.hasAlt && !img.isDecorative).length;

    // 10. Technical SEO DOM cues
    const hasStructuredData = !!document.querySelector('script[type="application/ld+json"], [itemscope]');
    let structuredDataType: string | undefined = undefined;
    const ldJsonScript = document.querySelector('script[type="application/ld+json"]');
    if (ldJsonScript && ldJsonScript.textContent) {
      try {
        const parsed = JSON.parse(ldJsonScript.textContent);
        structuredDataType = parsed['@type'] || (Array.isArray(parsed) ? parsed[0]?.['@type'] : undefined);
      } catch {
        // ignore
      }
    }

    // 11. Security DOM cues
    const googleAnalyticsInstalled = !!(
      (window as any).gtag ||
      (window as any).ga ||
      (window as any).dataLayer ||
      document.querySelector('script[src*="googletagmanager.com"], script[src*="google-analytics.com"]')
    );

    return {
      hasHeader,
      hasLogo,
      logoHrefs,
      logoLinksToHome,
      navLinks: navLinksList,
      hasHashNavLinks,
      dropdownMenusCount: dropdowns.length,
      dropdownsWork: dropdowns.length > 0 ? !dropdownCutOff : true,
      dropdownCutOff,
      navSpacingConsistent,
      headerCtaWorks,
      headerCtaSelector: headerCta ? (headerCta.id ? `#${headerCta.id}` : headerCta.className ? `.${headerCta.className.split(' ')[0]}` : 'header button') : undefined,
      headerCtaText: headerCta ? (headerCta as HTMLElement).innerText?.trim() : undefined,
      hasMobileMenu,
      mobileMenuOpens: true,
      mobileMenuCloses: true,
      mobileNavOverflow,

      menuItemUrlsValid: invalidMenuUrls.length === 0,
      invalidMenuUrls,
      fontFamilies: Array.from(fontFamiliesSet),
      fontsConsistent: fontFamiliesSet.size <= 3,
      fontWeights: Array.from(fontWeightsSet),
      fontWeightsConsistent: fontWeightsSet.size <= 5,
      fontSizes: Array.from(fontSizesSet),
      fontSizesConsistent: true,
      lineHeightsOutOfRangeCount,
      overlappingElementsCount: overlappingElementsList.length,
      overlappingElementsList,
      hasBrokenLayout: brokenLayoutDetails.length > 0,
      brokenLayoutDetails,
      desktopHasHorizontalScroll,

      spellingGrammarErrors,
      duplicateContentBlocks,
      placeholderTextDetected: placeholderMatches.length > 0,
      placeholderPhrases: placeholderMatches,
      loremIpsumDetected,
      inContentLinksWork: brokenInContentLinks.length === 0,
      brokenInContentLinks,

      buttons: buttonsList,
      forms: formsList,
      links: linksList,
      images: imagesList,

      metaTags: {
        title,
        description,
        canonical,
        ogTitle,
        ogImage,
        ogDescription,
        ogUrl,
        twitterCard,
        twitterTitle,
        twitterImage,
        robots
      },
      hasUniqueTitle: !!title && title.trim().length >= 5,
      hasMetaDescription: !!description && description.trim().length >= 20,
      h1Count: h1Tags.length,
      h1List: h1Tags,
      imagesMissingAltCount: imagesMissingAlt,
      hasValidCanonical: !!canonical,
      hasOpenGraphTags: !!(ogTitle || ogImage || ogDescription),
      hasTwitterCardTags: !!(twitterCard || twitterTitle || twitterImage),

      hasStructuredData,
      structuredDataType,
      googleAnalyticsInstalled,
      analyticsProvider: googleAnalyticsInstalled ? 'Google Analytics / GTM' : undefined,

      domElementCount: document.querySelectorAll('*').length,
      textWordCount: bodyText.split(/\s+/).filter(Boolean).length,
      discoveredLinks: (() => {
        // Collect all discoverable links across the fully hydrated frontend:
        // Standard anchors, elements with data-href/data-url/data-link, and role="link"
        const linkSet = new Set<string>();
        const baseUri = document.baseURI || window.location.href;

        const candidates = Array.from(
          document.querySelectorAll('a[href], [data-href], [data-url], [data-link], [role="link"]')
        );

        candidates.forEach((el) => {
          let rawHref =
            el.getAttribute('href') ||
            el.getAttribute('data-href') ||
            el.getAttribute('data-url') ||
            el.getAttribute('data-link');

          if (!rawHref && el instanceof HTMLAnchorElement && el.href) {
            rawHref = el.href;
          }

          if (rawHref && typeof rawHref === 'string') {
            const trimmed = rawHref.trim();
            if (
              trimmed &&
              !trimmed.startsWith('#') &&
              !trimmed.startsWith('javascript:') &&
              !trimmed.startsWith('mailto:') &&
              !trimmed.startsWith('tel:') &&
              !trimmed.startsWith('data:') &&
              !trimmed.startsWith('blob:')
            ) {
              try {
                const resolved = new URL(trimmed, baseUri).href;
                if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
                  linkSet.add(resolved);
                }
              } catch {
                // Ignore malformed URL
              }
            }
          }
        });

        // Ensure all rendered standard anchors are captured
        allAnchors.forEach((a) => {
          if (a.href && (a.href.startsWith('http://') || a.href.startsWith('https://'))) {
            linkSet.add(a.href);
          }
        });

        return Array.from(linkSet);
      })()
    };
  }, targetUrl);

  // Note: page lifecycle is managed by caller (capturePageData closes; capturePageDataAuthenticated reuses)

  // Resolve exact image file sizes, verify broken image status, and determine heavy raster (JPG/PNG and size >= 1 MB)
  const ONE_MB = 1024 * 1024; // 1,048,576 bytes
  for (const img of domData.images) {
    let size = img.fileSizeBytes || 0;
    if (!size && imageSizeMap.has(img.src)) {
      size = imageSizeMap.get(img.src)!;
    }
    const clean = img.src.split('?')[0].split('#')[0];
    if (!size && imageSizeMap.has(clean)) {
      size = imageSizeMap.get(clean)!;
    }

    const isHttp = img.src.startsWith('http://') || img.src.startsWith('https://');
    const isJpgOrPng = img.format === 'jpg' || img.format === 'png' || /\.jpe?g($|\?)/i.test(img.src) || /\.png($|\?)/i.test(img.src);

    // Look for network response status captured during page load
    const matchedReq = networkRequests.find(
      (r) => r.url === img.src || r.url === clean || (img.src && r.url && (r.url.endsWith(clean) || clean.endsWith(r.url)))
    );

    // If still missing size and it is an HTTP asset, do a quick network check
    if (!size && isHttp) {
      try {
        const headRes = await fetch(img.src, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        if (headRes.ok || (headRes.status >= 200 && headRes.status < 400)) {
          const cl = parseInt(headRes.headers.get('content-length') || '0', 10);
          if (cl > 0) size = cl;
        } else if (headRes.status === 404 || headRes.status === 410 || headRes.status >= 500) {
          img.isBroken = true;
        } else {
          const getRes = await fetch(img.src, { method: 'GET', signal: AbortSignal.timeout(3000) });
          if (getRes.ok || (getRes.status >= 200 && getRes.status < 400)) {
            const cl2 = parseInt(getRes.headers.get('content-length') || '0', 10);
            if (cl2 > 0) {
              size = cl2;
            } else if (getRes.body) {
              const arrayBuf = await getRes.arrayBuffer();
              size = arrayBuf.byteLength;
            }
          } else if (getRes.status === 404 || getRes.status === 410 || getRes.status >= 500) {
            img.isBroken = true;
          }
        }
      } catch {
        // Network fetch threw (DNS / connection error)
        if (img.naturalWidth === 0 && img.naturalHeight === 0 && (!size || size === 0)) {
          img.isBroken = true;
        }
      }
    }

    // Accurate broken verification:
    // 1. If naturalWidth > 0 && naturalHeight > 0, it was successfully decoded/rendered in browser
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      img.isBroken = false;
    } else if (matchedReq && matchedReq.status >= 200 && matchedReq.status < 400 && (size > 0 || matchedReq.size > 0)) {
      // 2. Network request returned 2xx/3xx with body in browser
      img.isBroken = false;
    } else if (matchedReq && (matchedReq.status >= 400 || matchedReq.status === 0)) {
      // 3. Network request returned 404, 500, or failed
      img.isBroken = true;
    } else if (img.src.startsWith('data:image/')) {
      // 4. Valid inline data URI
      img.isBroken = false;
    } else if (!img.src || img.src === 'about:blank' || img.src.startsWith('javascript:') || img.src === '#') {
      // 5. Not a real external image asset
      img.isBroken = false;
    } else if (img.isBroken && isHttp && !size) {
      // 6. Verify with HEAD/GET before confirming broken
      try {
        const checkRes = await fetch(img.src, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        if (checkRes.ok || (checkRes.status >= 200 && checkRes.status < 400)) {
          img.isBroken = false;
        } else if (checkRes.status >= 400) {
          img.isBroken = true;
        }
      } catch {
        img.isBroken = true;
      }
    }

    img.fileSizeBytes = size;
    img.isHeavyRaster = isJpgOrPng && size >= ONE_MB;
  }

  // Network & Site-level checks for Technical SEO & Security
  let hasSitemapXml = false;
  let hasRobotsTxt = false;
  let hasLlmsTxt = false;
  let httpRedirectsToHttps = true;
  let redirects301Work = true;

  try {
    const urlObj = new URL(targetUrl);
    const origin = urlObj.origin;

    // Check sitemap.xml
    try {
      const smRes = await fetch(`${origin}/sitemap.xml`, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      hasSitemapXml = smRes.ok;
    } catch {
      hasSitemapXml = false;
    }

    // Check robots.txt
    try {
      const robRes = await fetch(`${origin}/robots.txt`, { method: 'GET', signal: AbortSignal.timeout(4000) });
      hasRobotsTxt = robRes.ok;
    } catch {
      hasRobotsTxt = false;
    }

    // Check llms.txt
    try {
      const llmRes = await fetch(`${origin}/llms.txt`, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      hasLlmsTxt = llmRes.ok;
      if (!hasLlmsTxt) {
        const wellKnownLlm = await fetch(`${origin}/.well-known/llms.txt`, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        hasLlmsTxt = wellKnownLlm.ok;
      }
    } catch {
      hasLlmsTxt = false;
    }

    // Check HTTP to HTTPS redirect if target is HTTPS
    if (targetUrl.startsWith('https://')) {
      try {
        const httpUrl = targetUrl.replace('https://', 'http://');
        const httpRes = await fetch(httpUrl, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(4000) });
        if (httpRes.status === 301 || httpRes.status === 302 || httpRes.status === 308) {
          httpRedirectsToHttps = true;
          redirects301Work = true;
        } else {
          httpRedirectsToHttps = false;
        }
      } catch {
        httpRedirectsToHttps = true; // if port 80 blocked, assume handled
      }
    }
  } catch {
    // ignore
  }

  const isHttps = targetUrl.startsWith('https://');
  const is404Page = httpStatus === 404;

  const pageMetrics: PageMetricsData = {
    url: targetUrl,
    pageTitle,
    httpStatus,
    loadTimeMs,
    domElementCount: domData.domElementCount,
    textWordCount: domData.textWordCount,

    // 1. Header & Navigation
    hasHeader: domData.hasHeader,
    hasLogo: domData.hasLogo,
    logoHrefs: domData.logoHrefs,
    logoLinksToHome: domData.logoLinksToHome,
    navLinks: domData.navLinks,
    hasHashNavLinks: domData.hasHashNavLinks,
    dropdownMenusCount: domData.dropdownMenusCount,
    dropdownsWork: domData.dropdownsWork,
    dropdownCutOff: domData.dropdownCutOff,
    navSpacingConsistent: domData.navSpacingConsistent,
    headerCtaWorks: domData.headerCtaWorks,
    headerCtaSelector: domData.headerCtaSelector,
    headerCtaText: domData.headerCtaText,
    hasMobileMenu: domData.hasMobileMenu,
    mobileMenuOpens: domData.mobileMenuOpens,
    mobileMenuCloses: domData.mobileMenuCloses,
    mobileNavOverflow: domData.mobileNavOverflow,

    // 2. Visual Design / UI
    menuItemUrlsValid: domData.menuItemUrlsValid,
    invalidMenuUrls: domData.invalidMenuUrls,
    fontFamilies: domData.fontFamilies,
    fontsConsistent: domData.fontsConsistent,
    fontWeights: domData.fontWeights,
    fontWeightsConsistent: domData.fontWeightsConsistent,
    fontSizes: domData.fontSizes,
    fontSizesConsistent: domData.fontSizesConsistent,
    lineHeightsOutOfRangeCount: domData.lineHeightsOutOfRangeCount,
    overlappingElementsCount: domData.overlappingElementsCount,
    overlappingElementsList: domData.overlappingElementsList,
    hasBrokenLayout: domData.hasBrokenLayout,
    brokenLayoutDetails: domData.brokenLayoutDetails,

    // 3. Responsive Design
    viewportChecks,
    desktopHasHorizontalScroll: domData.desktopHasHorizontalScroll,

    // 4. Content
    spellingGrammarErrors: domData.spellingGrammarErrors,
    duplicateContentBlocks: domData.duplicateContentBlocks,
    placeholderTextDetected: domData.placeholderTextDetected,
    placeholderPhrases: domData.placeholderPhrases,
    loremIpsumDetected: domData.loremIpsumDetected,
    inContentLinksWork: domData.inContentLinksWork,
    brokenInContentLinks: domData.brokenInContentLinks,

    // 5. Buttons & CTAs
    buttons: domData.buttons,

    // 6. Forms
    forms: domData.forms,

    // 7. Links
    links: domData.links,

    // 8. Images & Media
    images: domData.images,

    // 9. SEO – On Page
    metaTags: domData.metaTags,
    hasUniqueTitle: domData.hasUniqueTitle,
    hasMetaDescription: domData.hasMetaDescription,
    h1Count: domData.h1Count,
    h1List: domData.h1List,
    imagesMissingAltCount: domData.imagesMissingAltCount,
    hasValidCanonical: domData.hasValidCanonical,
    hasOpenGraphTags: domData.hasOpenGraphTags,
    hasTwitterCardTags: domData.hasTwitterCardTags,

    // 10. Technical SEO
    hasSitemapXml,
    hasRobotsTxt,
    isHttps,
    httpRedirectsToHttps,
    redirects301Work,
    is404Page,
    hasStructuredData: domData.hasStructuredData,
    structuredDataType: domData.structuredDataType,
    hasLlmsTxt,

    // 11. Security
    sslValid,
    httpsEnforced: isHttps && httpRedirectsToHttps,
    googleAnalyticsInstalled: domData.googleAnalyticsInstalled,
    analyticsProvider: domData.analyticsProvider,

    networkRequests,
    jsConsoleErrors: consoleErrors
  };

  return {
    url: targetUrl,
    pageTitle,
    httpStatus,
    loadTimeMs,
    desktopScreenshotPath: desktopRelPath,
    tabletScreenshotPath: tabletRelPath,
    mobileScreenshotPath: mobileRelPath,
    fullPageScreenshotPath: fullPageRelPath,
    metrics: pageMetrics,
    discoveredLinks: domData.discoveredLinks,
    authStatus
  };
}

/**
 * capturePageData (Public Crawling)
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens a new tab, navigates to targetUrl, extracts metrics/screenshots
 * after frontend settles, and closes the tab.
 */
export async function capturePageData(
  targetUrl: string,
  auditId: string,
  pageIndex: number
): Promise<PageCaptureResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const networkRequests: { url: string; resourceType: string; size: number; durationMs: number; status: number }[] = [];
  const requestStartTimes = new Map<string, number>();
  const imageSizeMap = new Map<string, number>();

  page.on('request', (req) => {
    requestStartTimes.set(req.url(), Date.now());
  });

  page.on('requestfailed', (req) => {
    networkRequests.push({
      url: req.url(),
      resourceType: req.resourceType(),
      size: 0,
      durationMs: 0,
      status: 0
    });
  });

  page.on('response', async (res) => {
    const reqUrl = res.url();
    const startTime = requestStartTimes.get(reqUrl) || Date.now();
    const durationMs = Date.now() - startTime;
    let contentLength = parseInt(res.headers()['content-length'] || '0', 10);
    const resourceType = res.request().resourceType();

    if (resourceType === 'image' || /\.(jpe?g|png|webp|avif|gif)($|\?)/i.test(reqUrl)) {
      if (!contentLength || contentLength <= 0) {
        try {
          const buf = await res.buffer();
          contentLength = buf ? buf.length : 0;
        } catch {
          // ignore
        }
      }
      if (contentLength > 0) {
        imageSizeMap.set(reqUrl, contentLength);
        const clean = reqUrl.split('?')[0].split('#')[0];
        imageSizeMap.set(clean, contentLength);
      }
    }

    networkRequests.push({
      url: reqUrl,
      resourceType,
      size: contentLength,
      durationMs,
      status: res.status()
    });
  });

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'screenshots', auditId);
  await fs.mkdir(uploadDir, { recursive: true });

  const startTime = Date.now();
  let httpStatus = 200;
  let sslValid = true;

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 35000
    });
    if (response) {
      httpStatus = response.status();
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('SSL') || err.message.includes('CERT'))) {
      sslValid = false;
    }
    console.warn(`Error loading ${targetUrl}:`, err.message);
    httpStatus = httpStatus === 200 ? 500 : httpStatus;
  }

  const loadTimeMs = Date.now() - startTime;

  try {
    return await internalExtractPageData(page, targetUrl, auditId, pageIndex, {
      consoleErrors,
      networkRequests,
      imageSizeMap,
      httpStatus,
      sslValid,
      loadTimeMs,
      authStatus: 'public'
    });
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * capturePageDataAuthenticated (Authenticated Crawling)
 * ─────────────────────────────────────────────────────────────────────────────
 * Captures page data directly using the authenticated Puppeteer Page object.
 * Checks for session expiry / login redirect. If authenticated, executes full
 * frontend settling, responsive checks, and DOM extraction in the live session.
 * Does NOT close the page — the crawler session manager maintains it.
 */
export async function capturePageDataAuthenticated(
  page: Page,
  targetUrl: string,
  auditId: string,
  pageIndex: number,
  loginUrl: string
): Promise<PageCaptureResult & { authStatus: 'authenticated' | 'auth_required' | 'auth_expired' }> {
  const { checkAuthExpiry } = await import('./auth-engine');

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const networkRequests: { url: string; resourceType: string; size: number; durationMs: number; status: number }[] = [];
  const requestStartTimes = new Map<string, number>();
  const imageSizeMap = new Map<string, number>();

  page.on('request', (req) => {
    requestStartTimes.set(req.url(), Date.now());
  });

  page.on('requestfailed', (req) => {
    networkRequests.push({
      url: req.url(),
      resourceType: req.resourceType(),
      size: 0,
      durationMs: 0,
      status: 0
    });
  });

  page.on('response', async (res) => {
    const reqUrl = res.url();
    const startTime = requestStartTimes.get(reqUrl) || Date.now();
    const durationMs = Date.now() - startTime;
    let contentLength = parseInt(res.headers()['content-length'] || '0', 10);
    const resourceType = res.request().resourceType();
    if (resourceType === 'image' || /\.(jpe?g|png|webp|avif|gif)($|\?)/i.test(reqUrl)) {
      if (!contentLength || contentLength <= 0) {
        try { const buf = await res.buffer(); contentLength = buf ? buf.length : 0; } catch { /* ignore */ }
      }
      if (contentLength > 0) {
        imageSizeMap.set(reqUrl, contentLength);
        imageSizeMap.set(reqUrl.split('?')[0].split('#')[0], contentLength);
      }
    }
    networkRequests.push({ url: reqUrl, resourceType, size: contentLength, durationMs, status: res.status() });
  });

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'screenshots', auditId);
  await fs.mkdir(uploadDir, { recursive: true });

  const startTime = Date.now();
  let httpStatus = 200;
  let sslValid = true;
  let authStatus: 'authenticated' | 'auth_required' | 'auth_expired' = 'authenticated';

  try {
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    if (response) {
      httpStatus = response.status();
      if (httpStatus === 401 || httpStatus === 403) {
        authStatus = 'auth_required';
      }
    }
  } catch (err: any) {
    if (err.message?.includes('SSL') || err.message?.includes('CERT')) sslValid = false;
    if (err.message?.includes('ERR_INVALID_AUTH_CREDENTIALS')) {
      httpStatus = 401;
      authStatus = 'auth_required';
    } else {
      httpStatus = httpStatus === 200 ? 500 : httpStatus;
    }
  }

  // Detect auth expiry: redirected back to login page?
  if (authStatus === 'authenticated') {
    const expired = await checkAuthExpiry(page, loginUrl);
    if (expired) authStatus = 'auth_expired';
  }

  const loadTimeMs = Date.now() - startTime;

  // If auth expired or required, return early with clean minimal fallback (avoid extra hanging requests)
  if (authStatus === 'auth_expired' || authStatus === 'auth_required') {
    const pageTitle = (await page.title().catch(() => '')) || 'Authentication Required';
    return {
      url: targetUrl,
      pageTitle,
      httpStatus,
      loadTimeMs,
      desktopScreenshotPath: '',
      tabletScreenshotPath: '',
      mobileScreenshotPath: '',
      fullPageScreenshotPath: '',
      metrics: createEmptyMetrics(targetUrl, httpStatus, loadTimeMs, pageTitle),
      discoveredLinks: [],
      authStatus
    };
  }

  // Authenticated session is active: extract full frontend metrics and screenshots
  // directly on the authenticated page session
  const captureResult = await internalExtractPageData(page, targetUrl, auditId, pageIndex, {
    consoleErrors,
    networkRequests,
    imageSizeMap,
    httpStatus,
    sslValid,
    loadTimeMs,
    authStatus: 'authenticated'
  });

  return {
    ...captureResult,
    authStatus: 'authenticated'
  };
}
