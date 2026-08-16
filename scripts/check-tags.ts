import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

import sql from '../src/lib/db.ts';

async function checkTags() {
  const tags = await sql`
    SELECT category_tag, board_type, count(*)::int as count 
    FROM ipos 
    GROUP BY category_tag, board_type;
  `;
  console.log('Category Tags Distribution:');
  console.table(tags);

  const sample = await sql`
    SELECT c.name, i.issue_size, i.board_type, i.category_tag, i.current_stage
    FROM ipos i JOIN companies c ON i.company_id = c.id 
    ORDER BY i.created_at DESC;
  `;
  console.log('\nAll Active IPOs in DB:');
  console.table(sample);

  await sql.end();
  process.exit(0);
}

checkTags();
