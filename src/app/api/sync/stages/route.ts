import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';

export const dynamic = 'force-dynamic';

/**
 * Recalculates current_stage for every IPO in the DB based on today's date
 * vs the stored issue_open_date, issue_close_date, and listing_date columns.
 *
 * Stage rules:
 *   1 — Bidding Not Open   : today < issue_open_date  (or no open date yet)
 *   2 — Bidding Window Open: issue_open_date <= today <= issue_close_date
 *   3 — Allotment Finalized: today > issue_close_date AND today < listing_date
 *   4 — Listing Day Debut  : today >= listing_date
 */
export async function POST() {
  try {
    const result = await sql`
      UPDATE ipos
      SET
        current_stage = CASE
          -- Stage 4: listed
          WHEN listing_date IS NOT NULL AND CURRENT_DATE >= listing_date::date
            THEN 4
          -- Stage 3: bidding closed, awaiting listing
          WHEN issue_close_date IS NOT NULL AND CURRENT_DATE > issue_close_date::date
            AND (listing_date IS NULL OR CURRENT_DATE < listing_date::date)
            THEN 3
          -- Stage 2: bidding window open right now
          WHEN issue_open_date IS NOT NULL AND CURRENT_DATE >= issue_open_date::date
            AND (issue_close_date IS NULL OR CURRENT_DATE <= issue_close_date::date)
            THEN 2
          -- Stage 1: upcoming / not yet open
          ELSE 1
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        -- Only update rows where the calculated stage would actually differ
        current_stage IS DISTINCT FROM CASE
          WHEN listing_date IS NOT NULL AND CURRENT_DATE >= listing_date::date THEN 4
          WHEN issue_close_date IS NOT NULL AND CURRENT_DATE > issue_close_date::date
            AND (listing_date IS NULL OR CURRENT_DATE < listing_date::date) THEN 3
          WHEN issue_open_date IS NOT NULL AND CURRENT_DATE >= issue_open_date::date
            AND (issue_close_date IS NULL OR CURRENT_DATE <= issue_close_date::date) THEN 2
          ELSE 1
        END
      RETURNING id, current_stage;
    `;

    console.log(`✅ Stage recalculation complete — updated ${result.length} IPO(s).`);
    return NextResponse.json({
      success: true,
      updated: result.length,
      changes: result.map((r: any) => ({ id: r.id, newStage: r.current_stage })),
    });
  } catch (err: any) {
    console.error('Stage recalculation failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
