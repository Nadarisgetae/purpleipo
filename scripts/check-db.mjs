import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;
const sql = postgres(dbUrl, { max: 1 });

async function run() {
  try {
    const res = await sql`SELECT name, issue_size, lot_size, minimum_investment, subscription_rate FROM companies JOIN ipos on ipos.company_id = companies.id WHERE type != 'Unknown' LIMIT 10`;
    console.log(res);
  } finally {
    await sql.end();
  }
}

run();
