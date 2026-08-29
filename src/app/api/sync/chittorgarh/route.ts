import { NextResponse } from 'next/server';
import { scrapeChittorgarhIPOs } from '../../../../lib/scrapers/chittorgarh';

export const maxDuration = 60; // Allow up to 60 seconds for the Vercel function
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('Manual trigger: Starting Chittorgarh scraper...');
    // Await the scraper so Vercel doesn't kill the function early.
    // Background execution without await (or waitUntil) fails on Vercel.
    await scrapeChittorgarhIPOs();

    return NextResponse.json({ message: 'Chittorgarh sync completed successfully' });
  } catch (err: any) {
    console.error('Failed to trigger Chittorgarh scraper:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
