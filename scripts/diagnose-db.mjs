/**
 * Diagnostic: check company name matching between ipowatch and DB
 */
import postgres from 'postgres';
import { readFileSync } from 'fs';

function loadEnv() {
  try {
    const env = readFileSync('.env.local', 'utf8');
    for (const line of env.split('\n')) {
      const clean = line.replace(/\r/g, '').trim();
      if (!clean || clean.startsWith('#')) continue;
      const eqIdx = clean.indexOf('=');
      if (eqIdx === -1) continue;
      const key = clean.substring(0, eqIdx).trim();
      let val = clean.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (key.includes('\0') || val.includes('\0')) continue;
      process.env[key] = val;
    }
  } catch (e) {}
}
loadEnv();

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

// Show all companies and IPO ids
const rows = await sql`
  SELECT c.id, c.name, i.id as ipo_id, i.promoters, i.anchor_investors, i.qib_details
  FROM companies c 
  JOIN ipos i ON i.company_id = c.id
  ORDER BY c.name
  LIMIT 20
`;

console.log('DB companies and IPO IDs:\n');
for (const r of rows) {
  console.log(`CID: ${r.id}, IID: ${r.ipo_id}, Name: "${r.name}"`);
  console.log(`  Promoters: ${r.promoters ? r.promoters.substring(0,50) : 'NULL'}`);
  console.log(`  Anchor: ${r.anchor_investors ? r.anchor_investors.substring(0,50) : 'NULL'}`);
  console.log(`  QIB: ${r.qib_details ? r.qib_details.substring(0,50) : 'NULL'}`);
  console.log('');
}

// Try the exact query used in the script
const testCompany = 'Gaja Alternative Asset M'; // first 15 chars would be "Gaja Alternativ"
const shortName = 'Gaja Alternativ';
console.log(`\nTesting lookup with: '%${shortName}%'`);
const found = await sql`SELECT i.id FROM ipos i JOIN companies c ON c.id = i.company_id WHERE c.name ILIKE ${'%' + shortName + '%'} LIMIT 1`;
console.log('Found:', found);

// Test direct update
console.log('\nTest direct UPDATE on Gaja...');
const gajaRows = await sql`SELECT i.id FROM ipos i JOIN companies c ON c.id = i.company_id WHERE c.name ILIKE '%Gaja%' LIMIT 1`;
if (gajaRows.length > 0) {
  const id = gajaRows[0].id;
  console.log(`Updating IPO id: ${id}`);
  const updated = await sql`
    UPDATE ipos SET
      promoters = ${'TEST PROMOTER'},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, promoters
  `;
  console.log('Update result:', updated);
}

await sql.end();
