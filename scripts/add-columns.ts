import sql from '../src/lib/db.ts';

async function migrateColumns() {
  try {
    console.log('Adding columns to ipos table...');
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS detail_url TEXT;`;
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS description TEXT;`;
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS financials JSONB;`;
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS objects_of_issue TEXT;`;
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS kpis JSONB;`;
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS rhp_url TEXT;`;
    console.log('✅ Successfully added detail_url, description, financials, objects_of_issue, kpis, rhp_url to ipos table!');
  } catch (err: any) {
    console.error('Failed to add columns:', err.message);
  } finally {
    await sql.end();
  }
}

migrateColumns();
