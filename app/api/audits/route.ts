import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditQueue } from '@/lib/queue/job-queue';
import { AuditConfig, AuthenticationConfig } from '@/lib/types/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const audits = await prisma.audit.findMany({
      where: search
        ? {
            OR: [
              { siteName: { contains: search } },
              { domain: { contains: search } }
            ]
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json(audits);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      siteName,
      domain,
      inputMethod,
      inputs,
      maxPages = 10,
      maxDepth = 2,
      respectRobotsTxt = true,
      excludePatterns = [],
      includePatterns = [],
      enableAiAnalysis = true,
      apiKey = '',
      // Authentication fields (optional)
      authentication = null,
      testSessionId,
    } = body;

    if (!siteName || !domain || !inputMethod || !inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return NextResponse.json(
        { error: 'Missing required audit parameters: siteName, domain, inputMethod, inputs' },
        { status: 400 }
      );
    }

    // Validate authentication config if provided
    let authConfig: AuthenticationConfig | undefined;
    if (authentication && authentication.method) {
      if (!authentication.loginUrl) {
        return NextResponse.json(
          { error: 'Authentication requires a login URL.' },
          { status: 400 }
        );
      }
      if (authentication.method === 'credentials' && !authentication.username) {
        return NextResponse.json(
          { error: 'Credential authentication requires a username.' },
          { status: 400 }
        );
      }

      // Build auth config — password is passed through memory only, never stored to DB
      authConfig = {
        method: authentication.method,
        loginUrl: authentication.loginUrl,
        username: authentication.username,
        password: authentication.password, // held in memory, never persisted
        usernameSelector: authentication.usernameSelector || undefined,
        passwordSelector: authentication.passwordSelector || undefined,
        submitSelector: authentication.submitSelector || undefined,
        successUrl: authentication.successUrl || undefined,
        successSelector: authentication.successSelector || undefined,
        failureSelector: authentication.failureSelector || undefined,
        additionalWaitMs: authentication.additionalWaitMs ? Number(authentication.additionalWaitMs) : undefined,
      };
    }

    const config: AuditConfig = {
      maxPages: Number(maxPages),
      maxDepth: Number(maxDepth),
      respectRobotsTxt: Boolean(respectRobotsTxt),
      excludePatterns: Array.isArray(excludePatterns) ? excludePatterns : [],
      includePatterns: Array.isArray(includePatterns) ? includePatterns : [],
      enableAiAnalysis: Boolean(enableAiAnalysis),
      apiKey,
      authentication: authConfig,
    };

    // Create DB record — NOTE: configJson does NOT store the password
    const configForDb = { ...config, authentication: authConfig
      ? { ...authConfig, password: undefined }
      : undefined
    };

    const audit = await prisma.audit.create({
      data: {
        siteName,
        domain,
        inputMethod,
        configJson: JSON.stringify(configForDb),
        status: 'queued',
        progressPercentage: 0,
        authType: authConfig?.method ?? 'public',
        authLoginUrl: authConfig?.loginUrl ?? null,
        authStatus: authConfig ? 'not_required' : 'not_required',
      }
    });

    // Add to asynchronous background job queue
    // Pass the full config (with password in memory) to the queue
    auditQueue.addJob({
      auditId: audit.id,
      inputMethod,
      inputs,
      config, // contains password in memory — never written to DB
      testSessionId,
    });

    return NextResponse.json(audit, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
