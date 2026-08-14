import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Authenticate the request
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.SYNC_SECRET;
    
    if (process.env.NODE_ENV !== 'development' && (!expectedToken || authHeader !== `Bearer ${expectedToken}`)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse the incoming IPO data
    const { ipos } = await request.json();

    if (!Array.isArray(ipos) || ipos.length === 0) {
      return NextResponse.json({ success: false, message: 'No IPO data provided' }, { status: 400 });
    }

    let inserted = 0;
    let updated = 0;

    for (const item of ipos) {
      // Find or create company
      let companyId;
      const existingCompany = await sql`SELECT id FROM companies WHERE name ILIKE ${'%' + item.company_name + '%'} LIMIT 1`;
      
      if (existingCompany.length > 0) {
        companyId = existingCompany[0].id;
        // Optionally update the type if it was missing
        if (item.type) {
          await sql`UPDATE companies SET type = ${item.type} WHERE id = ${companyId}`;
        }
      } else {
        const newCompany = await sql`
          INSERT INTO companies (name, sector, type)
          VALUES (${item.company_name}, ${item.sector || 'Unknown'}, ${item.type || 'Unknown'})
          RETURNING id;
        `;
        companyId = newCompany[0].id;
      }

      // Find existing IPO for this company
      const existingIpo = await sql`SELECT id FROM ipos WHERE company_id = ${companyId} LIMIT 1`;

      if (existingIpo.length > 0) {
        // Update existing IPO
        await sql`
          UPDATE ipos 
          SET 
            current_stage = COALESCE(${item.stage}, current_stage),
            issue_size = COALESCE(${item.issue_size || null}, issue_size),
            price_band = COALESCE(${item.price_band || null}, price_band),
            lot_size = COALESCE(${item.lot_size || null}, lot_size),
            minimum_investment = COALESCE(${item.minimum_investment || null}, minimum_investment),
            subscription_rate = COALESCE(${item.subscription_rate || null}, subscription_rate),
            oversubscription = COALESCE(${item.oversubscription || null}, oversubscription),
            issue_open_date = COALESCE(${item.open_date || null}, issue_open_date),
            issue_close_date = COALESCE(${item.close_date || null}, issue_close_date),
            listing_date = COALESCE(${item.listing_date || null}, listing_date),
            promoters = COALESCE(${item.promoters || null}, promoters),
            qib_details = COALESCE(${item.qib_details || null}, qib_details),
            anchor_investors = COALESCE(${item.anchor_investors || null}, anchor_investors),
            rating_score = COALESCE(${item.rating_score || null}, rating_score),
            gmp = COALESCE(${item.gmp || null}, gmp),
            updated_at = NOW()
          WHERE id = ${existingIpo[0].id}
        `;
        updated++;
      } else {
        // Insert new IPO
        await sql`
          INSERT INTO ipos (
            company_id, current_stage, issue_size, price_band, lot_size, minimum_investment,
            subscription_rate, oversubscription,
            issue_open_date, issue_close_date, listing_date,
            promoters, qib_details, anchor_investors, rating_score, gmp
          )
          VALUES (
            ${companyId}, ${item.stage}, ${item.issue_size || null}, ${item.price_band || null}, 
            ${item.lot_size || null}, ${item.minimum_investment || null},
            ${item.subscription_rate || null}, ${item.oversubscription || null},
            ${item.open_date || null}, ${item.close_date || null}, ${item.listing_date || null},
            ${item.promoters || null}, ${item.qib_details || null}, ${item.anchor_investors || null}, ${item.rating_score || null}, ${item.gmp || null}
          )
        `;
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync complete. Inserted: ${inserted}, Updated: ${updated}`,
      inserted,
      updated
    });
  } catch (error) {
    console.error('Sync Error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
