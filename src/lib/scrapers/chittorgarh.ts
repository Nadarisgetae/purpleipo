import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import sql from '../db';

// ─────────────────────────────────────────────────────────
// Chittorgarh IPO Scraper — Playwright edition
// Chittorgarh.com is a Next.js app that renders ALL table
// content client-side. A bare fetch() returns 0 rows.
// We use Playwright (headless Chromium) to execute JS first.
// ─────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Parse a date string into a Date object using UTC midnight (IST-safe)
// Handles formats returned by Chittorgarh: "01-Sep-2026", "Aug 29, 2026", "29 Aug 2026", "2026-08-29"
function parseDateIST(dStr: string): Date | null {
  if (!dStr || dStr === '-' || dStr.toLowerCase().includes('tba') || dStr.trim() === '') return null;

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // Format: "01-Sep-2026" (Chittorgarh table format)
  let m = dStr.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  if (m) {
    const mo = months[m[2].toLowerCase().substring(0, 3)];
    if (mo) return new Date(`${m[3]}-${mo}-${m[1].padStart(2, '0')}T00:00:00.000Z`);
  }

  // Format: "Aug 29, 2026" or "August 29, 2026"
  m = dStr.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = months[m[1].toLowerCase().substring(0, 3)];
    if (mo) return new Date(`${m[3]}-${mo}-${m[2].padStart(2, '0')}T00:00:00.000Z`);
  }

  // Format: "29 Aug 2026"
  m = dStr.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const mo = months[m[2].toLowerCase().substring(0, 3)];
    if (mo) return new Date(`${m[3]}-${mo}-${m[1].padStart(2, '0')}T00:00:00.000Z`);
  }

  // Format: "2026-08-29" (ISO date)
  m = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);

  // Fallback: try native parse but clamp to midnight UTC to avoid timezone shifts
  const parsed = new Date(dStr);
  if (!isNaN(parsed.getTime())) {
    return new Date(`${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}T00:00:00.000Z`);
  }

  return null;
}

interface ScrapeTarget {
  url: string;
  boardType: 'MAINBOARD' | 'SME';
  name: string;
}

