import { NextResponse } from 'next/server';
import { fetchAndParseSingleIPORHP } from '../../../../lib/scrapers/pdfFetcher';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { ipoId } = await request.json();
    if (!ipoId) {
      return NextResponse.json({ error: 'Missing ipoId' }, { status: 400 });
    }

    console.log(`[API] Triggering single-IPO RHP fetch for ${ipoId}`);
    const result = await fetchAndParseSingleIPORHP(ipoId);

    return NextResponse.json({
      message: 'Prospectus fetched and parsed successfully',
      fileUrl: result.fileUrl
    });
  } catch (err: any) {
    console.error('[API] Failed to fetch RHP:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
