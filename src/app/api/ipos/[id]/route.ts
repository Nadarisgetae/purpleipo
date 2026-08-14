import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const [ipo] = await sql`
      SELECT 
        i.*,
        c.name as company_name,
        c.sector,
        c.type,
        c.cin
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = ${id};
    `;

    if (!ipo) {
      return NextResponse.json({ success: false, message: 'IPO not found' }, { status: 404 });
    }

    const documents = await sql`
      SELECT * FROM ipo_documents WHERE ipo_id = ${id} ORDER BY filed_date DESC;
    `;

    const factorScores = await sql`
      SELECT * FROM factor_scores WHERE ipo_id = ${id} ORDER BY layer, category;
    `;

    const scoreSnapshots = await sql`
      SELECT * FROM score_snapshots WHERE ipo_id = ${id} ORDER BY created_at ASC;
    `;

    const newsArticles = await sql`
      SELECT * FROM news_articles WHERE ipo_id = ${id} ORDER BY published_at DESC LIMIT 10;
    `;

    const subscriptions = await sql`
      SELECT * FROM subscription_data WHERE ipo_id = ${id} ORDER BY recorded_at DESC;
    `;

    return NextResponse.json({
      success: true,
      data: {
        ...ipo,
        listing_price: ipo.listing_price != null ? Number(ipo.listing_price) : null,
        listing_gain_pct: ipo.listing_gain_pct != null ? Number(ipo.listing_gain_pct) : null,
        documents,
        factor_scores: factorScores.map(f => ({ ...f, score: Number(f.score), confidence: Number(f.confidence) })),
        score_snapshots: scoreSnapshots.map(s => ({
          ...s,
          rhp_score: s.rhp_score != null ? Number(s.rhp_score) : null,
          independent_score: s.independent_score != null ? Number(s.independent_score) : null,
          news_score: s.news_score != null ? Number(s.news_score) : null,
          composite_score: s.composite_score != null ? Number(s.composite_score) : null,
        })),
        news_articles: newsArticles,
        subscriptions,
      },
    });
  } catch (error) {
    console.error('Error fetching IPO detail:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch IPO detail' }, { status: 500 });
  }
}

/**
 * PATCH /api/ipos/[id]
 * Updates listing price, listing gain %, and/or current_stage for an IPO.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const { listing_price, listing_gain_pct, current_stage } = body as {
      listing_price?: number;
      listing_gain_pct?: number;
      current_stage?: number;
    };

    // Build dynamic update — only update fields that are provided
    if (listing_price !== undefined && listing_gain_pct !== undefined) {
      await sql`
        UPDATE ipos
        SET 
          listing_price = ${listing_price},
          listing_gain_pct = ${listing_gain_pct},
          updated_at = NOW()
        WHERE id = ${id};
      `;
    }

    if (current_stage !== undefined) {
      await sql`
        UPDATE ipos
        SET current_stage = ${current_stage}, updated_at = NOW()
        WHERE id = ${id};
      `;
    }

    const [updated] = await sql`
      SELECT i.*, c.name as company_name, c.sector
      FROM ipos i JOIN companies c ON i.company_id = c.id
      WHERE i.id = ${id};
    `;

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating IPO:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}
