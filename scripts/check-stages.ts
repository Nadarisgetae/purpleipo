import sql from '../src/lib/db.ts';

async function checkStages() {
  const res = await sql`
    SELECT DISTINCT current_stage, count(*)::int as count 
    FROM ipos 
    GROUP BY current_stage;
  `;
  console.log('Stages Distribution:');
  console.table(res);

  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ipos';
  `;
  console.log('\nipos table columns:');
  console.table(cols);

  const sample = await sql`
    SELECT c.name, i.current_stage, i.listing_date, i.offer_start_date, i.offer_end_date, i.created_at, i.updated_at, i.rhp_url
    FROM ipos i JOIN companies c ON i.company_id = c.id
    WHERE i.current_stage = 4
    LIMIT 5;
  `;
  console.log('\nStage 4 IPOs:');
  console.table(sample);

  await sql.end();
  process.exit(0);
}

checkStages();
