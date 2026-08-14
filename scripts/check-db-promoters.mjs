import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);

const rows = await sql`
  SELECT c.name, i.promoters, i.anchor_investors, i.qib_details, i.updated_at 
  FROM ipos i JOIN companies c ON c.id = i.company_id 
  ORDER BY i.updated_at DESC LIMIT 15
`;

console.log('Recent IPOs in DB:\n');
for (const r of rows) {
  console.log(`Company: ${r.name}`);
  console.log(`  Promoters:  ${r.promoters ?? 'NULL'}`);
  console.log(`  Anchor:     ${r.anchor_investors ?? 'NULL'}`);
  console.log(`  QIB:        ${r.qib_details ?? 'NULL'}`);
  console.log(`  Updated:    ${r.updated_at}`);
  console.log('');
}

await sql.end();
