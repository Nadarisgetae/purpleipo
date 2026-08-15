import sql from './db';
import { deleteFromR2 } from './r2';

export interface CleanupResult {
  purgedIpos: Array<{ id: string; name: string; listing_date: string | null }>;
  count: number;
}

/**
 * Purges all data for IPOs that have spent more than 3 days in "Listing Day Debut" (Stage 4).
 * Deletes from:
 *  1. Cloudflare R2 Object Storage (prospectuses/PDFs)
 *  2. PostgreSQL (factor_scores, ipo_documents, promoters, anchor_investors, subscription_data, ipos, companies)
 */
export async function cleanupExpiredListedIPOs(daysThreshold: number = 3): Promise<CleanupResult> {
  console.log(`\n🧹 Running ${daysThreshold}-day post-listing cleanup (Stage 4 / Listing Day Debut)...`);

  // Find IPOs in stage 4 where listing_date is > 3 days ago, OR updated_at is > 3 days ago if listing_date is null
  const expiredIpos = await sql`
    SELECT i.id, i.company_id, c.name, i.listing_date, i.rhp_url, i.updated_at
    FROM ipos i
    JOIN companies c ON i.company_id = c.id
    WHERE i.current_stage = 4
      AND (
        (i.listing_date IS NOT NULL AND i.listing_date < CURRENT_DATE - (${daysThreshold} || ' days')::INTERVAL)
        OR (i.listing_date IS NULL AND i.updated_at < NOW() - (${daysThreshold} || ' days')::INTERVAL)
      );
  `;

  if (expiredIpos.length === 0) {
    console.log(`  ✓ No expired listed IPOs found exceeding ${daysThreshold} days in Debut stage.`);
    return { purgedIpos: [], count: 0 };
  }

  console.log(`  ⚠️ Found ${expiredIpos.length} expired listed IPO(s) to purge:`);
  expiredIpos.forEach((ipo: any) => {
    console.log(`    - "${ipo.name}" (ID: ${ipo.id}, Listed: ${ipo.listing_date || 'N/A'})`);
  });

  const purgedList: Array<{ id: string; name: string; listing_date: string | null }> = [];

  for (const ipo of expiredIpos) {
    console.log(`\n  🗑️ Purging all records for: "${ipo.name}"...`);

    // 1. Delete associated R2 documents
    if (ipo.rhp_url && ipo.rhp_url.includes('r2.cloudflarestorage.com')) {
      await deleteFromR2(ipo.rhp_url);
    }

    try {
      const docUrls = await sql`
        SELECT document_url FROM ipo_documents WHERE ipo_id = ${ipo.id} AND document_url IS NOT NULL;
      `;
      for (const doc of docUrls) {
        if (doc.document_url && doc.document_url.includes('r2.cloudflarestorage.com')) {
          await deleteFromR2(doc.document_url);
        }
      }
    } catch (docErr) {}

    // 2. Cascade delete from all relational tables
    await sql`DELETE FROM factor_scores WHERE ipo_id = ${ipo.id};`;
    await sql`DELETE FROM ipo_documents WHERE ipo_id = ${ipo.id};`;
    await sql`DELETE FROM promoters WHERE ipo_id = ${ipo.id};`;
    await sql`DELETE FROM anchor_investors WHERE ipo_id = ${ipo.id};`;
    await sql`DELETE FROM subscription_data WHERE ipo_id = ${ipo.id};`;
    await sql`DELETE FROM ipos WHERE id = ${ipo.id};`;

    // 3. Delete company record if no other IPO references it
    const remainingForCompany = await sql`
      SELECT COUNT(*)::int as count FROM ipos WHERE company_id = ${ipo.company_id};
    `;
    if (remainingForCompany[0].count === 0) {
      await sql`DELETE FROM companies WHERE id = ${ipo.company_id};`;
    }

    console.log(`    ✅ Completely purged "${ipo.name}" from PostgreSQL & Cloudflare R2.`);
    purgedList.push({
      id: ipo.id,
      name: ipo.name,
      listing_date: ipo.listing_date,
    });
  }

  console.log(`\n🎉 Cleanup complete. Purged ${purgedList.length} expired listed IPOs.`);
  return {
    purgedIpos: purgedList,
    count: purgedList.length,
  };
}
