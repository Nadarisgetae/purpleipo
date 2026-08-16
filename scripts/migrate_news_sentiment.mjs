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
console.log('  PURPLEIPO — MIGRATING NEWS SENTIMENT SCHEMA ');
console.log('=============================================\n');

async function migrate() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS news_articles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
        analysis_run_id UUID NOT NULL,
        headline TEXT NOT NULL,
        url TEXT,
        source VARCHAR(255),
        published_at TIMESTAMP WITH TIME ZONE,
        sentiment_score NUMERIC(3, 2),
        topic_tag VARCHAR(100),
        relevance_score NUMERIC(3, 2),
        headline_body_consistent BOOLEAN,
        fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        scored_at TIMESTAMP WITH TIME ZONE
      );
    `;
    console.log('  ✓ Table created: news_articles');

    await sql`
      CREATE TABLE IF NOT EXISTS news_sentiment_snapshots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ipo_id UUID NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
        analysis_run_id UUID NOT NULL,
        weighted_avg_sentiment NUMERIC(3, 2),
        sentiment_trend_direction VARCHAR(20),
        coverage_volume_recent INT,
        sentiment_dispersion NUMERIC(3, 2),
        news_sentiment_score NUMERIC(5, 2),
        articles_scored_count INT,
        triggered_by VARCHAR(50) DEFAULT 'user_click',
        computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Table created: news_sentiment_snapshots');

    console.log('\n🎉 NEWS SENTIMENT MIGRATIONS COMPLETED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('\n❌ MIGRATION ERROR:', err.message);
  } finally {
    await sql.end();
  }
}

migrate();
