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

    return NextResponse.json({ success: true, count: ipos.length, data: ipos });
  } catch (error) {
    console.error('Error fetching IPOs:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch IPOs' }, { status: 500 });
  }
}
