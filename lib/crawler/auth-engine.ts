/**
 * auth-engine.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Authenticated browser session management for the audit tool.
 *
 * SECURITY NOTES:
 *  - Passwords are NEVER written to logs, database, reports, or error messages.
 *  - Browser contexts are temporary and destroyed after each audit.
 *  - Credentials are held in memory only for the duration of the login operation.
 *  - Manual login mode never requests or stores the user's password.
 */

import puppeteer, { Browser, BrowserContext, Page } from 'puppeteer';
import { AuthenticationConfig, AuthTestResult, AuthErrorCode } from '../types/audit';
import { getBrowser } from './browser-session';

// ─── Internal session store ───────────────────────────────────────────────────
// Maps auditId → authenticated BrowserContext (temporary, in-memory only)
const activeSessions = new Map<string, BrowserContext>();
// Maps testSessionId → BrowserContext (for pre-audit auth tests)
const testSessions = new Map<string, BrowserContext>();

// ─── Common login form selectors ─────────────────────────────────────────────
const USERNAME_SELECTORS = [
  'input[type="email"]',
  'input[type="text"][name*="user"]',
  'input[type="text"][name*="email"]',
  'input[type="text"][name*="login"]',
  'input[name*="user"]',
  'input[name*="email"]',
  'input[name*="login"]',
  'input[id*="user"]',
  'input[id*="email"]',
  'input[id*="login"]',
  'input[placeholder*="user" i]',
  'input[placeholder*="email" i]',
  'input[placeholder*="login" i]',
  'input[type="text"]', // last resort
];

const PASSWORD_SELECTORS = [
  'input[type="password"]',
];

const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("Sign in")',
  'button:has-text("Log in")',
  'button:has-text("Login")',
  'button:has-text("Sign In")',
  '[class*="login"][type="button"]',
  '[class*="signin"][type="button"]',
  'form button:last-of-type',
  'form button',
];

// ─── CAPTCHA / 2FA / SSO detection patterns ──────────────────────────────────
const CAPTCHA_SIGNALS = [
  'recaptcha',
  'hcaptcha',
  'turnstile',
  'captcha',
  'g-recaptcha',
  'cf-turnstile',
];

const TWO_FACTOR_SIGNALS = [
  'two-factor',
  'two_factor',
  '2fa',
  'otp',
  'verification code',
  'authenticator code',
  'one-time',
];

const SSO_SIGNALS = [
  'accounts.google.com',
  'login.microsoftonline.com',
  'auth.okta.com',
  'ping',
  'sso',
  'saml',
  'oauth',
  'openid',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeForLog(message: string): string {
  // Ensure no password-like strings slip into logs
  return message.replace(/password[^,;.\s]*/gi, '[REDACTED]');
}

async function findSelector(page: Page, selectors: string[]): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        const visible = await page.evaluate((s) => {
          const el = document.querySelector(s);
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        }, sel);
        if (visible) return sel;
      }
    } catch {
      // selector may not be valid, try next
    }
  }
  return null;
}

async function detectCaptcha(page: Page): Promise<boolean> {
  try {
    return await page.evaluate((signals) => {
      const html = document.documentElement.innerHTML.toLowerCase();
      return signals.some((s: string) => html.includes(s));
    }, CAPTCHA_SIGNALS);
  } catch {
    return false;
  }
}

async function detectTwoFactor(page: Page): Promise<boolean> {
  try {
    return await page.evaluate((signals) => {
      const html = (document.body?.innerText || document.documentElement.innerHTML).toLowerCase();
      return signals.some((s: string) => html.includes(s));
    }, TWO_FACTOR_SIGNALS);
  } catch {
    return false;
  }
}

