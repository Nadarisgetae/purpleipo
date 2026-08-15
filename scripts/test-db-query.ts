import sql from '../src/lib/db.ts';

async function testDb() {
  console.log('Querying database...');
  try {
    const res = await sql`SELECT NOW()`;
    console.log('Database time:', res[0].now);

    const summary = await sql`
      SELECT category_tag, COUNT(*) as count 
      FROM ipos 
      GROUP BY category_tag 
      ORDER BY count DESC;
    `;
    console.log('\n📊 IPO Breakdown by Category:');
    console.table(summary);

    const sample = await sql`
      SELECT c.name, i.category_tag, i.board_type, i.issue_size, i.current_stage
      FROM ipos i JOIN companies c ON i.company_id = c.id
      ORDER BY i.created_at DESC
      LIMIT 10;
    `;
    console.log('\n📋 Sample Fresh Scraped IPOs:');
    console.table(sample);
  } catch (err: any) {
    console.error('Database query failed:', err.message);
  } finally {
    await sql.end();
  }
}

testDb();
