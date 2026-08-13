export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    const ipos = await sql`
      SELECT 
        i.id,
        i.current_stage,
        i.issue_size,
        i.price_band,
        i.fresh_issue_amount,
        i.ofs_amount,
        i.lot_size,
        i.minimum_investment,
        i.subscription_rate,
        i.oversubscription,
        i.issue_open_date,
        i.issue_close_date,
        i.listing_date,
        i.created_at,
        c.name as company_name,
        c.sector,
        c.cin,
        s.rhp_score,
        s.independent_score,
        s.news_score,
        s.composite_score
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      LEFT JOIN LATERAL (
        SELECT rhp_score, independent_score, news_score, composite_score
        FROM score_snapshots
        WHERE ipo_id = i.id
        ORDER BY created_at DESC
        LIMIT 1
      ) s ON true
      ORDER BY i.current_stage DESC, i.created_at DESC;
    `;
    // Postgres returns numeric types as strings to preserve precision.
    // We must cast them to JavaScript Numbers before sending to the frontend
    // so that .toFixed() calls don't crash.
    const formattedData = ipos.map(i => ({
      ...i,
      rhp_score: i.rhp_score != null ? Number(i.rhp_score) : null,
      independent_score: i.independent_score != null ? Number(i.independent_score) : null,
      news_score: i.news_score != null ? Number(i.news_score) : null,
      composite_score: i.composite_score != null ? Number(i.composite_score) : null,
    }));

    return NextResponse.json({ success: true, count: formattedData.length, data: formattedData });
  } catch (error) {
    console.error('Error fetching IPOs:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch IPOs',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