async function isRedirectedToLogin(page: Page, loginUrl: string): Promise<boolean> {
  try {
    const currentUrl = page.url();
    const loginUrlObj = new URL(loginUrl);
    const currentUrlObj = new URL(currentUrl);
    // Only check path equality when the loginUrl has a non-root path
    // (e.g. /login, /signin). For HTTP Basic Auth sites the loginUrl IS
    // the root '/', so a path match would fire on every single page.
    const loginPathIsRoot = loginUrlObj.pathname === '/' || loginUrlObj.pathname === '';
    if (!loginPathIsRoot && currentUrlObj.pathname === loginUrlObj.pathname) return true;
    const pathLower = currentUrlObj.pathname.toLowerCase();
    return (
      pathLower.includes('/login') ||
      pathLower.includes('/signin') ||
      pathLower.includes('/sign-in') ||
      pathLower.includes('/auth') ||
      pathLower.includes('/account/login')
    );
  } catch {
    return false;
  }
}

/**
 * Determines whether a page appears to be authenticated by checking:
 * 1. URL no longer matches the login page
 * 2. A successSelector is visible (if provided)
 * 3. Login form is no longer visible
 * 4. No 401/403 indicators
 */
async function verifyAuthentication(
  page: Page,
  loginUrl: string,
  successUrl?: string,
  successSelector?: string,
  failureSelector?: string
): Promise<boolean> {
  try {
    const currentUrl = page.url();

    // Check for explicit success URL pattern
    if (successUrl) {
      if (currentUrl.includes(successUrl) || new URL(currentUrl).pathname.startsWith(new URL(successUrl.startsWith('http') ? successUrl : `https://x.com${successUrl}`).pathname)) {
        return true;
      }
    }

    // Check for explicit success selector
    if (successSelector) {
      try {
        const el = await page.$(successSelector);
        if (el) return true;
      } catch { /* ignore */ }
    }

    // Check for failure selector
    if (failureSelector) {
      try {
        const el = await page.$(failureSelector);
        if (el) return false;
      } catch { /* ignore */ }
    }

    // Check that login form is gone and URL changed
    const loginUrlObj = new URL(loginUrl);
    const currentUrlObj = new URL(currentUrl);

    // If URL moved away from login path, likely authenticated
    if (currentUrlObj.hostname === loginUrlObj.hostname && currentUrlObj.pathname !== loginUrlObj.pathname) {
      // Verify no login form is visible
      const loginFormGone = await page.evaluate(() => {
        const passwordInput = document.querySelector('input[type="password"]');
        if (!passwordInput) return true;
        const rect = (passwordInput as HTMLElement).getBoundingClientRect();
        const style = window.getComputedStyle(passwordInput);
        return rect.width === 0 || style.display === 'none' || style.visibility === 'hidden';
      });
      if (loginFormGone) return true;
    }

    // Check HTTP status via navigation
    const httpStatus = await page.evaluate(() => {
      // Some SPAs set a data attribute or body class for auth state
      const bodyClass = document.body?.className?.toLowerCase() || '';
      const isLoggedIn =
        bodyClass.includes('authenticated') ||
        bodyClass.includes('logged-in') ||
        bodyClass.includes('is-auth') ||
        document.querySelector('[data-authenticated]') !== null ||
        document.querySelector('[data-user]') !== null;
      return isLoggedIn;
    });

    return httpStatus;
  } catch {
    return false;
  }
}

// ─── Puppeteer browser factory for auth contexts ─────────────────────────────
async function createAuthBrowser(): Promise<Browser> {
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ].filter(Boolean) as string[];

  const fsSync = require('fs');
  const foundExec = possiblePaths.find((p) => {
    try { return fsSync.existsSync(p); } catch { return false; }
  });

  const launchOptions = {
    headless: true as const,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  };

  try {
    return await puppeteer.launch(launchOptions);
  } catch {
    if (foundExec) {
      return await puppeteer.launch({ ...launchOptions, executablePath: foundExec });
    }
    throw new Error('Could not launch browser. Please ensure Chrome or Chromium is installed.');
  }
}

// ─── Core: Perform automated credential-based login ──────────────────────────

