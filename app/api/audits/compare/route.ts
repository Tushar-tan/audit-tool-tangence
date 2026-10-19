import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const beforeId = searchParams.get('before');
    const afterId = searchParams.get('after');

    if (!beforeId || !afterId) {
      return NextResponse.json({ error: 'Both "before" and "after" audit IDs are required.' }, { status: 400 });
    }

    const [beforeAudit, afterAudit] = await Promise.all([
      prisma.audit.findUnique({
        where: { id: beforeId },
        include: { issues: { orderBy: [{ severity: 'asc' }, { category: 'asc' }] } }
      }),
      prisma.audit.findUnique({
        where: { id: afterId },
        include: { issues: { orderBy: [{ severity: 'asc' }, { category: 'asc' }] } }
      }),
    ]);

    if (!beforeAudit) return NextResponse.json({ error: 'Before audit not found.' }, { status: 404 });
    if (!afterAudit) return NextResponse.json({ error: 'After audit not found.' }, { status: 404 });

    return NextResponse.json({ before: beforeAudit, after: afterAudit });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
