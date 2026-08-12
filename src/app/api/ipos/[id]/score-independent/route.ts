import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { calculateIndependentScore } from '@/lib/market-signals';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: ipoId } = params;

    // 1. Fetch IPO data
    const [ipo] = await sql`
      SELECT i.*, c.name as company_name, c.sector
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = ${ipoId};
    `;

    if (!ipo) {
      return NextResponse.json({ success: false, message: 'IPO not found' }, { status: 404 });
    }

    // 2. Compute Layer 2 Independent Signals Score
    const signalResult = await calculateIndependentScore({
      current_stage: ipo.current_stage,
      sector: ipo.sector,
      price_band: ipo.price_band,
      issue_size: ipo.issue_size,
    });

    // 3. Fetch latest snapshot values for RHP & News
    const [latestSnapshot] = await sql`
      SELECT rhp_score, news_score FROM score_snapshots
      WHERE ipo_id = ${ipoId} ORDER BY created_at DESC LIMIT 1;
    `;

    const rhpVal = latestSnapshot?.rhp_score ?? 72.0;
    const newsVal = latestSnapshot?.news_score ?? 75.0;

    // 4. Recompute composite score
    const compositeScore = (rhpVal * 0.5) + (signalResult.independent_score * 0.3) + (newsVal * 0.2);

    // 5. Persist new snapshot
    const [snapshot] = await sql`
      INSERT INTO score_snapshots (
        ipo_id, stage_at_time, rhp_score, independent_score, news_score, composite_score, weights_used
      ) VALUES (
        ${ipoId}, ${ipo.current_stage}, ${rhpVal}, ${signalResult.independent_score}, ${newsVal},
        ${Number(compositeScore.toFixed(1))}, '{"w1": 0.5, "w2": 0.3, "w3": 0.2}'
      )
      RETURNING *;
    `;

    return NextResponse.json({
      success: true,
      message: 'Layer 2 Independent Signals computed successfully!',
      independent_score: signalResult.independent_score,
      composite_score: snapshot.composite_score,
      subgroups: signalResult.subgroups,
      details: signalResult.details,
      snapshot,
    });
  } catch (error) {
    console.error('Error computing independent signals:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Signals computation failed' },
      { status: 500 }
    );
  }
}
