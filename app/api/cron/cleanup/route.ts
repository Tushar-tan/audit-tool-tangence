import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldScreenshots } from '@/lib/storage/screenshot-cleanup';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const retentionDays = daysParam ? Number(daysParam) : 3;

    const result = await cleanupOldScreenshots({ retentionDays });
    return NextResponse.json({
      job: 'screenshot-retention-cleanup',
      ...result
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
