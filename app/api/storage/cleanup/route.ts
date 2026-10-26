import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldScreenshots, getScreenshotStorageStats } from '@/lib/storage/screenshot-cleanup';
import { isImgBBEnabled } from '@/lib/storage/imgbb-uploader';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const retentionDays = daysParam ? Number(daysParam) : undefined;

    const stats = await getScreenshotStorageStats(retentionDays);
    return NextResponse.json({
      success: true,
      stats,
      imgbbEnabled: isImgBBEnabled()
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let retentionDays: number | undefined;
    let dryRun = false;

    try {
      const body = await req.json();
      if (body.retentionDays) retentionDays = Number(body.retentionDays);
      if (body.dryRun !== undefined) dryRun = Boolean(body.dryRun);
    } catch {
      // no body or query params
      const { searchParams } = new URL(req.url);
      const daysParam = searchParams.get('days');
      if (daysParam) retentionDays = Number(daysParam);
      if (searchParams.get('dryRun') === 'true') dryRun = true;
    }

    const result = await cleanupOldScreenshots({ retentionDays, dryRun });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
