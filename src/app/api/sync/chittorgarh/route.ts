import { NextResponse } from 'next/server';
import { scrapeChittorgarhIPOs } from '../../../../lib/scrapers/chittorgarh';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Run the scraper asynchronously so Vercel serverless doesn't time out
    // (Playwright can take 60s+ to scrape all detail pages).
    // We execute it in the background.
    console.log('Manual trigger: Starting Chittorgarh scraper...');
    scrapeChittorgarhIPOs().catch(err => {
      console.error('Background Chittorgarh scraper failed:', err.message);
    });

    return NextResponse.json({ message: 'Chittorgarh sync triggered in background' });
  } catch (err: any) {
    console.error('Failed to trigger Chittorgarh scraper:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
