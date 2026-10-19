export type AuditInputMethod = 'urls' | 'csv' | 'txt' | 'sitemap' | 'crawler';

// ─── Authentication Types ─────────────────────────────────────────────────────

export type AuthMethod = 'credentials' | 'manual';

export interface AuthenticationConfig {
  /** The method of authentication to use */
  method: AuthMethod;
  /** URL of the login page */
  loginUrl: string;
  /** Username/email for credential-based login */
  username?: string;
  /**
   * Password for credential-based login.
   * SECURITY: This is only held in memory during the audit session.
   * It is never stored to the database, logs, or reports.
   */
  password?: string;
  /** Optional: CSS selector for the username input field */
  usernameSelector?: string;
  /** Optional: CSS selector for the password input field */
  passwordSelector?: string;
  /** Optional: CSS selector for the submit button */
  submitSelector?: string;
  /** Optional: URL pattern or exact URL that indicates successful login */
  successUrl?: string;
  /** Optional: CSS selector that is present only when authenticated */
  successSelector?: string;
  /** Optional: CSS selector that indicates login failure */
  failureSelector?: string;
  /** Optional: additional wait time (ms) after login form submission */
  additionalWaitMs?: number;
}

export interface AuthTestResult {
  success: boolean;
  method: AuthMethod;
  finalUrl?: string;
  errorCode?: AuthErrorCode;
  errorMessage?: string;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'LOGIN_URL_UNREACHABLE'
  | 'USERNAME_SELECTOR_NOT_FOUND'
  | 'PASSWORD_SELECTOR_NOT_FOUND'
  | 'SUBMIT_SELECTOR_NOT_FOUND'
  | 'CAPTCHA_DETECTED'
  | 'TWO_FACTOR_DETECTED'
  | 'SSO_DETECTED'
  | 'TIMEOUT'
  | 'BROWSER_LAUNCH_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

// ─── Page Authentication Status ──────────────────────────────────────────────

export type PageAuthStatus = 'authenticated' | 'auth_required' | 'auth_expired' | 'public';

export interface AuditConfig {
  maxPages: number;
  maxDepth: number;
  respectRobotsTxt: boolean;
  excludePatterns: string[];
  includePatterns: string[];
  enableAiAnalysis: boolean;
  apiKey?: string;
  /** Optional authentication configuration. When absent, public crawling is used. */
  authentication?: AuthenticationConfig;
}

export type IssueCategory =
  | 'header-navigation'
  | 'visual-design'
  | 'overall-visual-design' // legacy alias
  | 'responsive-design'
  | 'content'
  | 'typography-content' // legacy alias
  | 'buttons-ctas'
  | 'forms'
  | 'links'
  | 'images-media'
  | 'seo-on-page'
  | 'seo-ux' // legacy alias
  | 'technical-seo'
  | 'error-empty-states' // legacy alias
  | 'security';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'PASS' | 'FAIL' | 'NOT_TESTABLE';

export interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AuditIssueData {
  id?: string;
  issueId?: string;
  pageUrl: string;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  viewport?: string; // e.g. "390px × 844px", "1920px × 1080px"
  title: string;
  problem: string; // Explanation / Problem description
  expectedBehavior: string;
  actualBehavior: string;
  recommendation: string;
  elementSelector?: string;
  elementText?: string;
  elementInfo?: string;
  elementBox?: ElementBox;
  screenshotUrl?: string; // Attached screenshot URL or undefined/null
  isGrouped?: boolean;
  affectedCount?: number;
  affectedUrls?: string[];
  rootCause?: string;
}

export interface NetworkRequestMetric {
  url: string;
  resourceType: string;
  size: number;
  durationMs: number;
  status: number;
}

export interface ResponsiveViewportCheck {
  width: number;
  height: number;
  label: string;
  hasHorizontalScroll: boolean;
  scrollWidth: number;
  clientWidth: number;
  overflowAmount: number;
  textOverflows: boolean;
  overflowingTextItems?: { selector: string; text: string; box: ElementBox; overflowPx: number }[];
  imagesResizeCorrectly: boolean;
  failingImageItems?: { selector: string; src: string; width: number; naturalWidth: number; box: ElementBox }[];
  navWorksOnMobile: boolean;
  formsWorkOnMobile: boolean;
  failingFormItems?: { selector: string; width: number; box: ElementBox }[];
  overlappingElements: { selector: string; text?: string; box: ElementBox }[];
  cutOffElements: { selector: string; text?: string; box: ElementBox }[];
  screenshotPath?: string;
}

export interface PageMetricsData {
  url: string;
  pageTitle: string;
  httpStatus: number;
  loadTimeMs: number;
  domElementCount: number;
  textWordCount: number;

