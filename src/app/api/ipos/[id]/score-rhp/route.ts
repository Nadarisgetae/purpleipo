import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { calculateRHPScore } from '@/lib/scoring-engine';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: ipoId } = params;

    // 1. Fetch IPO & Company data
    const [ipo] = await sql`
      SELECT 
        i.*,
        c.name as company_name,
        c.sector,
        c.cin
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = ${ipoId};
    `;

    if (!ipo) {
      return NextResponse.json({ success: false, message: 'IPO not found' }, { status: 404 });
    }

    // 2. Fetch parsed document sections if any
    const docs = await sql`
      SELECT * FROM ipo_documents WHERE ipo_id = ${ipoId} ORDER BY filed_date DESC LIMIT 1;
    `;

    // 3. Compute 23-factor Layer 1 RHP Score
    const scoringResult = await calculateRHPScore({
      company_name: ipo.company_name,
      sector: ipo.sector,
      issue_size: ipo.issue_size,
      fresh_issue_amount: ipo.fresh_issue_amount,
      ofs_amount: ipo.ofs_amount,
      price_band: ipo.price_band,
      current_stage: ipo.current_stage,
      promoters: ipo.promoters,
      anchor_investors: ipo.anchor_investors,
      qib_details: ipo.qib_details,
      subscription_rate: ipo.subscription_rate,
      gmp: ipo.gmp,
      sections: docs.length > 0 ? (docs[0].sections || {}) : {},
    });

    // 4. Save individual factor scores into Supabase `factor_scores` table
    await sql`DELETE FROM factor_scores WHERE ipo_id = ${ipoId} AND layer = 'rhp';`;

    for (const factor of scoringResult.factor_results) {
      await sql`
        INSERT INTO factor_scores (
          ipo_id, factor_key, layer, category, score, confidence, evidence_text, source_section
        ) VALUES (
          ${ipoId}, ${factor.factor_key}, 'rhp', ${factor.category},
          ${factor.score}, ${factor.confidence}, ${factor.evidence_text}, ${factor.source_section}
        );
      `;
    }

    // 5. Fetch latest Independent and News scores or default
    const [latestSnapshot] = await sql`
      SELECT independent_score, news_score FROM score_snapshots 
      WHERE ipo_id = ${ipoId} ORDER BY created_at DESC LIMIT 1;
    `;

    const indepVal = latestSnapshot?.independent_score ?? 68.0;
    const newsVal = latestSnapshot?.news_score ?? 75.0;

    // Composite formula: (RHP * 0.5) + (Indep * 0.3) + (News * 0.2)
    const compositeScore = (scoringResult.rhp_score * 0.5) + (indepVal * 0.3) + (newsVal * 0.2);

    // 6. Record new Score Snapshot
    const [snapshot] = await sql`
      INSERT INTO score_snapshots (
        ipo_id, stage_at_time, rhp_score, independent_score, news_score, composite_score, weights_used
      ) VALUES (
        ${ipoId}, ${ipo.current_stage}, ${scoringResult.rhp_score}, ${indepVal}, ${newsVal},
        ${Number(compositeScore.toFixed(1))}, '{"w1": 0.5, "w2": 0.3, "w3": 0.2}'
      )
      RETURNING *;
    `;

    return NextResponse.json({
      success: true,
      message: 'Layer 1 RHP Scoring Engine executed successfully!',
      rhp_score: scoringResult.rhp_score,
      composite_score: snapshot.composite_score,
      categories: scoringResult.categories,
      factor_scores: scoringResult.factor_results,
      snapshot,
    });
  } catch (error) {
    console.error('Error running RHP scoring engine:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Scoring failed' },
      { status: 500 }
    );
  }
}
