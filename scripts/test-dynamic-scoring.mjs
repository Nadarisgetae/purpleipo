import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateRHPScore } from './scoring-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testDynamicScoring() {
  console.log('\n======================================================');
  console.log('  PURPLEIPO — DYNAMIC SCORING ENGINE INTEGRATION TEST ');
  console.log('======================================================\n');

  // Verify GEMINI API key is available
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.includes('YOUR')) {
    console.error('❌ GEMINI_API_KEY is missing. Please set it in .env.local');
    process.exit(1);
  }

  // 1. Mock parsed RHP sections with specific financial facts
  const mockSections = {
    financial_statements: `
      Restated Financial Information Summary:
      Our revenue from operations grew at a CAGR of 32.5% over the last three financial years.
      Revenue in FY26 was Rs. 157.80 crores vs Rs. 123.31 crores in FY25.
      EBITDA margins have consistently improved from 42.1% in FY24 to 51.9% in FY26.
      Our net profit was Rs. 81.96 crores in FY26.
      Operating Cash Flow for FY26 was Rs. 94.25 crores, which represents 1.15x of our net profit.
      Days Sales Outstanding (DSO) stood at 25 days in FY26, reducing from 38 days in FY24.
      Our Debt-to-Equity ratio as of FY26 is low at 0.12x. Interest coverage is robust at 8.4x.
      Contingent liabilities aggregate to Rs. 3.2 crores, which is 1.5% of our net worth.
      Related party transactions for FY26 amounted to Rs. 2.3 crores, which is 1.4% of total revenue.
    `,
    objects_of_issue: `
      Objects of the Offer:
      The Offer consists of a Fresh Issue of Rs. 300 crores (60% of total) and an Offer for Sale of Rs. 200 crores (40%).
      Out of the Fresh Issue proceeds, Rs. 180 crores will be used for setting up new manufacturing facilities (growth capex),
      Rs. 50 crores for repayment of outstanding loans, and Rs. 70 crores for general corporate purposes (representing 23.3% of proceeds).
    `,
    capital_structure: `
      Capital Structure:
      Post-issue equity dilution is estimated at 15.2%.
      The ESOP pool represents 2.1% of the post-issue share capital.
      Promoters retain 62.4% control post-IPO, with a lock-in period of 36 months on their shares.
      Zero promoter shares have been pledged or encumbered.
    `,
    management: `
      Our Management:
      Experienced board of directors. Independent directors constitute 50% of our board.
      Clean audit report history for the last 3 financial years with zero qualifications or restatements.
    `,
    risk_factors: `
      Risk Factors:
      - Top 5 customers account for 28.4% of our total revenue.
      - We are subject to 2 tax litigations with a total claim amount of Rs. 1.2 crores.
    `
  };

  const ipoData = {
    company_name: 'Gaja Alternative Asset Management',
    sector: 'Financial Services',
    issue_size: '₹500 Cr',
    fresh_issue_amount: '₹300 Cr',
    ofs_amount: '₹200 Cr',
    price_band: '₹152 - ₹160',
    current_stage: 8,
    sections: mockSections
  };

  try {
    const result = await calculateRHPScore(ipoData);
    console.log('✅ Scoring Engine Executed Successfully!');
    console.log(`\nComposite RHP Score: ${result.rhp_score}/100`);
    console.log('\nCategory Scores:');
    console.log(` - Financial Health: ${result.categories.financial_health}/100`);
    console.log(` - Deal Structure:    ${result.categories.deal_structure}/100`);
    console.log(` - Governance:        ${result.categories.governance}/100`);
    console.log(` - Quality & Risk:    ${result.categories.quality_risk}/100`);
    console.log(` - Market Demand:     ${result.categories.market_demand}/100`);

    console.log('\nFactor Breakdown:');
    for (const f of result.factor_results) {
      console.log(`\n  [${f.factor_key}] (${f.category})`);
      console.log(`    Score:      ${f.score}/10`);
      console.log(`    Confidence: ${f.confidence}`);
      console.log(`    Evidence:   "${f.evidence_text}"`);
    }

    // Verify scores are dynamic
    const promoterPledgeFactor = result.factor_results.find(f => f.factor_key === 'promoter_pledging');
    if (promoterPledgeFactor && promoterPledgeFactor.score === 10) {
      console.log('\n✅ Dynamic Pledging Score verified (correctly returned 10/10 for 0% pledging)');
    } else {
      console.warn('\n⚠️ Pledging score verification failed');
    }

    const dsoFactor = result.factor_results.find(f => f.factor_key === 'working_capital_cycle');
    if (dsoFactor && dsoFactor.score > 8.0) {
      console.log(`✅ Dynamic Working Capital Score verified (returned ${dsoFactor.score}/10 for low DSO of 25 days)`);
    } else {
      console.warn('\n⚠️ Working Capital score verification failed');
    }

  } catch (err) {
    console.error('❌ Scoring failed:', err);
  }
}

testDynamicScoring();
