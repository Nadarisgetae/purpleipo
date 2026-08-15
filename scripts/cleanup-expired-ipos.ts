import { cleanupExpiredListedIPOs } from '../src/lib/cleanup.ts';
import sql from '../src/lib/db.ts';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  const days = process.argv[2] ? parseInt(process.argv[2], 10) : 3;
  console.log(`Starting post-listing purge runner (Threshold: ${days} days)...`);
  try {
    const result = await cleanupExpiredListedIPOs(days);
    console.log('\nPurge Summary:');
    console.log(`Total IPOs deleted from PostgreSQL & Cloudflare R2: ${result.count}`);
    if (result.purgedIpos.length > 0) {
      console.table(result.purgedIpos);
    }
  } catch (err: any) {
    console.error('Cleanup execution failed:', err.message);
  } finally {
    await sql.end();
  }
}

run();
