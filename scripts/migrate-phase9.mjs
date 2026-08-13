/**
 * Phase 9 — adds created_at to news_articles and creates sync_log table.
 * Run: node scripts/migrate-phase9.mjs
 */
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

console.log('\n============================================');
console.log('  PURPLEIPO — PHASE 9 SCHEMA MIGRATION     ');
console.log('============================================\n');

try {
  // Add created_at to news_articles (missing from original schema)
  await sql`
    ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  `;
  console.log('  ✓ Added column: news_articles.created_at');

  // Add index for fast headline dedup lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_news_articles_headline ON news_articles (headline);
  `.catch(() => {}); // ignore if already exists
  console.log('  ✓ Index created: idx_news_articles_headline');

  // Add index on published_at for ordering
  await sql`
    CREATE INDEX IF NOT EXISTS idx_news_articles_published ON news_articles (published_at DESC);
  `.catch(() => {});
  console.log('  ✓ Index created: idx_news_articles_published');

  // Sync log table — tracks each auto-sync run
  await sql`
    CREATE TABLE IF NOT EXISTS sync_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      ipos_synced INT DEFAULT 0,
      articles_saved INT DEFAULT 0,
      stage_changes INT DEFAULT 0,
      duration_ms INT DEFAULT 0
    );
  `;
  console.log('  ✓ Table created: sync_log');

  console.log('\n🎉 Phase 9 migration completed successfully!\n');
} catch (err) {
  console.error('\n❌ Migration error:', err.message);
} finally {
  await sql.end();
}
