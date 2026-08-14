import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new (YahooFinance as any)();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // 1. Fetch live quotes from Yahoo Finance
    // Nifty 50, BSE Sensex, India VIX
    const [nifty, sensex, vix] = await Promise.all([
      yahooFinance.quote('^NSEI').catch(() => null),
      yahooFinance.quote('^BSESN').catch(() => null),
      yahooFinance.quote('^INDIAVIX').catch(() => null)
    ]);

    const nifty_level = nifty?.regularMarketPrice || null;
    const sensex_level = sensex?.regularMarketPrice || null;
    const india_vix = vix?.regularMarketPrice || null;

    // We'll leave FII/DII flow as 0 for now unless we scrape it separately
    const fii_flow = 0;
    const dii_flow = 0;

    // 2. Insert into database (Upsert on current date)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const [snapshot] = await sql`
      INSERT INTO market_data_snapshots (
        date, nifty_level, sensex_level, india_vix, fii_flow, dii_flow
      ) VALUES (
        ${today}, ${nifty_level}, ${sensex_level}, ${india_vix}, ${fii_flow}, ${dii_flow}
      )
      ON CONFLICT (date) DO UPDATE SET
        nifty_level = EXCLUDED.nifty_level,
        sensex_level = EXCLUDED.sensex_level,
        india_vix = EXCLUDED.india_vix,
        fii_flow = EXCLUDED.fii_flow,
        dii_flow = EXCLUDED.dii_flow
      RETURNING *;
    `;

    return NextResponse.json({
      success: true,
      message: 'Market data snapshot created/updated successfully',
      data: snapshot
    });
  } catch (error) {
    console.error('Failed to sync market data:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
