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

const docs = await sql`
  SELECT d.*, c.name 
  FROM ipo_documents d
  JOIN ipos i ON d.ipo_id = i.id
  JOIN companies c ON i.company_id = c.id
  LIMIT 5
`;

console.log('IPO Documents:');
console.log(docs);

// Check if any factor scores have evidence text or if sections exist
const sectionsCount = await sql`
  SELECT COUNT(*) FROM ipo_documents WHERE parsed_at IS NOT NULL
`;
console.log('\nParsed RHP count:', sectionsCount[0].count);

await sql.end();
