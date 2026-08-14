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

console.log('\n========================================');
console.log('  PURPLEIPO — MIGRATING DATABASE SCHEMA ');
console.log('========================================\n');

try {
  // 1. Extensions
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

  // 2. Companies table
  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      sector VARCHAR(255),
      cin VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log('  ✓ Table created: companies');

  // 3. IPOs table
  await sql`
    CREATE TABLE IF NOT EXISTS ipos (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      current_stage INT NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 12),
      issue_size VARCHAR(100),
      price_band VARCHAR(100),
      fresh_issue_amount VARCHAR(100),
      ofs_amount VARCHAR(100),
      issue_open_date DATE,
      issue_close_date DATE,
      listing_date DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log('  ✓ Table created: ipos');

  // 4. IPO Documents table
  await sql`
    CREATE TABLE IF NOT EXISTS ipo_documents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL CHECK (type IN ('DRHP', 'RHP')),
      file_url TEXT NOT NULL,
      filed_date DATE,
      parsed_at TIMESTAMP WITH TIME ZONE,
      sections JSONB
    );
  `;
  await sql`ALTER TABLE ipo_documents ADD COLUMN IF NOT EXISTS sections JSONB;`;
  console.log('  ✓ Table created/updated: ipo_documents');

  // 5. Factor Scores table
  await sql`
    CREATE TABLE IF NOT EXISTS factor_scores (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
      factor_key VARCHAR(100) NOT NULL,
      layer VARCHAR(50) NOT NULL CHECK (layer IN ('rhp', 'independent', 'news')),
      category VARCHAR(100) NOT NULL,
      score NUMERIC(4, 2) NOT NULL CHECK (score BETWEEN 0 AND 10),
      confidence NUMERIC(3, 2) DEFAULT 1.0,
      evidence_text TEXT,
      source_section VARCHAR(255),
      computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log('  ✓ Table created: factor_scores');

  // 6. Score Snapshots table
  await sql`
    CREATE TABLE IF NOT EXISTS score_snapshots (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
      stage_at_time INT NOT NULL CHECK (stage_at_time BETWEEN 1 AND 12),
      rhp_score NUMERIC(5, 2),
      independent_score NUMERIC(5, 2),
      news_score NUMERIC(5, 2),
      composite_score NUMERIC(5, 2) NOT NULL,
      weights_used JSONB NOT NULL DEFAULT '{"w1": 0.5, "w2": 0.3, "w3": 0.2}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log('  ✓ Table created: score_snapshots');

  // 7. News Articles table
  await sql`
    CREATE TABLE IF NOT EXISTS news_articles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ipo_id UUID REFERENCES ipos(id) ON DELETE CASCADE,
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      headline TEXT NOT NULL,
      url TEXT NOT NULL,
      source VARCHAR(100),
      published_at TIMESTAMP WITH TIME ZONE,
      sentiment_score NUMERIC(3, 2),
      topic_tag VARCHAR(100)
    );
  `;
  console.log('  ✓ Table created: news_articles');

  // 8. Market Data Snapshots table
  await sql`
    CREATE TABLE IF NOT EXISTS market_data_snapshots (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      date DATE UNIQUE NOT NULL,
      nifty_level NUMERIC(10, 2),
      sensex_level NUMERIC(10, 2),
      india_vix NUMERIC(5, 2),
      fii_flow NUMERIC(12, 2),
      dii_flow NUMERIC(12, 2)
    );
  `;
  console.log('  ✓ Table created: market_data_snapshots');

  // 9. Subscription Data table
  await sql`
    CREATE TABLE IF NOT EXISTS subscription_data (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
      category VARCHAR(50) NOT NULL CHECK (category IN ('QIB', 'HNI', 'Retail', 'Employee', 'Total')),
      times_subscribed NUMERIC(6, 2) NOT NULL,
      recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log('  ✓ Table created: subscription_data');

  // 10. App Settings table
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(50) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log('  ✓ Table created: app_settings');

  console.log('\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!\n');
} catch (err) {
  console.error('\n❌ MIGRATION ERROR:', err.message);
} finally {
  await sql.end();
}
