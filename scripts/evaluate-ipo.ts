import sql from '../src/lib/db.ts';
import { evaluateIPORHPScores } from '../src/lib/scoring.ts';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  console.log('Starting IPO Evaluation Runner...');
  try {
    // Select any active IPO from the database
    const activeIpos = await sql`
      SELECT i.id, c.name 
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      ORDER BY i.created_at DESC
      LIMIT 1;
    `;

    if (activeIpos.length === 0) {
      console.log('No IPOs found in database.');
      return;
    }

    const ipo = activeIpos[0];
    console.log(`Evaluating IPO for: "${ipo.name}" (ID: ${ipo.id})`);

    const score = await evaluateIPORHPScores(ipo.id);
    console.log(`\n🎉 Success! Calculated RHP Score for "${ipo.name}": ${score}/100`);

    // Let's print the detailed factor scores
    const factors = await sql`
      SELECT factor_key, category, score, evidence_text 
      FROM factor_scores 
      WHERE ipo_id = ${ipo.id}
      ORDER BY category, factor_key;
    `;
    console.log('\n--- DETAILED FACTOR SCORES ---');
    factors.forEach(f => {
      console.log(`[${f.category.toUpperCase()}] ${f.factor_key}: Score=${f.score} | ${f.evidence_text}`);
    });

  } catch (err: any) {
    console.error('Evaluation failed:', err.message);
  } finally {
    await sql.end();
  }
}

run();
