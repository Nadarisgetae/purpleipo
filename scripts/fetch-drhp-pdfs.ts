import sql from '../src/lib/db.ts';
import { scrapeDRHP } from '../src/lib/scrapers/pdfFetcher.ts';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  await scrapeDRHP();
  await sql.end();
}

run().catch(console.error);
