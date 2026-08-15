import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ipoId = params.id;
  if (!ipoId) {
    return NextResponse.json({ error: 'Missing IPO ID' }, { status: 400 });
  }

  try {
    // 1. Fetch IPO details and company name
    const ipoQuery = await sql`
      SELECT i.*, c.name as company_name, c.sector as company_sector
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = ${ipoId}
      LIMIT 1;
    `;

    if (ipoQuery.length === 0) {
      return NextResponse.json({ error: 'IPO not found' }, { status: 404 });
    }
    const ipo = ipoQuery[0];

    // 2. Fetch promoters list
    const promoters = await sql`
      SELECT name FROM promoters WHERE ipo_id = ${ipoId} ORDER BY name;
    `;

    // 3. Fetch anchor investors list
    const anchors = await sql`
      SELECT investor_name, shares_allocated, amount 
      FROM anchor_investors 
      WHERE ipo_id = ${ipoId} 
      ORDER BY amount DESC;
    `;

    // 4. Fetch subscription data
    const subscription = await sql`
      SELECT category, times_subscribed, recorded_at 
      FROM subscription_data 
      WHERE ipo_id = ${ipoId} 
      ORDER BY category ASC;
    `;

    // 5. Fetch factor scores
    const factorScores = await sql`
      SELECT factor_key, category, score, confidence, evidence_text, source_section
      FROM factor_scores
      WHERE ipo_id = ${ipoId}
      ORDER BY category, score DESC;
    `;

    // 6. Fetch RHP/DRHP document URL
    const documents = await sql`
      SELECT file_url, type, parsed_at FROM ipo_documents
      WHERE ipo_id = ${ipoId}
      ORDER BY parsed_at DESC
      LIMIT 1;
    `;

    return NextResponse.json({
      ipo,
      promoters: promoters.map(p => p.name),
      anchors,
      subscription,
      factorScores,
      document: documents.length > 0 ? documents[0] : null
    });
  } catch (err: any) {
    console.error('Error fetching IPO detail API:', err.message);
    return NextResponse.json({ error: 'Server database error' }, { status: 500 });
  }
}
