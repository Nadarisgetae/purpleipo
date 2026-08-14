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

const rows = await sql`
  SELECT c.name, i.promoters, i.anchor_investors, i.qib_details, i.updated_at
  FROM ipos i JOIN companies c ON c.id = i.company_id
  ORDER BY i.updated_at DESC
  LIMIT 25
`;

console.log('=== CURRENT DB STATE ===\n');
let withPromoters = 0, withQib = 0, withAnchor = 0;
for (const r of rows) {
  const p = r.promoters ? '✅' : '❌';
  const q = r.qib_details ? '✅' : '❌';
  const a = r.anchor_investors ? '✅' : '❌';
  if (r.promoters) withPromoters++;
  if (r.qib_details) withQib++;
  if (r.anchor_investors) withAnchor++;
  console.log(`${p}P ${q}Q ${a}A  ${r.name}`);
  if (r.promoters) console.log(`     Promoters: ${r.promoters.substring(0, 80)}`);
  if (r.anchor_investors) console.log(`     Anchor: ${r.anchor_investors.substring(0, 80)}`);
  if (r.qib_details) console.log(`     QIB: ${r.qib_details.substring(0, 80)}`);
}

console.log(`\nSummary: ${withPromoters} with promoters, ${withQib} with QIB, ${withAnchor} with anchor`);

await sql.end();
