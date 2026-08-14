import sql from '../src/lib/db.js';
import { calculateRHPScore } from '../src/lib/scoring-engine.js';
import { calculateIndependentScore } from '../src/lib/market-signals.js';
import { calculateNewsScore } from '../src/lib/news-sentiment.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function diagnose() {
  console.log("=== PURPLEIPO COMPREHENSIVE PIPELINE DIAGNOSTIC ===\n");
  
  // 1. Check Database State
  const iposCount = await sql`SELECT count(*) as count FROM ipos`;
  console.log(`[DB] Total IPOs in Database: ${iposCount[0].count}`);
  
  const docsCount = await sql`SELECT count(*) as count FROM ipo_documents`;
  console.log(`[DB] Total DRHP Documents: ${docsCount[0].count}`);
  
  if (iposCount[0].count === 0) {
    console.error("❌ No IPOs found in the database. Run `node scripts/seed-live-2026.mjs` to fetch live IPOs.");
    process.exit(1);
  }

  // Pick one IPO that has a document
  let targetIpo = await sql`
    SELECT i.*, c.name as company_name 
    FROM ipos i 
    JOIN companies c ON i.company_id = c.id
    WHERE EXISTS (SELECT 1 FROM ipo_documents WHERE ipo_id = i.id)
    LIMIT 1;
  `;

  if (targetIpo.length === 0) {
    console.warn("⚠️ No IPOs have DRHP documents. Picking a random IPO.");
    targetIpo = await sql`
      SELECT i.*, c.name as company_name 
      FROM ipos i 
      JOIN companies c ON i.company_id = c.id
      LIMIT 1;
    `;
  }
  
  const ipo = targetIpo[0];
  console.log(`\nSelected IPO for Diagnostics: ${ipo.company_name} (ID: ${ipo.id})\n`);

  // --- LAYER 1: RHP SCORING ---
  console.log("--- LAYER 1: RHP Engine ---");
  const docs = await sql`SELECT * FROM ipo_documents WHERE ipo_id = ${ipo.id} LIMIT 1`;
  const sections = docs.length > 0 ? (docs[0].sections || {}) : {};
  console.log(`DRHP Sections Available: ${Object.keys(sections).join(', ') || 'NONE - WILL USE MOCKS!'}`);
  
  try {
    const rhpResult = await calculateRHPScore({
      company_name: ipo.company_name,
      sector: ipo.sector || 'Unknown',
      current_stage: ipo.current_stage || 1,
      sections
    });
    console.log(`✅ RHP Score: ${rhpResult.rhp_score}`);
    console.log("Extracted Fundamentals (Check for mocks!):", JSON.stringify(rhpResult.factor_results, null, 2).substring(0, 300) + '...');
  } catch (e) {
    console.error("❌ RHP Scoring Failed:", e.message);
  }

  // --- LAYER 2: MARKET SIGNALS ---
  console.log("\n--- LAYER 2: Market Signals ---");
  try {
    // Check if subscription data exists (using created_at instead of fetched_at)
    const subData = await sql`SELECT * FROM subscription_data WHERE ipo_id = ${ipo.id} ORDER BY recorded_at DESC LIMIT 1`;
    console.log(`Subscription Data: ${subData.length > 0 ? JSON.stringify(subData[0]) : 'NONE - WILL FALLBACK!'}`);
    
    const marketResult = await calculateIndependentScore({
      company_name: ipo.company_name,
      ipo_id: ipo.id
    });
    console.log(`✅ Market Score: ${marketResult.independent_score}`);
    console.log("Market Analysis (Check for mocks!):", (marketResult.analysis || '').substring(0, 300) + '...');
  } catch (e) {
    console.error("❌ Market Scoring Failed:", e.message);
  }

  // --- LAYER 3: NEWS SENTIMENT ---
  console.log("\n--- LAYER 3: News Sentiment ---");
  try {
    const newsResult = await calculateNewsScore({
      company_name: ipo.company_name
    });
    console.log(`✅ News Score: ${newsResult.news_score}`);
    console.log("News Headlines used:", newsResult.top_headlines.map((a: any) => a.title));
  } catch (e) {
    console.error("❌ News Scoring Failed:", e.message);
  }
  
  console.log("\n=== DIAGNOSTIC COMPLETE ===");
  process.exit(0);
}

diagnose();
