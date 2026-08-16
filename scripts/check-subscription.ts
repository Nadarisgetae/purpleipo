import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import sql from '../src/lib/db';

async function checkSub() {
  const sub = await sql`
    SELECT s.ipo_id, c.name, s.category, s.times_subscribed 
    FROM subscription_data s
    JOIN ipos i ON s.ipo_id = i.id
    JOIN companies c ON i.company_id = c.id
    LIMIT 20;
  `;
  console.log('Sample Subscription records:');
  console.table(sub);

  const totalSubs = await sql`
    SELECT count(*)::int as total FROM subscription_data;
  `;
  console.log('Total subscription entries:', totalSubs);

  // Check which IPOs have subscription data
  const ipoSummary = await sql`
    SELECT i.id, c.name, i.current_stage,
      json_agg(json_build_object('category', s.category, 'times_subscribed', s.times_subscribed)) as subscriptions
    FROM ipos i
    JOIN companies c ON i.company_id = c.id
    LEFT JOIN subscription_data s ON s.ipo_id = i.id
    WHERE i.current_stage > 1
    GROUP BY i.id, c.name, i.current_stage
    LIMIT 10;
  `;
  console.log('IPOs in Stage 2, 3, 4 with Subscription aggregations:');
  console.dir(ipoSummary, { depth: null });

  await sql.end();
  process.exit(0);
}

checkSub();
