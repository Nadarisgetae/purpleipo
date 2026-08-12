import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

console.log('\n========================================');
console.log('  PURPLEIPO — SUPABASE CONNECTION TEST  ');
console.log('========================================\n');

if (!dbUrl || dbUrl.includes('YOUR_ACTUAL_PASSWORD') || dbUrl.includes('your-ref')) {
  console.error('❌ ERROR: DATABASE_URL in .env.local is missing or contains placeholder values.');
  console.log('\nPlease update c:\\PurpleIPO\\.env.local with your real Supabase connection string.\n');
  process.exit(1);
}

console.log('📡 Connecting to Supabase database...');

try {
  const sql = postgres(dbUrl, { max: 1, timeout: 10 });
  const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
  
  console.log('\n✅ SUCCESS! Database connected successfully!');
  console.log(`⏰ Supabase Time: ${result[0].current_time}`);
  console.log(`ℹ️ PostgreSQL Version: ${result[0].pg_version.split(' ')[0]} ${result[0].pg_version.split(' ')[1]}\n`);
  
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error('\n❌ CONNECTION FAILED:');
  console.error(err.message);
  console.log('\n💡 Troubleshooting Tips:');
  console.log('1. Check if your password in DATABASE_URL has special characters. If so, URL-encode them (e.g. @ -> %40).');
  console.log('2. Ensure you selected Port 6543 (Transaction Pooler) or Port 5432 (Direct) in Supabase Settings.');
  console.log('3. Verify your internet connection.\n');
  process.exit(1);
}
