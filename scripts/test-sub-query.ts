import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });
import sql from '../src/lib/db';

async function testQuery() {
  const ipos = await sql`
    SELECT 
      i.id,
      i.current_stage,
      c.name as company_name,
      MAX(CASE WHEN s.category ILIKE '%Total%' THEN s.times_subscribed END) as total_subscription,
      MAX(CASE WHEN s.category ILIKE '%Retail%' THEN s.times_subscribed END) as retail_subscription,
      MAX(CASE WHEN s.category ILIKE '%QIB%' THEN s.times_subscribed END) as qib_subscription,
      MAX(CASE WHEN s.category ILIKE '%HNI%' OR s.category ILIKE '%NII%' THEN s.times_subscribed END) as hni_subscription
    FROM ipos i
    JOIN companies c ON i.company_id = c.id
    LEFT JOIN subscription_data s ON s.ipo_id = i.id
    GROUP BY i.id, c.name
    ORDER BY i.issue_open_date DESC NULLS LAST;
  `;
  console.log('Tested Aggregated Query - Sample results:');
  console.table(ipos.slice(0, 15));
  await sql.end();
  process.exit(0);
}
testQuery();