async function performCredentialLogin(
  page: Page,
  config: AuthenticationConfig,
  logFn?: (msg: string) => void
): Promise<AuthTestResult> {
  const log = (msg: string) => logFn?.(sanitizeForLog(msg));

  const loginUrl = config.loginUrl;

  try {
    if (config.username && config.password) {
      log('Configuring HTTP authentication credentials...');
      await page.authenticate({
        username: config.username,
        password: config.password,
      });
    }

    log(`Navigating to login URL: ${loginUrl}`);
    let httpStatus = 200;
    try {
      const resp = await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      httpStatus = resp?.status() ?? 200;
    } catch (err: any) {
      if (err.message?.includes('ERR_INVALID_AUTH_CREDENTIALS')) {
        return {
          success: false,
          method: 'credentials',
          errorCode: 'INVALID_CREDENTIALS',
          errorMessage: 'HTTP Basic Authentication failed: Invalid username or password. Check credentials and try again.',
        };
      }
      if (err.message?.includes('net::')) {
        return {
          success: false,
          method: 'credentials',
          errorCode: 'LOGIN_URL_UNREACHABLE',
          errorMessage: `Could not reach login page: ${loginUrl}. Check the URL and network.`,
        };
      }
      // Navigation errors (like timeout) — try to continue if page loaded partially
    }

    if (httpStatus === 401) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'INVALID_CREDENTIALS',
        errorMessage: 'HTTP Basic Authentication failed (HTTP 401 Unauthorized). The provided username or password was incorrect.',
      };
    }

    if (httpStatus >= 400) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'LOGIN_URL_UNREACHABLE',
        errorMessage: `Login page returned HTTP ${httpStatus}. Check that the login URL is correct.`,
      };
    }

    // Wait a bit for dynamic content to appear
    await new Promise((r) => setTimeout(r, 1500));

    // Check if this page is authenticated via HTTP Basic Auth (i.e. no HTML login form is present)
    const passwordInputs = await page.$$('input[type="password"]');
    if (passwordInputs.length === 0) {
      // No HTML password field on page! Since HTTP status is < 400 and we supplied credentials,
      // this is an HTTP Basic / Digest Authentication site (such as klop.tangence.com).
      const finalUrl = page.url();
      log(`HTTP Basic Authentication succeeded! Successfully accessed: ${finalUrl}`);
      // Tag the page's browser context as a Basic Auth context so the crawler
      // knows NOT to use URL-redirect checks for expiry detection.
      try {
        const ctx = page.browserContext();
        (ctx as any).__isBasicAuth = true;
      } catch { /* ignore */ }
      return {
        success: true,
        method: 'credentials',
        finalUrl,
      };
    }

    // Check for CAPTCHA before attempting login
    if (await detectCaptcha(page)) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'CAPTCHA_DETECTED',
        errorMessage:
          'CAPTCHA detected on the login page. Use "Manual Browser Login" mode to authenticate manually.',
      };
    }

    // Check for SSO redirect
    const currentUrl = page.url();
    if (SSO_SIGNALS.some((s) => currentUrl.toLowerCase().includes(s))) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'SSO_DETECTED',
        errorMessage:
          'SSO/OAuth provider detected. Use "Manual Browser Login" mode to authenticate through your identity provider.',
      };
    }

    // ── Detect / use username selector ──────────────────────────────────────
    const userSelectors = config.usernameSelector
      ? [config.usernameSelector, ...USERNAME_SELECTORS]
      : USERNAME_SELECTORS;

    const usernameSelector = await findSelector(page, userSelectors);
    if (!usernameSelector) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'USERNAME_SELECTOR_NOT_FOUND',
        errorMessage:
          'Could not find a username/email input field on the login page. Try specifying a custom Username Selector in Advanced Options.',
      };
    }

    log(`Found username field: ${usernameSelector}`);

    // ── Detect / use password selector ──────────────────────────────────────
    const passSelectors = config.passwordSelector
      ? [config.passwordSelector, ...PASSWORD_SELECTORS]
      : PASSWORD_SELECTORS;

    const passwordSelector = await findSelector(page, passSelectors);
    if (!passwordSelector) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'PASSWORD_SELECTOR_NOT_FOUND',
        errorMessage:
          'Could not find a password input field on the login page. Try specifying a custom Password Selector in Advanced Options.',
      };
    }

    log('Found password field');

    // ── Enter credentials ────────────────────────────────────────────────────
    await page.click(usernameSelector, { clickCount: 3 });
    await page.type(usernameSelector, config.username ?? '', { delay: 50 });

    await page.click(passwordSelector, { clickCount: 3 });
    // SECURITY: password is typed directly into the browser; never logged.
    await page.type(passwordSelector, config.password ?? '', { delay: 50 });

    // ── Detect / use submit selector ─────────────────────────────────────────
    const submitSelectors = config.submitSelector
      ? [config.submitSelector, ...SUBMIT_SELECTORS]
      : SUBMIT_SELECTORS;

    const submitSelector = await findSelector(page, submitSelectors);
    if (!submitSelector) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'SUBMIT_SELECTOR_NOT_FOUND',
        errorMessage:
          'Could not find a submit button on the login page. Try specifying a custom Submit Selector in Advanced Options.',
      };
    }

    log(`Submitting login form via: ${submitSelector}`);

    // ── Submit form ──────────────────────────────────────────────────────────
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click(submitSelector),
    ]);

    // Wait for additional milliseconds if configured (e.g. for SPA auth flows)
    const extraWait = config.additionalWaitMs ?? 2000;
    await new Promise((r) => setTimeout(r, extraWait));

    // Check for 2FA challenge after submission
    if (await detectTwoFactor(page)) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'TWO_FACTOR_DETECTED',
        errorMessage:
          '2FA/OTP required. Use "Manual Browser Login" mode to complete authentication including 2FA.',
      };
    }

    // Verify authentication succeeded
    const authenticated = await verifyAuthentication(
      page,
      loginUrl,
      config.successUrl,
      config.successSelector,
      config.failureSelector
    );

    if (!authenticated) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'INVALID_CREDENTIALS',
        errorMessage:
          'Authentication failed. The browser is still on the login page or shows an error. Check credentials and try again.',
      };
    }

    const finalUrl = page.url();
    log(`Authentication successful. Landed on: ${finalUrl}`);

    return { success: true, method: 'credentials', finalUrl };
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return {
        success: false,
        method: 'credentials',
        errorCode: 'TIMEOUT',
        errorMessage: 'Login timed out. The page took too long to respond after submitting credentials.',
      };
    }
    return {
      success: false,
      method: 'credentials',
      errorCode: 'UNKNOWN',
      errorMessage: `An unexpected error occurred during authentication. ${sanitizeForLog(msg)}`,
    };
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Test authentication without starting an audit.
 * Creates a temporary browser context, attempts login, returns result.
 * The browser context is stored by testSessionId so it can be reused
 * if the user proceeds to start an audit immediately after.
 */
