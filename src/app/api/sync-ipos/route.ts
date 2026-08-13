import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Authenticate the request
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.SYNC_SECRET;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
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
      } else {
        const newCompany = await sql`
          INSERT INTO companies (name, sector)
          VALUES (${item.company_name}, ${item.sector || 'Unknown'})
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
            current_stage = ${item.stage},
            issue_size = ${item.issue_size || null},
            price_band = ${item.price_band || null},
            lot_size = ${item.lot_size || null},
            minimum_investment = ${item.minimum_investment || null},
            subscription_rate = ${item.subscription_rate || null},
            oversubscription = ${item.oversubscription || null},
            issue_open_date = ${item.open_date || null},
            issue_close_date = ${item.close_date || null},
            listing_date = ${item.listing_date || null},
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
            issue_open_date, issue_close_date, listing_date
          )
          VALUES (
            ${companyId}, ${item.stage}, ${item.issue_size || null}, ${item.price_band || null}, 
            ${item.lot_size || null}, ${item.minimum_investment || null},
            ${item.subscription_rate || null}, ${item.oversubscription || null},
            ${item.open_date || null}, ${item.close_date || null}, ${item.listing_date || null}
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
