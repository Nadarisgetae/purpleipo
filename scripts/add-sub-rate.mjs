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

const sanitizedDbUrl = dbUrl.replace(/^"|"$/g, '');
const sql = postgres(sanitizedDbUrl, { max: 1 });

async function run() {
  try {
    console.log('Adding subscription_rate and oversubscription to ipos table...');
    
    // Add columns if they don't exist
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS subscription_rate VARCHAR(100);`;
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS oversubscription VARCHAR(100);`;

    console.log('Successfully updated schema!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

run();
