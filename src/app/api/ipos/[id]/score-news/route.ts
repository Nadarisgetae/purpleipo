import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { calculateNewsScore } from '@/lib/news-sentiment';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: ipoId } = params;

    // 1. Fetch IPO + Company
    const [ipo] = await sql`
      SELECT i.*, c.name as company_name, c.sector
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = ${ipoId};
    `;

    if (!ipo) {
      return NextResponse.json({ success: false, message: 'IPO not found' }, { status: 404 });
    }

    // 2. Compute Layer 3 News Score via Gemini
    const newsResult = await calculateNewsScore({
      company_name: ipo.company_name,
      sector: ipo.sector,
    });

    // 3. Fetch latest snapshot for RHP & Independent scores
    const [latestSnapshot] = await sql`
      SELECT rhp_score, independent_score FROM score_snapshots
      WHERE ipo_id = ${ipoId} ORDER BY created_at DESC LIMIT 1;
    `;

    const rhpVal = latestSnapshot?.rhp_score ?? 72.0;
    const indepVal = latestSnapshot?.independent_score ?? 68.0;

    // 4. Composite with news
    const compositeScore = (rhpVal * 0.5) + (indepVal * 0.3) + (newsResult.news_score * 0.2);

    // 5. Save snapshot
    const [snapshot] = await sql`
      INSERT INTO score_snapshots (
        ipo_id, stage_at_time, rhp_score, independent_score, news_score, composite_score, weights_used
      ) VALUES (
        ${ipoId}, ${ipo.current_stage}, ${rhpVal}, ${indepVal}, ${newsResult.news_score},
        ${Number(compositeScore.toFixed(1))}, '{"w1": 0.5, "w2": 0.3, "w3": 0.2}'
      )
      RETURNING *;
    `;

    return NextResponse.json({
      success: true,
      message: 'Layer 3 News Sentiment computed successfully!',
      news_score: newsResult.news_score,
      composite_score: snapshot.composite_score,
      article_count: newsResult.article_count,
      positive_count: newsResult.positive_count,
      negative_count: newsResult.negative_count,
      neutral_count: newsResult.neutral_count,
      top_headlines: newsResult.top_headlines,
      summary: newsResult.summary,
      snapshot,
    });
  } catch (error) {
    console.error('Error computing news sentiment:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'News scoring failed' },
      { status: 500 }
    );
  }
}