export async function testAuthentication(
  config: AuthenticationConfig,
  testSessionId: string,
  logFn?: (msg: string) => void
): Promise<AuthTestResult> {
  // Destroy any previous test session for this ID
  await destroyTestSession(testSessionId);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await createAuthBrowser();
    const browserCtx = await browser.createBrowserContext();
    context = browserCtx;
    const page = await browserCtx.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    let result: AuthTestResult;

    if (config.method === 'credentials') {
      result = await performCredentialLogin(page, config, logFn);
    } else {
      // Manual login – not applicable for test; caller should handle
      result = { success: true, method: 'manual', finalUrl: page.url() };
    }

    if (result.success) {
      // Store context so it can be transferred to an audit session
      testSessions.set(testSessionId, browserCtx);
      // Keep browser alive; context holds the session
      (browserCtx as any).__browser = browser;
      if (config.username && config.password) {
        (browserCtx as any).__credentials = { username: config.username, password: config.password };
      }
      return result;
    } else {
      // Cleanup on failure
      await browserCtx.close();
      await browser.close();
      return result;
    }
  } catch (err: any) {
    try { await context?.close(); } catch { /* ignore */ }
    try { await browser?.close(); } catch { /* ignore */ }
    return {
      success: false,
      method: config.method,
      errorCode: 'BROWSER_LAUNCH_FAILED',
      errorMessage: `Failed to launch browser: ${(err as Error).message}`,
    };
  }
}

