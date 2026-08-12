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

console.log('\n========================================');
console.log('  PURPLEIPO — SEEDING REAL IPO DATA     ');
console.log('========================================\n');

const IPO_SEED_DATA = [
  {
    company_name: 'Swiggy Limited',
    sector: 'Consumer Tech / Quick Commerce',
    cin: 'U74110KA2014PLC077853',
    stage: 8, // Open Public Bidding Window
    issue_size: '₹11,327 Cr',
    price_band: '₹371 - ₹390',
    fresh_issue: '₹4,499 Cr',
    ofs: '₹6,828 Cr',
    open_date: '2026-11-06',
    close_date: '2026-11-08',
    listing_date: '2026-11-13',
    rhp_score: 72.5,
    indep_score: 68.0,
    news_score: 75.0,
    composite: 71.7,
  },
  {
    company_name: 'Hyundai Motor India Ltd',
    sector: 'Automotive',
    cin: 'U29309TN1996PLC035377',
    stage: 12, // List on Exchanges
    issue_size: '₹27,870 Cr',
    price_band: '₹1,865 - ₹1,960',
    fresh_issue: '₹0 Cr (100% OFS)',
    ofs: '₹27,870 Cr',
    open_date: '2026-10-15',
    close_date: '2026-10-17',
    listing_date: '2026-10-22',
    rhp_score: 84.0,
    indep_score: 79.5,
    news_score: 82.0,
    composite: 82.3,
  },
  {
    company_name: 'Bajaj Housing Finance Ltd',
    sector: 'BFSI / Housing Finance',
    cin: 'U65999PN2008PLC143449',
    stage: 12, // List on Exchanges
    issue_size: '₹6,560 Cr',
    price_band: '₹66 - ₹70',
    fresh_issue: '₹3,560 Cr',
    ofs: '₹3,000 Cr',
    open_date: '2026-09-09',
    close_date: '2026-09-11',
    listing_date: '2026-09-16',
    rhp_score: 91.0,
    indep_score: 89.0,
    news_score: 94.0,
    composite: 91.0,
  },
  {
    company_name: 'Waaree Energies Ltd',
    sector: 'Renewable Energy / Solar',
    cin: 'U29300MH1990PLC058299',
    stage: 12, // List on Exchanges
    issue_size: '₹4,321 Cr',
    price_band: '₹1,427 - ₹1,503',
    fresh_issue: '₹3,600 Cr',
    ofs: '₹721 Cr',
    open_date: '2026-10-21',
    close_date: '2026-10-23',
    listing_date: '2026-10-28',
    rhp_score: 88.5,
    indep_score: 86.0,
    news_score: 90.0,
    composite: 88.1,
  },
  {
    company_name: 'Brainbees Solutions Ltd (FirstCry)',
    sector: 'E-Commerce / Retail',
    cin: 'U51909PN2010PLC136371',
    stage: 11, // Credit Demat Accounts
    issue_size: '₹4,193 Cr',
    price_band: '₹440 - ₹465',
    fresh_issue: '₹1,666 Cr',
    ofs: '₹2,527 Cr',
    open_date: '2026-08-06',
    close_date: '2026-08-08',
    listing_date: '2026-08-13',
    rhp_score: 64.0,
    indep_score: 61.0,
    news_score: 69.0,
    composite: 64.1,
  },
  {
    company_name: 'NTPC Green Energy Ltd',
    sector: 'Renewables / Utilities',
    cin: 'U40106DL2022GOI396117',
    stage: 7, // Open Anchor Book
    issue_size: '₹10,000 Cr',
    price_band: '₹102 - ₹108',
    fresh_issue: '₹10,000 Cr',
    ofs: '₹0 Cr',
    open_date: '2026-11-19',
    close_date: '2026-11-22',
    listing_date: '2026-11-27',
    rhp_score: 79.0,
    indep_score: 76.0,
    news_score: 81.0,
    composite: 78.5,
  },
  {
    company_name: 'Ola Electric Mobility Ltd',
    sector: 'EV / Clean Mobility',
    cin: 'U74999KA2017PLC099619',
    stage: 10, // Execute Allotment and Refunds
    issue_size: '₹6,145 Cr',
    price_band: '₹72 - ₹76',
    fresh_issue: '₹5,500 Cr',
    ofs: '₹645 Cr',
    open_date: '2026-08-02',
    close_date: '2026-08-06',
    listing_date: '2026-08-09',
    rhp_score: 58.0,
    indep_score: 52.0,
    news_score: 62.0,
    composite: 57.0,
  },
  {
    company_name: 'Northern Arc Capital Ltd',
    sector: 'NBFC / Financial Services',
    cin: 'U65910TN1989PLC017011',
    stage: 5, // File Final Prospectus (RHP)
    issue_size: '₹777 Cr',
    price_band: '₹249 - ₹263',
    fresh_issue: '₹500 Cr',
    ofs: '₹277 Cr',
    open_date: '2026-09-16',
    close_date: '2026-09-19',
    listing_date: '2026-09-24',
    rhp_score: 74.0,
    indep_score: 71.0,
    news_score: 73.0,
    composite: 72.9,
  },
  {
    company_name: 'Hexaware Technologies',
    sector: 'IT Services / Tech',
    cin: 'U72200MH1992PLC069725',
    stage: 3, // Draft and File the DRHP
    issue_size: '₹9,950 Cr',
    price_band: 'TBD',
    fresh_issue: '₹0 Cr',
    ofs: '₹9,950 Cr',
    open_date: null,
    close_date: null,
    listing_date: null,
    rhp_score: 69.0,
    indep_score: 66.0,
    news_score: 70.0,
    composite: 68.3,
  },
  {
    company_name: 'Premier Energies Ltd',
    sector: 'Solar Manufacturing',
    cin: 'U40106TG1995PLC019909',
    stage: 9, // Price the Issue
    issue_size: '₹2,830 Cr',
    price_band: '₹427 - ₹450',
    fresh_issue: '₹1,291 Cr',
    ofs: '₹1,539 Cr',
    open_date: '2026-08-27',
    close_date: '2026-08-29',
    listing_date: '2026-09-03',
    rhp_score: 83.0,
    indep_score: 81.0,
    news_score: 85.0,
    composite: 82.8,
  },
  {
    company_name: 'Mobikwik Systems Ltd',
    sector: 'Fintech / Payments',
    cin: 'U74999DL2009PLC188812',
    stage: 2, // Conduct Due Diligence
    issue_size: '₹700 Cr',
    price_band: 'TBD',
    fresh_issue: '₹700 Cr',
    ofs: '₹0 Cr',
    open_date: null,
    close_date: null,
    listing_date: null,
    rhp_score: 45.0,
    indep_score: 42.0,
    news_score: 48.0,
    composite: 44.7,
  },
  {
    company_name: 'Afcons Infrastructure Ltd',
    sector: 'EPC / Infrastructure',
    cin: 'U45200MH1976PLC019335',
    stage: 1, // Appoint Merchant Bankers
    issue_size: '₹5,430 Cr',
    price_band: 'TBD',
    fresh_issue: '₹1,250 Cr',
    ofs: '₹4,180 Cr',
    open_date: null,
    close_date: null,
    listing_date: null,
    rhp_score: 55.0,
    indep_score: 50.0,
    news_score: 56.0,
    composite: 53.7,
  }
];

