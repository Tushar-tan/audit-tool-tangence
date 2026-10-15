import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditQueue } from '@/lib/queue/job-queue';
import { AuditConfig } from '@/lib/types/audit';

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
      enableAiAnalysis = true,
      apiKey = ''
    } = body;

    if (!siteName || !domain || !inputMethod || !inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return NextResponse.json(
        { error: 'Missing required audit parameters: siteName, domain, inputMethod, inputs' },
        { status: 400 }
      );
    }

    const config: AuditConfig = {
      maxPages: Number(maxPages),
      maxDepth: Number(maxDepth),
      respectRobotsTxt: Boolean(respectRobotsTxt),
      excludePatterns: Array.isArray(excludePatterns) ? excludePatterns : [],
      includePatterns: [],
      enableAiAnalysis: Boolean(enableAiAnalysis),
      apiKey
    };

    const audit = await prisma.audit.create({
      data: {
        siteName,
        domain,
        inputMethod,
        configJson: JSON.stringify(config),
        status: 'queued',
        progressPercentage: 0
      }
    });

    // Add to asynchronous background job queue
    auditQueue.addJob({
      auditId: audit.id,
      inputMethod,
      inputs,
      config
    });

    return NextResponse.json(audit, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
