/**
 * /api/auth/test  — Test Authentication Endpoint
 *
 * Attempts authentication without starting an audit.
 * On success, the authenticated browser session is preserved in memory
 * under the returned testSessionId, allowing it to be reused when the
 * user starts an audit immediately after.
 *
 * SECURITY:
 *  - Password is never logged or returned in the response.
 *  - testSessionId is a one-time-use token; reusing it transfers ownership.
 *  - Sessions auto-expire if not transferred to an audit within 10 minutes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { testAuthentication, openManualLoginBrowser, confirmManualLogin, destroyTestSession } from '@/lib/crawler/auth-engine';
import { AuthenticationConfig } from '@/lib/types/audit';
import crypto from 'crypto';

// In-memory map of sessionId → expiry timer (for auto-cleanup)
const sessionTimers = new Map<string, NodeJS.Timeout>();

function scheduleSessionCleanup(sessionId: string, delayMs = 10 * 60 * 1000) {
  // Cancel existing timer if any
  const existing = sessionTimers.get(sessionId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    await destroyTestSession(sessionId);
    sessionTimers.delete(sessionId);
  }, delayMs);

  sessionTimers.set(sessionId, timer);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, authentication } = body;

    if (!action || !authentication) {
      return NextResponse.json({ error: 'Missing required fields: action, authentication' }, { status: 400 });
    }

    if (!authentication.loginUrl) {
      return NextResponse.json({ error: 'Login URL is required.' }, { status: 400 });
    }

    // Build auth config — password stays in memory only
    const authConfig: AuthenticationConfig = {
      method: authentication.method ?? 'credentials',
      loginUrl: authentication.loginUrl,
      username: authentication.username,
      password: authentication.password, // SECURITY: in-memory only, never stored or logged
      usernameSelector: authentication.usernameSelector || undefined,
      passwordSelector: authentication.passwordSelector || undefined,
      submitSelector: authentication.submitSelector || undefined,
      successUrl: authentication.successUrl || undefined,
      successSelector: authentication.successSelector || undefined,
      failureSelector: authentication.failureSelector || undefined,
      additionalWaitMs: authentication.additionalWaitMs ? Number(authentication.additionalWaitMs) : 2000,
    };

    // ── Action: test ─────────────────────────────────────────────────────────
    if (action === 'test') {
      if (authConfig.method === 'credentials') {
        if (!authConfig.username) {
          return NextResponse.json({ error: 'Username is required for credential authentication.' }, { status: 400 });
        }
        if (!authConfig.password) {
          return NextResponse.json({ error: 'Password is required for credential authentication.' }, { status: 400 });
        }
      }

      const testSessionId = crypto.randomUUID();

      const logMessages: string[] = [];
      const result = await testAuthentication(authConfig, testSessionId, (msg) => {
        logMessages.push(msg);
      });

      if (result.success) {
        scheduleSessionCleanup(testSessionId);
        // SECURITY: Never return credentials or session tokens in the response
        return NextResponse.json({
          success: true,
          method: result.method,
          finalUrl: result.finalUrl,
          testSessionId,
          logs: logMessages,
        });
      } else {
        return NextResponse.json({
          success: false,
          method: result.method,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          logs: logMessages,
        }, { status: 200 }); // 200 so client can distinguish from server error
      }
    }

    // ── Action: open_manual ──────────────────────────────────────────────────
    if (action === 'open_manual') {
      const sessionId = body.sessionId ?? crypto.randomUUID();
      const result = await openManualLoginBrowser(authConfig, sessionId);
      if (result.success) {
        scheduleSessionCleanup(sessionId, 15 * 60 * 1000); // 15 min for manual
        return NextResponse.json({ success: true, sessionId });
      } else {
        return NextResponse.json({ success: false, error: result.error }, { status: 200 });
      }
    }

    // ── Action: confirm_manual ───────────────────────────────────────────────
    if (action === 'confirm_manual') {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required for confirm_manual' }, { status: 400 });
      }
      const result = await confirmManualLogin(sessionId, authConfig);
      if (result.success) {
        scheduleSessionCleanup(sessionId);
        return NextResponse.json({
          success: true,
          method: result.method,
          finalUrl: result.finalUrl,
          testSessionId: sessionId,
        });
      } else {
        return NextResponse.json({
          success: false,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        });
      }
    }

    // ── Action: destroy ──────────────────────────────────────────────────────
    if (action === 'destroy') {
      const { sessionId } = body;
      if (sessionId) {
        const timer = sessionTimers.get(sessionId);
        if (timer) { clearTimeout(timer); sessionTimers.delete(sessionId); }
        await destroyTestSession(sessionId);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    // SECURITY: Never include credentials in error responses
    const msg = (err as Error).message.replace(/password/gi, '[REDACTED]');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