  // 1. Header & Navigation Metrics
  hasHeader: boolean;
  hasLogo: boolean;
  logoHrefs: string[];
  logoLinksToHome: boolean;
  navLinks: { text: string; href: string; isHashLink: boolean; isBroken: boolean; selector: string }[];
  hasHashNavLinks: boolean;
  dropdownMenusCount: number;
  dropdownsWork: boolean;
  dropdownCutOff: boolean;
  navSpacingConsistent: boolean;
  headerCtaWorks: boolean;
  headerCtaSelector?: string;
  headerCtaText?: string;
  hasMobileMenu: boolean;
  mobileMenuOpens: boolean;
  mobileMenuCloses: boolean;
  mobileNavOverflow: boolean;

  // 2. Visual Design / UI Metrics
  menuItemUrlsValid: boolean;
  invalidMenuUrls: { text: string; href: string; selector: string }[];
  fontFamilies: string[];
  fontsConsistent: boolean;
  fontWeights: string[];
  fontWeightsConsistent: boolean;
  fontSizes: number[];
  fontSizesConsistent: boolean;
  lineHeightsOutOfRangeCount: number;
  lineHeightsSummary?: string;
  overlappingElementsCount: number;
  overlappingElementsList: { selector: string; text?: string; box: ElementBox; overlapsWith: string }[];
  hasBrokenLayout: boolean;
  brokenLayoutDetails: string[];

  // 3. Responsive Design Metrics
  viewportChecks: ResponsiveViewportCheck[];
  desktopHasHorizontalScroll: boolean;

  // 4. Content Metrics
  spellingGrammarErrors: { wordOrPhrase: string; context: string; suggestion: string }[];
  duplicateContentBlocks: { text: string; count: number }[];
  placeholderTextDetected: boolean;
  placeholderPhrases: string[];
  loremIpsumDetected: boolean;
  inContentLinksWork: boolean;
  brokenInContentLinks: { text: string; href: string; selector: string }[];

  // 5. Buttons & CTAs Metrics
  buttons: {
    text: string;
    selector: string;
    box: ElementBox;
    isClickable: boolean;
    isDead: boolean; // no href, #, void(0), empty onclick
    target?: string;
    isExternal: boolean;
    opensInNewTab: boolean;
    isDisabled: boolean;
    overlaps: boolean;
  }[];

  // 6. Forms Metrics
  forms: {
    selector: string;
    location: string;
    submitsSuccessfully: boolean;
    requiredFieldsWork: boolean;
    validationMessagesWork: boolean;
    formWorksOnMobile: boolean;
    phoneEmailValidateCorrectly: boolean;
    unlabeledFields?: { name: string; selector: string }[];
    invalidTypeFields?: { name: string; selector: string; currentType: string; suggestedType: string }[];
  }[];

  // 7. Links Metrics
  links: {
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
  }[];

  // 8. Images & Media Metrics
  images: {
    src: string;
    selector: string;
    alt?: string;
    hasAlt: boolean;
    isDecorative: boolean;
    isBroken: boolean;
    isHeavyRaster: boolean; // heavy jpg or png that should be compressed to webp
    format: string;
    naturalWidth: number;
    naturalHeight: number;
    displayWidth: number;
    displayHeight: number;
    fileSizeBytes?: number;
    box: ElementBox;
  }[];

  // 9. SEO – On Page Metrics
  metaTags: {
    title?: string;
    description?: string;
    canonical?: string;
    ogTitle?: string;
    ogImage?: string;
    ogDescription?: string;
    ogUrl?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterImage?: string;
    robots?: string;
  };
  hasUniqueTitle: boolean;
  hasMetaDescription: boolean;
  h1Count: number;
  h1List: string[];
  imagesMissingAltCount: number;
  hasValidCanonical: boolean;
  hasOpenGraphTags: boolean;
  hasTwitterCardTags: boolean;

  // 10. Technical SEO Metrics
  hasSitemapXml: boolean;
  hasRobotsTxt: boolean;
  isHttps: boolean;
  httpRedirectsToHttps: boolean;
  redirects301Work: boolean;
  is404Page: boolean;
  hasStructuredData: boolean;
  structuredDataType?: string;
  hasLlmsTxt: boolean;

  // 11. Security Metrics
  sslValid: boolean;
  httpsEnforced: boolean;
  googleAnalyticsInstalled: boolean;
  analyticsProvider?: string;

  // Network & Raw Logs
  networkRequests: NetworkRequestMetric[];
  jsConsoleErrors: string[];
}

export interface CategoryScores {
  overall: number;
  overallGrade: string;
  headerNav: number;
  visualDesign: number;
  responsive: number;
  content: number;
  buttonsCtas: number;
  forms: number;
  links: number;
  imagesMedia: number;
  seoOnPage: number;
  technicalSeo: number;
  security: number;

  // Legacy aliases
  typographyContent?: number;
  errorStates?: number;
  seoUx?: number;
}

export interface PageAuditData {
  id: string;
  url: string;
  pageTitle: string;
  httpStatus: number;
  loadTimeMs: number;
  desktopScreenshot: string;
  tabletScreenshot: string;
  mobileScreenshot: string;
  fullPageScreenshot: string;
  annotatedScreenshot?: string;
  metrics: PageMetricsData;
  scores: CategoryScores;
  issues: AuditIssueData[];
}
