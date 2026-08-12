/**
 * Phase 7 Migration — adds listing_price and listing_gain_pct columns to ipos table.
 * Run with: node scripts/migrate-phase7.mjs
 */
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL missing in .env.local');
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

console.log('\n============================================');
console.log('  PURPLEIPO — PHASE 7 SCHEMA MIGRATION     ');
console.log('============================================\n');

try {
  // Add listing_price column if it doesn't exist
  await sql`
    ALTER TABLE ipos ADD COLUMN IF NOT EXISTS listing_price NUMERIC(10, 2);
  `;
  console.log('  ✓ Added column: ipos.listing_price');

  // Add listing_gain_pct column if it doesn't exist
  await sql`
    ALTER TABLE ipos ADD COLUMN IF NOT EXISTS listing_gain_pct NUMERIC(6, 2);
  `;
  console.log('  ✓ Added column: ipos.listing_gain_pct');

  console.log('\n🎉 Phase 7 migration completed successfully!\n');
} catch (err) {
  console.error('\n❌ Migration error:', err.message);
} finally {
  await sql.end();
}
