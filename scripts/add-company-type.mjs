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
    console.log('Adding type column to companies table...');
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS type VARCHAR(50);`;
    console.log('Successfully updated schema!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

run();