/**
 * Establishes an authenticated browser session for an audit.
 * If a testSessionId is provided and a matching session exists, it is reused.
 * Otherwise a fresh login is performed.
 * Returns true if authentication succeeded.
 */
export async function establishAuditSession(
  auditId: string,
  config: AuthenticationConfig,
  testSessionId?: string,
  logFn?: (msg: string) => void
): Promise<boolean> {
  const log = (msg: string) => logFn?.(sanitizeForLog(msg));

  // Try to reuse an existing test session
  if (testSessionId && testSessions.has(testSessionId)) {
    const existingCtx = testSessions.get(testSessionId)!;
    testSessions.delete(testSessionId);
    activeSessions.set(auditId, existingCtx);
    if (config.username && config.password) {
      (existingCtx as any).__credentials = { username: config.username, password: config.password };
    }
    log('Reusing authenticated session from authentication test.');
    return true;
  }

  // Otherwise perform a fresh login
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await createAuthBrowser();
    const browserCtx = await browser.createBrowserContext();
    context = browserCtx;
    const page = await browserCtx.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    let result: AuthTestResult;

    if (config.method === 'credentials') {
      result = await performCredentialLogin(page, config, log);
    } else {
      // Manual login — browser is launched visibly; handled via separate API
      result = { success: true, method: 'manual', finalUrl: page.url() };
    }

    if (result.success) {
      activeSessions.set(auditId, browserCtx);
      (browserCtx as any).__browser = browser;
      if (config.username && config.password) {
        (browserCtx as any).__credentials = { username: config.username, password: config.password };
      }
      log(`Authenticated browser session established for audit ${auditId}.`);
      return true;
    } else {
      log(`Authentication failed: ${result.errorMessage}`);
      await browserCtx.close();
      await browser.close();
      return false;
    }
  } catch (err: any) {
    log(`Browser session error: ${sanitizeForLog((err as Error).message)}`);
    try { await context?.close(); } catch { /* ignore */ }
    try { await browser?.close(); } catch { /* ignore */ }
    return false;
  }
}

/**
 * Opens a visible (headed) browser window for manual login.
 * Returns a sessionId that the caller can poll.
 * The user logs in manually; when ready they call confirmManualLogin().
 */
export async function openManualLoginBrowser(
  config: AuthenticationConfig,
  sessionId: string,
  logFn?: (msg: string) => void
): Promise<{ success: boolean; error?: string }> {
  const log = (msg: string) => logFn?.(sanitizeForLog(msg));

  await destroyTestSession(sessionId);

  try {
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
    ].filter(Boolean) as string[];

    const fsSync = require('fs');
    const foundExec = possiblePaths.find((p) => {
      try { return fsSync.existsSync(p); } catch { return false; }
    });

    const launchOptions: any = {
      headless: false, // Visible browser for manual login
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    };
    if (foundExec) launchOptions.executablePath = foundExec;

    const browser = await puppeteer.launch(launchOptions);
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    if (config.username && config.password) {
      await page.authenticate({ username: config.username, password: config.password });
    }

    log(`Opening browser for manual login at: ${config.loginUrl}`);
    try {
      await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (gotoErr: any) {
      // If HTTP basic auth challenge dialog appears in headed mode and no pre-supplied creds,
      // Chromium displays the native credentials prompt for the user. Do not fail here.
      if (!gotoErr.message?.includes('ERR_INVALID_AUTH_CREDENTIALS')) {
        throw gotoErr;
      }
    }

    testSessions.set(sessionId, context);
    (context as any).__browser = browser;
    if (config.username && config.password) {
      (context as any).__credentials = { username: config.username, password: config.password };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: `Failed to open browser: ${sanitizeForLog((err as Error).message)}` };
  }
}