export async function scrapeChittorgarhIPOs() {
  console.log('🚀 Starting Chittorgarh IPO Scraper (Playwright-based, JS-rendered)...');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ userAgent: UA });
  const page = await context.newPage();

  const targets: ScrapeTarget[] = [
    {
      url: 'https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/mainboard/',
      boardType: 'MAINBOARD',
      name: 'Mainboard IPOs'
    },
    {
      url: 'https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/sme/',
      boardType: 'SME',
      name: 'SME IPOs'
    }
  ];

  const today = new Date();
  // Use UTC midnight for today comparison (IST-safe)
  const todayUTC = new Date(`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}T00:00:00.000Z`);

  try {
    for (const target of targets) {
      console.log(`\n====================================================`);
      console.log(`📡 Fetching ${target.name} from ${target.url}...`);
      console.log(`====================================================`);

      try {
        // Navigate and wait for table to be hydrated
        await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        // Wait for the IPO table rows to appear (rendered by Next.js hydration)
        try {
          await page.waitForSelector('table tbody tr', { timeout: 20000 });
        } catch {
          console.log(`⚠️  Table rows not found within timeout for ${target.name}`);
        }

        const html = await page.content();
        const $ = cheerio.load(html);

        const trs = $('table tbody tr');
        console.log(`Found ${trs.length} rows in ${target.name} list.`);

        if (trs.length === 0) {
          console.log(`⚠️  No rows found after JS hydration for ${target.name}. Skipping.`);
          continue;
        }

        // Process top 30 freshest IPOs per category
        const processCount = Math.min(30, trs.length);

        for (let i = 0; i < processCount; i++) {
          const row = trs.eq(i);
          const tds = row.find('td');
          if (tds.length < 7) continue;

          const companyCell = tds.eq(0);
          const rawName = companyCell.text().trim();
          const detailHref = companyCell.find('a').attr('href') || '';

          const openStr    = tds.eq(2).text().trim();
          const closeStr   = tds.eq(3).text().trim();
          const listingStr = tds.eq(4).text().trim();
          const issuePrice = tds.length >= 6 ? tds.eq(5).text().trim() : '';
          const totalAmount = tds.length >= 7 ? tds.eq(6).text().trim() : '';
          const freshAmt   = tds.length >= 8 ? tds.eq(7).text().trim() : '';
          const ofsAmt     = tds.length >= 9 ? tds.eq(8).text().trim() : '';

          if (!rawName) continue;

          const companyName = rawName.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
          const fullDetailUrl = detailHref
            ? (detailHref.startsWith('http') ? detailHref : `https://www.chittorgarh.com${detailHref}`)
            : null;

          console.log(`\n🔍 [${target.boardType}] Processing: ${companyName}`);

          const openDate    = parseDateIST(openStr);
          const closeDate   = parseDateIST(closeStr);
          const listingDate = parseDateIST(listingStr);

          // Determine Stage (1-4)
          let stage = 1;
          if (openDate && todayUTC >= openDate) {
            if (closeDate && todayUTC > closeDate) {
              stage = listingDate && todayUTC >= listingDate ? 4 : 3;
            } else {
              stage = 2;
            }
          }

          // Category tag
          let categoryTag = 'Mainboard';
          const parsedSize = parseFloat(totalAmount.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0;
          if (target.boardType === 'SME') {
            categoryTag = 'SME IPO';
          } else if (parsedSize >= 1500) {
            categoryTag = 'Mainboard - Large Cap';
          } else if (parsedSize >= 500) {
            categoryTag = 'Mainboard - Mid Cap';
          } else {
            categoryTag = 'Mainboard - Small Cap';
          }

          // Find or create Company
          let companyId: string;
          const existingCompany = await sql`
            SELECT id FROM companies 
            WHERE name ILIKE ${companyName} 
               OR name ILIKE ${'%' + companyName.replace(/(Limited|Ltd\.|Ltd)/i, '').trim() + '%'}
            LIMIT 1
          `;
          if (existingCompany.length > 0) {
            companyId = existingCompany[0].id;
          } else {
            const [newComp] = await sql`
              INSERT INTO companies (name, sector, cin)
              VALUES (${companyName}, ${target.boardType === 'SME' ? 'SME Platform' : 'Mainboard Enterprise'}, NULL)
              RETURNING id
            `;
            companyId = newComp.id;
          }

          // Find or upsert IPO
          let ipoId: string;
          const existingIpo = await sql`SELECT id FROM ipos WHERE company_id = ${companyId} LIMIT 1`;
          if (existingIpo.length > 0) {
            ipoId = existingIpo[0].id;
            await sql`
              UPDATE ipos SET
                current_stage       = ${stage},
                issue_size          = ${totalAmount || null},
                price_band          = ${issuePrice || null},
                fresh_issue_amount  = ${freshAmt || null},
                ofs_amount          = ${ofsAmt || null},
                board_type          = ${target.boardType},
                category_tag        = ${categoryTag},
                detail_url          = ${fullDetailUrl},
                issue_open_date     = ${openDate},
                issue_close_date    = ${closeDate},
                listing_date        = ${listingDate},
                updated_at          = CURRENT_TIMESTAMP
              WHERE id = ${ipoId}
            `;
          } else {
            const [newIpo] = await sql`
              INSERT INTO ipos (
                company_id, current_stage, issue_size, price_band, fresh_issue_amount, ofs_amount,
                board_type, category_tag, detail_url, issue_open_date, issue_close_date, listing_date
              ) VALUES (
                ${companyId}, ${stage}, ${totalAmount || null}, ${issuePrice || null},
                ${freshAmt || null}, ${ofsAmt || null},
                ${target.boardType}, ${categoryTag}, ${fullDetailUrl},
                ${openDate}, ${closeDate}, ${listingDate}
              ) RETURNING id
            `;
            ipoId = newIpo.id;
          }

          // ────────────────────────────────────────────────────
          // Detail page scrape — use Playwright for JS rendering
          // ────────────────────────────────────────────────────
          if (fullDetailUrl) {
            try {
              await page.goto(fullDetailUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
              try { await page.waitForSelector('table', { timeout: 10000 }); } catch {}

              const detailHtml = await page.content();
              const $d = cheerio.load(detailHtml);
              const bodyText = $d('body').text().replace(/\s{3,}/g, '\n').trim();

              // ── 1. RHP / PDF link ───────────────────────────
              let directRhpUrl: string | null = null;
              $d('a').each((_, el) => {
                if (directRhpUrl) return false;
                const text = $d(el).text().trim().toLowerCase();
                const href = ($d(el).attr('href') || '').trim();
                const isPdfLike = href.endsWith('.pdf') || href.includes('/download/') ||
                  href.includes('bseindia.com') || href.includes('nseindia.com') ||
                  href.includes('sebi.gov.in') || href.includes('ipo/rhp') || href.includes('ipo/drhp');
                const isProspectus = text === 'rhp' || text === 'drhp' ||
                  text.includes('rhp') || text.includes('prospectus') ||
                  text.includes('offer document') || text.includes('red herring');
                if (isProspectus && isPdfLike) directRhpUrl = href;
              });
              if (!directRhpUrl) {
                const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 6);
                $d('a').each((_, el) => {
                  if (directRhpUrl) return false;
                  const href = ($d(el).attr('href') || '').toLowerCase();
                  if (href.endsWith('.pdf') && href.includes(slug)) directRhpUrl = href;
                });
              }

              // ── 2. Promoters ─────────────────────────────────
              let promotersText = '';
              const matchA = bodyText.match(/Company\s+Promoters?\s*:\s*([^\n.]{3,})/i);
              if (matchA) promotersText = matchA[1].trim();
              if (!promotersText) {
                const matchB = bodyText.match(/^Promoters?\s*:\s*(.+)$/mi);
                if (matchB) promotersText = matchB[1].trim();
              }
              if (!promotersText) {
                $d('table tr').each((_, trEl) => {
                  if (promotersText) return false;
                  const cells = $d(trEl).find('td');
                  if (cells.first().text().trim().toLowerCase().startsWith('promoter')) {
                    const val = cells.eq(1).text().trim();
                    if (val.length > 2) promotersText = val;
                  }
                });
              }
              if (promotersText) {
                await sql`DELETE FROM promoters WHERE ipo_id = ${ipoId}`;
                const names = promotersText
                  .split(/,|\band\b|\n/i)
                  .map(n => n.replace(/\(.*?\)/g, '').trim())
                  .filter(n => n.length > 1);
                for (const name of names) {
                  await sql`INSERT INTO promoters (ipo_id, name) VALUES (${ipoId}, ${name}) ON CONFLICT DO NOTHING`;
                }
              }

              // ── 3. Lot size & Min investment ──────────────────
              let lotSize = '';
              let minInvestment: number | null = null;

              $d('table').each((_, tableEl) => {
                if (lotSize) return false;
                if (!$d(tableEl).text().includes('Lot Size')) return;
                $d(tableEl).find('tr').each((_, trEl) => {
                  if (lotSize) return false;
                  const label = $d(trEl).find('td, th').first().text().trim().toLowerCase();
                  if (label.includes('lot size')) {
                    $d(trEl).find('td').each((cIdx, cEl) => {
                      if (cIdx === 0) return;
                      const val = $d(cEl).text().trim().replace(/[^\d]/g, '');
                      if (val && parseInt(val) > 0) { lotSize = val + ' Shares'; return false as any; }
                    });
                  }
                });
              });
              $d('table').each((_, tableEl) => {
                const headerText = $d(tableEl).find('tr').first().text().toLowerCase();
                if (!headerText.includes('application') && !headerText.includes('lot')) return;
                $d(tableEl).find('tr').each((_, trEl) => {
                  const cells = $d(trEl).find('td');
                  const rowLabel = cells.first().text().trim().toLowerCase();
                  if (rowLabel.includes('retail') && rowLabel.includes('min')) {
                    const shares = cells.eq(2).text().trim().replace(/,/g, '').replace(/[^\d]/g, '');
                    const amt    = cells.eq(3).text().trim().replace(/[^\d]/g, '');
                    if (!lotSize && shares && parseInt(shares) > 0) lotSize = shares + ' Shares';
                    if (amt && parseInt(amt) > 0) minInvestment = parseFloat(amt);
                  }
                  if (!lotSize && (rowLabel.includes('market lot') || rowLabel.includes('min bid') || rowLabel.includes('bid lot'))) {
                    const val = cells.eq(1).text().trim().replace(/[^\d]/g, '');
                    if (val && parseInt(val) > 0) lotSize = val + ' Shares';
                  }
                });
              });
              if (!lotSize) {
                const m = bodyText.match(/Lot\s+Size\s*[:\-]?\s*(\d[\d,]*)\s*(?:shares?)?/i);
                if (m) lotSize = m[1].replace(/,/g, '') + ' Shares';
              }
              if (!minInvestment) {
                const m = bodyText.match(/Min(?:imum)?\s+(?:Investment|Application)\s*[:\-]?\s*₹?\s*([\d,]+)/i);
                if (m) minInvestment = parseFloat(m[1].replace(/,/g, ''));
              }

              // ── 4. Description ───────────────────────────────
              let companyDescription = '';
              $d('h1, h2, h3, h4').each((_, el) => {
                if (companyDescription) return false;
                const heading = $d(el).text().trim().toLowerCase();
                if (heading.startsWith('about ') || heading === 'about' ||
                    heading.includes('company overview') || heading.includes('business overview')) {
                  let next = $d(el).next();
                  while (next.length && !companyDescription) {
                    const tag = (next[0] as any)?.tagName?.toLowerCase();
                    if ((tag === 'p' || tag === 'div') && next.text().trim().length > 40) {
                      companyDescription = next.text().trim();
                    }
                    if (tag && ['h1','h2','h3','h4'].includes(tag)) break;
                    next = next.next();
                  }
                }
              });
              if (!companyDescription) {
                $d('[class*="about"],[id*="about"],[class*="overview"],[id*="overview"]').each((_, el) => {
                  if (companyDescription) return false;
                  const text = $d(el).text().trim();
                  if (text.length > 60 && text.length < 3000) companyDescription = text.substring(0, 1500);
                });
              }

              // ── 5. Objects of Issue ──────────────────────────
              let objectsText = '';
              const OBJ_KEYWORDS = ['objects of the offer','objects of the issue','issue objects','objects of issue','utilization of proceeds','use of proceeds'];
              $d('table').each((_, tableEl) => {
                if (objectsText) return false;
                const tableText = $d(tableEl).text().toLowerCase();
                if (!OBJ_KEYWORDS.some(kw => tableText.includes(kw))) return false;
                const items: string[] = [];
                $d(tableEl).find('tr').slice(1).each((_, trEl) => {
                  const cells = $d(trEl).find('td');
                  const desc = cells.eq(1).text().trim() || cells.eq(0).text().trim();
                  const amt  = cells.eq(2).text().trim() || cells.eq(1).text().trim();
                  if (desc && desc.length > 3 && !/^(sr|no|#|\d+)$/i.test(desc)) {
                    items.push(amt && /[\d.]+/.test(amt) ? `${desc} (₹${amt} Cr)` : desc);
                  }
                });
                if (items.length > 0) objectsText = items.join('; ');
              });

              // ── 6. Financials ────────────────────────────────
              const financialsData: any[] = [];
              const FIN_KW = ['period ended','revenue','income','assets','profit','pat','ebitda','equity'];
              $d('table').each((_, tableEl) => {
                if (financialsData.length > 0) return false;
                const firstRow = $d(tableEl).find('tr').first().text().toLowerCase();
                if (!FIN_KW.some(kw => firstRow.includes(kw))) return;
                const rows = $d(tableEl).find('tr');
                if (rows.length < 3) return;
                rows.slice(1).each((_, trEl) => {
                  const cells = $d(trEl).find('td');
                  if (cells.length < 2) return;
                  const metric = cells.first().text().trim();
                  if (!metric || metric.length > 80) return;
                  const values: string[] = [];
                  cells.slice(1).each((_, cEl) => { values.push($d(cEl).text().trim()); });
                  if (values.some(v => v !== '' && v !== '-')) financialsData.push({ metric, values });
                });
              });

              // ── 7. KPIs ──────────────────────────────────────
              const kpiData: any[] = [];
              const KPI_KW = ['ronw','roce','pat margin','ebitda margin','p/e','eps','nav','debt','return on'];
              $d('table').each((_, tableEl) => {
                if (kpiData.length > 0) return false;
                const tableText = $d(tableEl).text().toLowerCase();
                const hits = KPI_KW.filter(kw => tableText.includes(kw)).length;
                if (!tableText.includes('kpi') && hits < 2) return;
                $d(tableEl).find('tr').each((_, trEl) => {
                  const cells = $d(trEl).find('td');
                  if (cells.length < 2) return;
                  const kpiName = cells.first().text().trim();
                  if (!kpiName || /^(kpi|metric|indicator|particulars)$/i.test(kpiName)) return;
                  const kpiVal = cells.eq(1).text().trim();
                  if (kpiName && kpiVal && kpiVal !== '-') kpiData.push({ kpi: kpiName, value: kpiVal });
                });
              });

              // ── Persist all fields ───────────────────────────
              await sql`
                UPDATE ipos SET
                  lot_size         = COALESCE(${lotSize || null}, lot_size),
                  min_investment   = COALESCE(${minInvestment}, min_investment),
                  rhp_url          = COALESCE(${directRhpUrl || null}, rhp_url),
                  description      = COALESCE(${companyDescription || null}, description),
                  objects_of_issue = COALESCE(${objectsText || null}, objects_of_issue),
                  financials       = ${financialsData.length > 0 ? sql.json(financialsData) : sql`financials`},
                  kpis             = ${kpiData.length > 0 ? sql.json(kpiData) : sql`kpis`}
                WHERE id = ${ipoId}
              `;
              console.log(`    ✓ Detail OK — desc:${!!companyDescription} fin:${financialsData.length} kpi:${kpiData.length} lot:${lotSize} prom:${promotersText ? 'yes' : 'no'}`);

              // ── 8. Live Subscription & Anchors (stage ≥ 2) ──
              if (stage >= 2) {
                const subUrl = fullDetailUrl.replace('/ipo/', '/ipo_subscription/');
                try {
                  await page.goto(subUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                  try { await page.waitForSelector('table', { timeout: 8000 }); } catch {}

                  const subHtml = await page.content();
                  const $s = cheerio.load(subHtml);

                  await sql`DELETE FROM subscription_data WHERE ipo_id = ${ipoId}`;
                  await sql`DELETE FROM anchor_investors WHERE ipo_id = ${ipoId}`;

                  // Subscription table
                  let subRows: any[] = [];
                  $s('table').each((_, tableEl) => {
                    const header = $s(tableEl).find('tr').first().text().toLowerCase();
                    if (header.includes('category') && (header.includes('subscription') || header.includes('time') || header.includes('subscribed'))) {
                      $s(tableEl).find('tr').slice(1).each((_, trEl) => { subRows.push($s(trEl)); });
                    }
                  });

                  for (const rowEl of subRows) {
                    const cells = rowEl.find('td');
                    if (cells.length < 2) continue;
                    const cat = cells.eq(0).text().trim().replace(/[^a-zA-Z\s>\/()]/g, '').trim();
                    let multStr = cells.eq(1).text().trim().replace(/[^\d.]/g, '');
                    if (!multStr || isNaN(parseFloat(multStr))) multStr = cells.eq(2).text().trim().replace(/[^\d.]/g, '');
                    const mult = parseFloat(multStr);
                    if (!isNaN(mult) && mult >= 0) {
                      const cl = cat.toLowerCase();
                      let dbCat: 'QIB' | 'HNI' | 'Retail' | 'Employee' | 'Total' | null = null;
                      if (cl.includes('retail') || cl.includes('rii')) dbCat = 'Retail';
                      else if (cl.includes('qib') || cl.includes('qualified institutional')) dbCat = 'QIB';
                      else if (cl.includes('nii') || cl.includes('non institutional') || cl.includes('hni') || cl.includes('non-institutional')) dbCat = 'HNI';
                      else if (cl.includes('employee') || cl.includes('ees')) dbCat = 'Employee';
                      else if (cl.includes('total') || cl.includes('overall')) dbCat = 'Total';
                      if (dbCat) {
                        await sql`INSERT INTO subscription_data (ipo_id, category, times_subscribed) VALUES (${ipoId}, ${dbCat}, ${mult}) ON CONFLICT DO NOTHING`;
                      }
                    }
                  }

                  // Anchor investors
                  const anchorRows: { name: string; shares: string; amt: string }[] = [];
                  $s('table').each((_, tableEl) => {
                    const header = $s(tableEl).find('tr').first().text().toLowerCase();
                    if (!header.includes('anchor') || (!header.includes('allot') && !header.includes('amount') && !header.includes('share'))) return;
                    $s(tableEl).find('tr').slice(1).each((_, trEl) => {
                      const cells = $s(trEl).find('td');
                      if (cells.length < 3) return;
                      const name = cells.length >= 5 ? cells.eq(1).text().trim() : cells.eq(0).text().trim();
                      if (!name || name.toLowerCase() === 'total' || name.toLowerCase() === 'name') return;
                      const shares = cells.length >= 5 ? cells.eq(3).text().trim() : cells.eq(1).text().trim();
                      const amtRaw = cells.length >= 5 ? cells.eq(4).text().trim() : cells.eq(2).text().trim();
                      anchorRows.push({ name, shares, amt: amtRaw ? amtRaw + ' Cr' : '' });
                    });
                  });
                  for (const ar of anchorRows) {
                    await sql`INSERT INTO anchor_investors (ipo_id, investor_name, shares_allocated, amount) VALUES (${ipoId}, ${ar.name}, ${ar.shares}, ${ar.amt}) ON CONFLICT DO NOTHING`;
                  }
                } catch (subErr: any) {
                  console.log(`    Notice: Subscription fetch skipped: ${subErr.message}`);
                }
              }
            } catch (detailErr: any) {
              console.log(`    Notice: Detail fetch skipped for ${companyName}: ${detailErr.message}`);
            }
          }
        }
      } catch (err: any) {
        console.error(`❌ Error scraping ${target.name}:`, err.message);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n🎉 Finished scraping all active Mainboard and SME IPOs.');
}
