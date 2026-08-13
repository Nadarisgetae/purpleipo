import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) process.exit(1);

const sql = postgres(dbUrl, { max: 1, ssl: 'require' });

async function run() {
  try {
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS lot_size VARCHAR(50)`;
    await sql`ALTER TABLE ipos ADD COLUMN IF NOT EXISTS minimum_investment VARCHAR(50)`;
    
    // Seed some mock data for existing rows
    await sql`UPDATE ipos SET lot_size = '65 Shares', minimum_investment = '₹14,950' WHERE lot_size IS NULL`;
    
    console.log('Successfully added lot_size and minimum_investment');
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

run();