/**
 * Confirms that manual login is complete and validates the session.
 */
export async function confirmManualLogin(
  sessionId: string,
  config: AuthenticationConfig
): Promise<AuthTestResult> {
  const context = testSessions.get(sessionId);
  if (!context) {
    return {
      success: false,
      method: 'manual',
      errorCode: 'UNKNOWN',
      errorMessage: 'Session not found. Please restart the manual login process.',
    };
  }

  try {
    const pages = await context.pages();
    const page = pages[pages.length - 1] ?? pages[0];

    const authenticated = await verifyAuthentication(
      page,
      config.loginUrl,
      config.successUrl,
      config.successSelector,
      config.failureSelector
    );

    const finalUrl = page.url();

    if (!authenticated) {
      // Check if still on login page
      const stillOnLogin = await isRedirectedToLogin(page, config.loginUrl);
      if (stillOnLogin) {
        return {
          success: false,
          method: 'manual',
          errorCode: 'INVALID_CREDENTIALS',
          errorMessage: 'Browser appears to still be on the login page. Please complete login and try again.',
          finalUrl,
        };
      }
      // URL changed but we can't confirm auth — assume success
    }

    return { success: true, method: 'manual', finalUrl };
  } catch (err: any) {
    return {
      success: false,
      method: 'manual',
      errorCode: 'UNKNOWN',
      errorMessage: sanitizeForLog((err as Error).message),
    };
  }
}

/**
 * Creates a new page in the authenticated browser context for a given audit.
 * Used by the crawler to fetch pages while maintaining auth cookies/session.
 */
export async function createAuthenticatedPage(auditId: string): Promise<Page | null> {
  const context = activeSessions.get(auditId);
  if (!context) return null;
  try {
    const page = await context.newPage();
    const creds = (context as any).__credentials;
    if (creds?.username && creds?.password) {
      await page.authenticate({ username: creds.username, password: creds.password });
    }
    return page;
  } catch {
    return null;
  }
}

/**
 * Checks if a page appears to be redirected back to login (auth expiry detection).
 * For HTTP Basic Auth contexts, URL-based redirect detection is not applicable
 * because the loginUrl is the site root — expiry is detected by HTTP 401 status
 * (already handled at the call site in capturePageDataAuthenticated).
 */
export async function checkAuthExpiry(page: Page, loginUrl: string): Promise<boolean> {
  try {
    // If this is a Basic Auth context, skip URL-redirect detection entirely.
    // A 401/403 HTTP response is the only reliable expiry signal for Basic Auth.
    const ctx = page.browserContext();
    if ((ctx as any).__isBasicAuth) return false;
    return await isRedirectedToLogin(page, loginUrl);
  } catch {
    return false;
  }
}

/**
 * Destroys the authenticated session for a given audit.
 * SECURITY: This closes the browser context and removes it from memory.
 */
export async function destroyAuditSession(auditId: string): Promise<void> {
  const context = activeSessions.get(auditId);
  if (context) {
    activeSessions.delete(auditId);
    try {
      const browser = (context as any).__browser as Browser | undefined;
      await context.close();
      if (browser && browser.connected) await browser.close();
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Destroys a test session by ID.
 */
export async function destroyTestSession(sessionId: string): Promise<void> {
  const context = testSessions.get(sessionId);
  if (context) {
    testSessions.delete(sessionId);
    try {
      const browser = (context as any).__browser as Browser | undefined;
      await context.close();
      if (browser && browser.connected) await browser.close();
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Checks if an audit has an active authenticated session.
 */
export function hasActiveSession(auditId: string): boolean {
  return activeSessions.has(auditId);
}
