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

console.log('\n=============================================');
console.log('  PURPLEIPO — MIGRATING SIMPLIFIED RHP SCHEMA ');
console.log('=============================================\n');

async function migrate() {
  try {
    // 1. Extensions
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

    // Drop old tables if they exist to start fresh
    console.log('Dropping old tables if they exist...');
    await sql`DROP TABLE IF EXISTS llm_key_state CASCADE;`;
    await sql`DROP TABLE IF EXISTS subscription_data CASCADE;`;
    await sql`DROP TABLE IF EXISTS score_snapshots CASCADE;`;
    await sql`DROP TABLE IF EXISTS factor_scores CASCADE;`;
    await sql`DROP TABLE IF EXISTS ipo_documents CASCADE;`;
    await sql`DROP TABLE IF EXISTS qib_allocations CASCADE;`;
    await sql`DROP TABLE IF EXISTS anchor_investors CASCADE;`;
    await sql`DROP TABLE IF EXISTS promoters CASCADE;`;
    await sql`DROP TABLE IF EXISTS ipos CASCADE;`;
    await sql`DROP TABLE IF EXISTS companies CASCADE;`;
    await sql`DROP TABLE IF EXISTS app_settings CASCADE;`;
    await sql`DROP TABLE IF EXISTS news_articles CASCADE;`;
    await sql`DROP TABLE IF EXISTS market_data_snapshots CASCADE;`;

    // 2. Companies table
    await sql`
      CREATE TABLE companies (
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
      CREATE TABLE ipos (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        current_stage INT NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 4),
        issue_size VARCHAR(100),
        price_band VARCHAR(100),
        lot_size VARCHAR(100),
        min_investment NUMERIC(15, 2),
        fresh_issue_amount VARCHAR(100),
        ofs_amount VARCHAR(100),
        board_type VARCHAR(20) DEFAULT 'MAINBOARD',
        category_tag VARCHAR(50),
        issue_open_date DATE,
        issue_close_date DATE,
        allotment_date DATE,
        listing_date DATE,
        rhp_score INT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Table created: ipos');

    // 4. Promoters table
    await sql`
      CREATE TABLE promoters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL
      );
    `;
    console.log('  ✓ Table created: promoters');

    // 5. Anchor Investors table
    await sql`
      CREATE TABLE anchor_investors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
        investor_name VARCHAR(255) NOT NULL,
        shares_allocated VARCHAR(100),
        amount VARCHAR(100)
      );
    `;
    console.log('  ✓ Table created: anchor_investors');

    // 6. QIB Allocations table
    await sql`
      CREATE TABLE qib_allocations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
        category_detail VARCHAR(255) NOT NULL,
        demand_multiple NUMERIC(10, 2)
      );
    `;
    console.log('  ✓ Table created: qib_allocations');

    // 7. IPO Documents table
    await sql`
      CREATE TABLE ipo_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('DRHP', 'RHP')),
        file_url TEXT NOT NULL,
        filed_date DATE,
        parsed_at TIMESTAMP WITH TIME ZONE,
        sections JSONB
      );
    `;
    console.log('  ✓ Table created: ipo_documents');

    // 8. Factor Scores table
    await sql`
      CREATE TABLE factor_scores (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
        factor_key VARCHAR(100) NOT NULL,
        category VARCHAR(100) NOT NULL,
        score NUMERIC(4, 2) NOT NULL CHECK (score BETWEEN 0 AND 10),
        confidence NUMERIC(3, 2) DEFAULT 1.0,
        evidence_text TEXT,
        source_section VARCHAR(255),
        computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Table created: factor_scores');

    // 9. Score Snapshots table
    await sql`
      CREATE TABLE score_snapshots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
        stage_at_time INT NOT NULL CHECK (stage_at_time BETWEEN 1 AND 4),
        rhp_score NUMERIC(5, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Table created: score_snapshots');

    // 10. Subscription Data table
    await sql`
      CREATE TABLE subscription_data (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL CHECK (category IN ('QIB', 'HNI', 'Retail', 'Employee', 'Total')),
        times_subscribed NUMERIC(10, 2) NOT NULL,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Table created: subscription_data');

    // 11. LLM Key State table
    await sql`
      CREATE TABLE llm_key_state (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider VARCHAR(50) NOT NULL DEFAULT 'openrouter',
        key_index INT NOT NULL,
        last_exhausted_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Table created: llm_key_state');

    console.log('\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('\n❌ MIGRATION ERROR:', err.message);
  } finally {
    await sql.end();
  }
}

migrate();
