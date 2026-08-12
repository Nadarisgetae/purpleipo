import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: ipoId } = params;

    // Fetch all score snapshots for this IPO, chronologically
    const snapshots = await sql`
      SELECT 
        id,
        stage_at_time,
        rhp_score,
        independent_score,
        news_score,
        composite_score,
        weights_used,
        created_at
      FROM score_snapshots
      WHERE ipo_id = ${ipoId}
      ORDER BY created_at ASC;
    `;

    // Fetch IPO + company metadata (including listing details)
    const [ipo] = await sql`
      SELECT 
        i.id,
        i.current_stage,
        i.price_band,
        i.listing_date,
        i.listing_price,
        i.listing_gain_pct,
        c.name as company_name,
        c.sector
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = ${ipoId};
    `;

    if (!ipo) {
      return NextResponse.json({ success: false, message: 'IPO not found' }, { status: 404 });
    }

    // Compute per-stage best snapshot summary (for stage progression chart)
    const stageMap: Record<number, { rhp: number; independent: number; news: number; composite: number; date: string }> = {};
    for (const s of snapshots) {
      const stage = s.stage_at_time;
      if (!stageMap[stage] || new Date(s.created_at) > new Date(stageMap[stage].date)) {
        stageMap[stage] = {
          rhp: Number(s.rhp_score) || 0,
          independent: Number(s.independent_score) || 0,
          news: Number(s.news_score) || 0,
          composite: Number(s.composite_score) || 0,
          date: s.created_at,
        };
      }
    }

    const stageSeries = Object.entries(stageMap).map(([stage, data]) => ({
      stage: Number(stage),
      ...data,
    })).sort((a, b) => a.stage - b.stage);

    return NextResponse.json({
      success: true,
      company_name: ipo.company_name,
      current_stage: ipo.current_stage,
      price_band: ipo.price_band,
      listing_date: ipo.listing_date,
      listing_price: ipo.listing_price,
      listing_gain_pct: ipo.listing_gain_pct,
      snapshots,
      stage_series: stageSeries,
      total_snapshots: snapshots.length,
    });
  } catch (error) {
    console.error('Error fetching score history:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