try {
  // Clear existing
  await sql`TRUNCATE companies CASCADE;`;

  for (const item of IPO_SEED_DATA) {
    const [comp] = await sql`
      INSERT INTO companies (name, sector, cin)
      VALUES (${item.company_name}, ${item.sector}, ${item.cin})
      RETURNING id;
    `;

    const [ipo] = await sql`
      INSERT INTO ipos (
        company_id, current_stage, issue_size, price_band,
        fresh_issue_amount, ofs_amount, issue_open_date, issue_close_date, listing_date
      )
      VALUES (
        ${comp.id}, ${item.stage}, ${item.issue_size}, ${item.price_band},
        ${item.fresh_issue}, ${item.ofs}, ${item.open_date}, ${item.close_date}, ${item.listing_date}
      )
      RETURNING id;
    `;

    // Seed Snapshot
    await sql`
      INSERT INTO score_snapshots (
        ipo_id, stage_at_time, rhp_score, independent_score, news_score, composite_score, weights_used
      ) VALUES (
        ${ipo.id}, ${item.stage}, ${item.rhp_score}, ${item.indep_score}, ${item.news_score}, ${item.composite},
        '{"w1": 0.5, "w2": 0.3, "w3": 0.2}'
      );
    `;

    // Seed sample news article
    await sql`
      INSERT INTO news_articles (ipo_id, company_id, headline, url, source, published_at, sentiment_score, topic_tag)
      VALUES (
        ${ipo.id}, ${comp.id},
        ${item.company_name + ' opens for subscription with strong institutional interest'},
        ${'https://economictimes.indiatimes.com/markets/ipos'},
        'Economic Times',
        NOW(),
        0.82,
        'business'
      );
    `;

    // Seed subscription data if active stage
    if (item.stage >= 8) {
      await sql`
        INSERT INTO subscription_data (ipo_id, category, times_subscribed) VALUES
        (${ipo.id}, 'QIB', 24.5),
        (${ipo.id}, 'HNI', 12.8),
        (${ipo.id}, 'Retail', 4.2);
      `;
    }

    console.log(`  ✓ Seeded: ${item.company_name} (Stage ${item.stage})`);
  }

  // Seed default app_settings
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES ('global_weights', '{"w1": 50, "w2": 30, "w3": 20}')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  `;
  console.log('  ✓ Seeded: app_settings');

  console.log('\n🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!\n');
} catch (err) {
  console.error('\n❌ SEEDING ERROR:', err.message);
} finally {
  await sql.end();
}
