import { NextResponse } from 'next/server';
import { scrapeDRHP } from '../../../../lib/scrapers/pdfFetcher';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('Manual trigger: Starting PDF fetcher...');
    scrapeDRHP().catch(err => {
      console.error('Background PDF fetcher failed:', err.message);
    });

    return NextResponse.json({ message: 'RHP PDF fetch and R2 upload triggered in background' });
  } catch (err: any) {
    console.error('Failed to trigger PDF fetcher:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
