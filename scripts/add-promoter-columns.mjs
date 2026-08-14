import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;
const sql = postgres(dbUrl, { max: 1 });

async function runMigration() {
  try {
    console.log('Adding new columns to ipos table...');
    
    await sql`
      ALTER TABLE ipos 
      ADD COLUMN IF NOT EXISTS promoters TEXT,
      ADD COLUMN IF NOT EXISTS qib_details TEXT,
      ADD COLUMN IF NOT EXISTS anchor_investors TEXT,
      ADD COLUMN IF NOT EXISTS rating_score NUMERIC(4,2),
      ADD COLUMN IF NOT EXISTS gmp NUMERIC(10,2);
    `;
    
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

runMigration();
