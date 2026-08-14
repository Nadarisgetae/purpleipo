/**
 * Targeted Promoter/Anchor/QIB Updater
 * Only scrapes IPOs that are still missing data.
 * Has retry logic and longer timeouts for ipowatch.in
 */
import { chromium } from 'playwright';
import postgres from 'postgres';
import { readFileSync } from 'fs';

function loadEnv() {
  try {
    const env = readFileSync('.env.local', 'utf8');
    for (const line of env.split('\n')) {
      const clean = line.replace(/\r/g, '').trim();
      if (!clean || clean.startsWith('#')) continue;
      const eqIdx = clean.indexOf('=');
      if (eqIdx === -1) continue;
      const key = clean.substring(0, eqIdx).trim();
      let val = clean.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (key.includes('\0') || val.includes('\0')) continue;
      process.env[key] = val;
    }
  } catch (e) {}
}
loadEnv();

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function scrapeWithRetry(page, href, companyName, maxRetries = 2) {
  const result = { promoters: null, anchor_investors: null, qib_details: null, listing_date: null };
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`   Retry ${attempt}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, 3000 * attempt));
      }
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const text = await page.locator('body').innerText();

      // ── PROMOTERS, ANCHOR, QIB (Gemini Extraction) ──
      const genAI = process.env.GEMINI_API_KEY ? new (require('@google/generative-ai').GoogleGenerativeAI)(process.env.GEMINI_API_KEY) : null;
      const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-3.6-flash' }) : null;
      if (model) {
        try {
          const prompt = `Extract the following details from this IPO webpage text. If a piece of data is completely missing, return null for that field. Return ONLY valid JSON:
{
  "promoters": "Comma separated list of promoter names",
  "anchor_investors": "List of anchor investors or anchor schedule",
  "qib_details": "Details about QIB quota or subscription"
}
Webpage text:
${text.substring(0, 15000)}`;
          const res = await model.generateContent(prompt);
          const responseText = res.response.text();
          const cleanJson = responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1);
          const parsed = JSON.parse(cleanJson);
          
          if (parsed.promoters) result.promoters = parsed.promoters;
          if (parsed.anchor_investors) result.anchor_investors = parsed.anchor_investors;
          if (parsed.qib_details) result.qib_details = parsed.qib_details;
        } catch (err) {
          console.error('Gemini extraction failed for', companyName);
        }
      }

      // Success — break retry loop
      break;

    } catch (e) {
      if (attempt === maxRetries) {
        console.error(`   ❌ Failed after ${maxRetries + 1} attempts: ${e.message.split('\n')[0]}`);
      }
    }
  }
  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // Load ONLY IPOs missing data
    console.log('📂 Loading IPOs missing promoter/QIB data...');
    const missingIPOs = await sql`
      SELECT c.id as company_id, c.name, i.id as ipo_id, i.promoters, i.anchor_investors, i.qib_details
      FROM companies c 
      JOIN ipos i ON i.company_id = c.id
      WHERE i.promoters IS NULL OR i.promoters = 'TEST PROMOTER'
      ORDER BY c.name
    `;
    console.log(`  Found ${missingIPOs.length} IPOs with missing promoter data\n`);

    if (missingIPOs.length === 0) {
      console.log('✅ All IPOs already have data!');
      await browser.close();
      await sql.end();
      return;
    }

    // Build href from company name for ipowatch.in
    // Pattern: https://ipowatch.in/<company-slug>/
    function buildHref(name) {
      const slug = name.toLowerCase()
        .replace(/[&]/g, 'and')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      return `https://ipowatch.in/${slug}-ipo/`;
    }

    // Also load the actual hrefs from the main GMP pages if possible
    console.log('📋 Fetching current IPO hrefs from ipowatch.in...');
    const hrefMap = new Map();
    
    for (const url of ['https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/', 'https://ipowatch.in/sme-ipo-gmp-live-rates/']) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const rows = await page.locator('figure.wp-block-table table tbody tr').all();
        for (let i = 1; i < rows.length; i++) {
          const tds = await rows[i].locator('td').allInnerTexts();
          if (tds.length >= 8) {
            const rawName = tds[0].replace(/ IPO.*/i, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            let href = null;
            try { href = await rows[i].locator('td:first-child a').getAttribute('href', { timeout: 1000 }); } catch(e) {}
            if (href) hrefMap.set(rawName, href);
          }
        }
        console.log(`  ${url}: got ${hrefMap.size} hrefs`);
      } catch (e) {
        console.error(`  Could not load ${url}: ${e.message.split('\n')[0]}`);
      }
    }

    let updated = 0, failed = 0;

    for (const ipo of missingIPOs) {
      console.log(`\n⚙️  ${ipo.name}`);
      
      // Find href: try from hrefMap first, fallback to constructed URL
      const normName = ipo.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      let href = hrefMap.get(normName);
      
      if (!href) {
        // Try partial match
        for (const [key, val] of hrefMap.entries()) {
          const prefix = normName.substring(0, Math.min(10, normName.length));
          if (key.startsWith(prefix) || normName.startsWith(key.substring(0, 10))) {
            href = val;
            break;
          }
        }
      }
      
      if (!href) {
        href = buildHref(ipo.name);
        console.log(`   (using constructed URL: ${href})`);
      } else {
        console.log(`   (href: ${href})`);
      }

      const details = await scrapeWithRetry(page, href, ipo.name);

      console.log(`   Promoters: ${details.promoters ? details.promoters.substring(0, 70) : 'not found'}`);
      console.log(`   Anchor:    ${details.anchor_investors ?? 'not found'}`);
      console.log(`   QIB:       ${details.qib_details ? details.qib_details.substring(0, 70) : 'not found'}`);

      try {
        const updateResult = await sql`
          UPDATE ipos SET
            promoters = ${details.promoters},
            anchor_investors = ${details.anchor_investors},
            qib_details = ${details.qib_details},
            listing_date = COALESCE(${details.listing_date}, listing_date),
            updated_at = NOW()
          WHERE id = ${ipo.ipo_id}
          RETURNING id, promoters
        `;
        console.log(`   ✅ DB saved (promoters=${updateResult[0]?.promoters ? 'YES' : 'NULL'})`);
        updated++;
      } catch (e) {
        console.error(`   ❌ DB error: ${e.message}`);
        failed++;
      }
    }

    console.log(`\n✅ Done! Updated: ${updated}, Failed: ${failed}`);

    // Final summary
    const summary = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(promoters) as has_promoters,
        COUNT(qib_details) as has_qib,
        COUNT(anchor_investors) as has_anchor
      FROM ipos
    `;
    const s = summary[0];
    console.log(`\n📊 DB Summary: ${s.total} total IPOs`);
    console.log(`   With promoters:  ${s.has_promoters}/${s.total}`);
    console.log(`   With QIB:        ${s.has_qib}/${s.total}`);
    console.log(`   With Anchor:     ${s.has_anchor}/${s.total}`);

  } finally {
    await browser.close();
    await sql.end();
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
