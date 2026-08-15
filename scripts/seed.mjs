import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL missing in .env.local');
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

console.log('\n=======================================');
console.log('  PURPLEIPO — SEEDING SIMPLIFIED DATA ');
console.log('=======================================\n');

const sampleIPOs = [
  {
    company_name: 'Swiggy Limited',
    sector: 'Consumer Tech / Quick Commerce',
    cin: 'U74110KA2014PLC077853',
    stage: 2, // IPO Bidding Window Open
    issue_size: '11,327 Cr',
    price_band: '371 - 390',
    lot_size: '38',
    min_investment: 14820.00, // 38 * 390
    fresh_issue: '4,499 Cr',
    ofs: '6,828 Cr',
    open_date: '2026-11-06',
    close_date: '2026-11-08',
    allotment_date: '2026-11-11',
    listing_date: '2026-11-13',
    rhp_score: 72.5,
    promoters: ['Sriharsha Majety', 'Lakshmi Nandan Reddy Obulreddy', 'Rahul Jaimini'],
    anchor_investors: [
      { name: 'Fidelity Investment Trust', shares: '5,123,456', amount: '200 Cr' },
      { name: 'Government Pension Fund Global', shares: '3,846,153', amount: '150 Cr' },
      { name: 'ICICI Prudential Mutual Fund', shares: '2,564,102', amount: '100 Cr' }
    ],
    qib_allocations: [
      { category: 'Mutual Funds', multiple: 14.5 },
      { category: 'Foreign Portfolio Investors (FPIs)', multiple: 8.2 }
    ]
  },
  {
    company_name: 'Hyundai Motor India Ltd',
    sector: 'Automotive',
    cin: 'U29309TN1996PLC035377',
    stage: 4, // Listing Day Debut
    issue_size: '27,870 Cr',
    price_band: '1865 - 1960',
    lot_size: '7',
    min_investment: 13720.00, // 7 * 1960
    fresh_issue: '0 Cr (100% OFS)',
    ofs: '27,870 Cr',
    open_date: '2026-10-15',
    close_date: '2026-10-17',
    allotment_date: '2026-10-20',
    listing_date: '2026-10-22',
    rhp_score: 64.2,
    promoters: ['Hyundai Motor Company'],
    anchor_investors: [
      { name: 'Singapore Government GIC', shares: '2,040,816', amount: '400 Cr' },
      { name: 'BlackRock Global Funds', shares: '1,530,612', amount: '300 Cr' },
      { name: 'SBI Mutual Fund', shares: '1,020,408', amount: '200 Cr' }
    ],
    qib_allocations: [
      { category: 'QIB Bidding Multiple', multiple: 6.97 }
    ]
  },
  {
    company_name: 'Ardee Industries Limited',
    sector: 'Industrial Manufacturing',
    cin: 'U28113DL1990PLC041926',
    stage: 1, // Bidding Not Open
    issue_size: '850 Cr',
    price_band: '450 - 475',
    lot_size: '30',
    min_investment: 14250.00, // 30 * 475
    fresh_issue: '600 Cr',
    ofs: '250 Cr',
    open_date: '2026-12-01',
    close_date: '2026-12-03',
    allotment_date: '2026-12-08',
    listing_date: '2026-12-10',
    rhp_score: 0.0, // Needs calculation
    promoters: ['Arun Kumar Dey', 'Sunita Dey'],
    anchor_investors: [],
    qib_allocations: []
  }
];

async function seed() {
  try {
    console.log('Seeding companies and IPOs...');
    for (const item of sampleIPOs) {
      // 1. Insert Company
      const [comp] = await sql`
        INSERT INTO companies (name, sector, cin)
        VALUES (${item.company_name}, ${item.sector}, ${item.cin})
        RETURNING id;
      `;

      // 2. Insert IPO
      const [ipo] = await sql`
        INSERT INTO ipos (
          company_id, current_stage, issue_size, price_band, lot_size, min_investment,
          fresh_issue_amount, ofs_amount, issue_open_date, issue_close_date,
          allotment_date, listing_date
        ) VALUES (
          ${comp.id}, ${item.stage}, ${item.issue_size}, ${item.price_band}, ${item.lot_size},
          ${item.min_investment}, ${item.fresh_issue}, ${item.ofs}, ${item.open_date}, ${item.close_date},
          ${item.allotment_date}, ${item.listing_date}
        ) RETURNING id;
      `;

      // 3. Insert Promoters
      for (const p of item.promoters) {
        await sql`
          INSERT INTO promoters (ipo_id, name)
          VALUES (${ipo.id}, ${p});
        `;
      }

      // 4. Insert Anchor Investors
      for (const a of item.anchor_investors) {
        await sql`
          INSERT INTO anchor_investors (ipo_id, investor_name, shares_allocated, amount)
          VALUES (${ipo.id}, ${a.name}, ${a.shares}, ${a.amount});
        `;
      }

      // 5. Insert QIB Allocations
      for (const q of item.qib_allocations) {
        await sql`
          INSERT INTO qib_allocations (ipo_id, category_detail, demand_multiple)
          VALUES (${ipo.id}, ${q.category}, ${q.multiple});
        `;
      }

      // 6. Insert Score Snapshot if listing score exists
      if (item.rhp_score > 0) {
        await sql`
          INSERT INTO score_snapshots (ipo_id, stage_at_time, rhp_score)
          VALUES (${ipo.id}, ${item.stage}, ${item.rhp_score});
        `;
      }

      // 7. Insert Subscription Data
      if (item.stage >= 2) {
        await sql`
          INSERT INTO subscription_data (ipo_id, category, times_subscribed)
          VALUES 
            (${ipo.id}, 'QIB', 12.4),
            (${ipo.id}, 'HNI', 8.5),
            (${ipo.id}, 'Retail', 3.1);
        `;
      }

      console.log(`  ✓ Seeded: ${item.company_name}`);
    }

    // 8. Seed sample OpenRouter keys in llm_key_state
    // Index 0, 1, 2 represent our rotation keys
    console.log('Seeding LLM Key States...');
    await sql`
      INSERT INTO llm_key_state (provider, key_index, is_active)
      VALUES 
        ('openrouter', 0, TRUE),
        ('openrouter', 1, TRUE),
        ('openrouter', 2, TRUE);
    `;
    console.log('  ✓ Seeded: llm_key_state (3 index slots)');

    console.log('\n🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('\n❌ SEEDING ERROR:', err.message);
  } finally {
    await sql.end();
  }
}

seed();
