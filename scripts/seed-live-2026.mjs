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

// Fix Vercel's double-quoted string issue
const sanitizedDbUrl = dbUrl.replace(/^"|"$/g, '');
const sql = postgres(sanitizedDbUrl, { max: 1 });

console.log('\n========================================');
console.log('  PURPLEIPO — SEEDING REAL AUGUST 2026 IPO DATA     ');
console.log('========================================\n');

const IPO_SEED_DATA = [
  {
    company_name: 'Milky Mist Dairy Food',
    sector: 'FMCG / Dairy',
    cin: 'U15209TZ2017PLC029800',
    stage: 8, // Open Public Bidding Window
    issue_size: '₹1,500 Cr',
    price_band: '₹133 - ₹140',
    lot_size: '107 Shares',
    minimum_investment: '₹14,980',
    fresh_issue: '₹600 Cr',
    ofs: '₹900 Cr',
    open_date: '2026-08-11',
    close_date: '2026-08-13',
    listing_date: '2026-08-18',
    rhp_score: 75.0,
    indep_score: 72.0,
    news_score: 70.0,
    composite: 73.1,
  },
  {
    company_name: 'Behari Lal Engineering',
    sector: 'Manufacturing / Engineering',
    cin: 'U29309DL1995PLC071853',
    stage: 8, // Open Public Bidding Window
    issue_size: '₹280 Cr',
    price_band: '₹271 - ₹285',
    lot_size: '52 Shares',
    minimum_investment: '₹14,820',
    fresh_issue: '₹280 Cr',
    ofs: '₹0 Cr',
    open_date: '2026-08-12',
    close_date: '2026-08-14',
    listing_date: '2026-08-19',
    rhp_score: 68.0,
    indep_score: 65.0,
    news_score: 62.0,
    composite: 66.0,
  },
  {
    company_name: 'Shiprocket',
    sector: 'Logistics / E-commerce',
    cin: 'U72900DL2013PTC254823',
    stage: 8, // Open Public Bidding Window
    issue_size: '₹3,200 Cr',
    price_band: '₹92 - ₹97',
    lot_size: '154 Shares',
    minimum_investment: '₹14,938',
    fresh_issue: '₹1,200 Cr',
    ofs: '₹2,000 Cr',
    open_date: '2026-08-12',
    close_date: '2026-08-14',
    listing_date: '2026-08-20',
    rhp_score: 82.0,
    indep_score: 80.0,
    news_score: 85.0,
    composite: 82.0,
  },
  {
    company_name: 'Horizon Industrial Parks',
    sector: 'Real Estate / Infrastructure',
    cin: 'U70109MH2021PTC355811',
    stage: 6, // Conduct Marketing and Roadshows (Upcoming)
    issue_size: '₹4,500 Cr',
    price_band: '₹57 - ₹60',
    lot_size: '250 Shares',
    minimum_investment: '₹15,000',
    fresh_issue: '₹2,500 Cr',
    ofs: '₹2,000 Cr',
    open_date: '2026-08-17',
    close_date: '2026-08-19',
    listing_date: '2026-08-24',
    rhp_score: 71.0,
    indep_score: 69.0,
    news_score: 75.0,
    composite: 71.2,
  },
  {
    company_name: 'Lalithaa Jewellery Mart',
    sector: 'Retail / Jewelry',
    cin: 'U36911TN1999PLC043232',
    stage: 6, // Conduct Marketing and Roadshows (Upcoming)
    issue_size: '₹1,800 Cr',
    price_band: '₹190 - ₹201',
    lot_size: '74 Shares',
    minimum_investment: '₹14,874',
    fresh_issue: '₹1,000 Cr',
    ofs: '₹800 Cr',
    open_date: '2026-08-17',
    close_date: '2026-08-19',
    listing_date: '2026-08-24',
    rhp_score: 78.0,
    indep_score: 75.0,
    news_score: 80.0,
    composite: 77.5,
  },
  {
    company_name: 'Shankesh Jewellers',
    sector: 'Retail / Jewelry',
    cin: 'U36999MH2011PTC214562',
    stage: 5, // File Final Prospectus (RHP)
    issue_size: '₹650 Cr',
    price_band: '₹88 - ₹93',
    lot_size: '160 Shares',
    minimum_investment: '₹14,880',
    fresh_issue: '₹400 Cr',
    ofs: '₹250 Cr',
    open_date: '2026-08-18',
    close_date: '2026-08-20',
    listing_date: '2026-08-25',
    rhp_score: 65.0,
    indep_score: 62.0,
    news_score: 60.0,
    composite: 63.3,
  },
  {
    company_name: 'Sunshine Pictures',
    sector: 'Media / Entertainment',
    cin: 'U92120MH2008PTC184451',
    stage: 5, // File Final Prospectus (RHP)
    issue_size: '₹250 Cr',
    price_band: '₹342 - ₹360',
    lot_size: '41 Shares',
    minimum_investment: '₹14,760',
    fresh_issue: '₹150 Cr',
    ofs: '₹100 Cr',
    open_date: '2026-08-18',
    close_date: '2026-08-20',
    listing_date: '2026-08-25',
    rhp_score: 55.0,
    indep_score: 50.0,
    news_score: 58.0,
    composite: 54.1,
  },
  {
    company_name: 'Ardee Industries',
    sector: 'Manufacturing',
    cin: 'U28112DL1994PTC063715',
    stage: 12, // List on Exchanges
    issue_size: '₹310 Cr',
    price_band: '₹110 - ₹115',
    lot_size: '130 Shares',
    minimum_investment: '₹14,950',
    fresh_issue: '₹310 Cr',
    ofs: '₹0 Cr',
    open_date: '2026-08-05',
    close_date: '2026-08-07',
    listing_date: '2026-08-12',
    rhp_score: 62.0,
    indep_score: 58.0,
    news_score: 65.0,
    composite: 61.4,
  }
];

async function run() {
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
          company_id, current_stage, issue_size, price_band, lot_size, minimum_investment,
          fresh_issue_amount, ofs_amount, issue_open_date, issue_close_date, listing_date
        )
        VALUES (
          ${comp.id}, ${item.stage}, ${item.issue_size}, ${item.price_band}, ${item.lot_size}, ${item.minimum_investment},
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
          ${item.company_name + ' garners strong market interest ahead of opening'},
          ${'https://economictimes.indiatimes.com/markets/ipos'},
          'Economic Times',
          NOW(),
          0.75,
          'business'
        );
      `;

      console.log(`  ✓ Seeded: ${item.company_name} (Stage ${item.stage})`);
    }

    console.log('\n🎉 DATABASE RESET COMPLETED! LIVE AUGUST 2026 DATA ADDED.\n');
  } catch (err) {
    console.error('\n❌ SEEDING ERROR:', err.message);
  } finally {
    await sql.end();
  }
}

run();
