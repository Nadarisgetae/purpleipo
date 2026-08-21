import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import sql from '../db';

interface ScrapeTarget {
  url: string;
  boardType: 'MAINBOARD' | 'SME';
  name: string;
}

export async function scrapeChittorgarhIPOs() {
  console.log('🚀 Starting Chittorgarh All-Cap IPO Scraper (Mainboard Large/Mid/Small & SME)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
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

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const target of targets) {
      console.log(`\n======================================================`);
      console.log(`📡 Fetching ${target.name} from ${target.url}...`);
      console.log(`======================================================`);

      try {
        await page.goto(target.url, {
          waitUntil: 'domcontentloaded',
          timeout: 40000
        });

        await page.waitForSelector('table', { timeout: 15000 }).catch(() => {});
        const html = await page.content();
        const $ = cheerio.load(html);

        const trs = $('table tbody tr');
        console.log(`Found ${trs.length} rows in ${target.name} list.`);

        // Process top 20 freshest IPOs per category
        const processCount = Math.min(20, trs.length);

        for (let i = 0; i < processCount; i++) {
          const row = trs.eq(i);
          const tds = row.find('td');
          if (tds.length < 7) continue;

          const companyCell = tds.eq(0);
          const rawName = companyCell.text().trim();
          const detailHref = companyCell.find('a').attr('href') || '';
          
          const openStr = tds.eq(2).text().trim(); // Opening Date
          const closeStr = tds.eq(3).text().trim(); // Closing Date
          const listingStr = tds.eq(4).text().trim(); // Listing Date
          const issuePrice = tds.length >= 6 ? tds.eq(5).text().trim() : ''; // Issue Price
          const totalAmount = tds.length >= 7 ? tds.eq(6).text().trim() : ''; // Total Issue size (Cr)
          const freshAmt = tds.length >= 8 ? tds.eq(7).text().trim() : ''; // Fresh issue
          const ofsAmt = tds.length >= 9 ? tds.eq(8).text().trim() : ''; // OFS

          if (!rawName) continue;

          // Clean company name
          const companyName = rawName.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
          const fullDetailUrl = detailHref ? (detailHref.startsWith('http') ? detailHref : `https://www.chittorgarh.com${detailHref}`) : null;

          console.log(`\n🔍 [${target.boardType}] Processing: ${companyName}`);

          // Parse Dates helper
          const parseDate = (dStr: string): Date | null => {
            if (!dStr || dStr === '-' || dStr.toLowerCase().includes('tba')) return null;
            const parsed = new Date(dStr);
            return isNaN(parsed.getTime()) ? null : parsed;
          };

          const openDate = parseDate(openStr);
          const closeDate = parseDate(closeStr);
          const listingDate = parseDate(listingStr);

          // Determine Stage (1 to 4)
          let stage = 1; // Bidding Not Open
          if (openDate && today >= openDate) {
            if (closeDate && today > closeDate) {
              if (listingDate && today >= listingDate) {
                stage = 4; // Listing Day Debut
              } else {
                stage = 3; // Allotment Status Finalized
              }
            } else {
              stage = 2; // IPO Bidding Window Open
            }
          }

          // Calculate Market Cap / Category Tag
          let categoryTag = 'Mainboard';
          let parsedSize = parseFloat(totalAmount.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0;

          if (target.boardType === 'SME') {
            categoryTag = 'SME IPO';
          } else {
            if (parsedSize >= 1500) {
              categoryTag = 'Mainboard - Large Cap';
            } else if (parsedSize >= 500) {
              categoryTag = 'Mainboard - Mid Cap';
            } else {
              categoryTag = 'Mainboard - Small Cap';
            }
          }

          // Find or create Company record
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
              RETURNING id;
            `;
            companyId = newComp.id;
          }

          // Find or upsert IPO record
          let ipoId: string;
          const existingIpo = await sql`
            SELECT id FROM ipos WHERE company_id = ${companyId} LIMIT 1
          `;

          if (existingIpo.length > 0) {
            ipoId = existingIpo[0].id;
            await sql`
              UPDATE ipos
              SET 
                current_stage = ${stage},
                issue_size = ${totalAmount || null},
                price_band = ${issuePrice || null},
                fresh_issue_amount = ${freshAmt || null},
                ofs_amount = ${ofsAmt || null},
                board_type = ${target.boardType},
                category_tag = ${categoryTag},
                detail_url = ${fullDetailUrl},
                issue_open_date = ${openDate},
                issue_close_date = ${closeDate},
                listing_date = ${listingDate},
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${ipoId}
            `;
          } else {
            const [newIpo] = await sql`
              INSERT INTO ipos (
                company_id, current_stage, issue_size, price_band, fresh_issue_amount, ofs_amount,
                board_type, category_tag, detail_url, issue_open_date, issue_close_date, listing_date
              ) VALUES (
                ${companyId}, ${stage}, ${totalAmount || null}, ${issuePrice || null}, ${freshAmt || null}, ${ofsAmt || null},
                ${target.boardType}, ${categoryTag}, ${fullDetailUrl}, ${openDate}, ${closeDate}, ${listingDate}
              ) RETURNING id;
            `;
            ipoId = newIpo.id;
          }
              // If detail link exists, scrape detailed stats, overview, financials, promoters, lot size, subscriptions
          if (fullDetailUrl) {
            try {
              await page.goto(fullDetailUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
              await page.waitForSelector('table', { timeout: 4000 }).catch(() => {});
              
              const detailHtml = await page.content();
              const $detail = cheerio.load(detailHtml);
              const bodyText = await page.locator('body').innerText();

              // ─────────────────────────────────────────────
              // 1. RHP / PDF link extraction (multiple patterns)
              // ─────────────────────────────────────────────
              let directRhpUrl: string | null = null;
              $detail('a').each((_, el) => {
                if (directRhpUrl) return false; // already found
                const text = $detail(el).text().trim().toLowerCase();
                const href = ($detail(el).attr('href') || '').trim();
                const isPdfLike = href.endsWith('.pdf') || href.includes('/download/') ||
                  href.includes('bseindia.com') || href.includes('nseindia.com') ||
                  href.includes('sebi.gov.in') || href.includes('ipo/rhp') || href.includes('ipo/drhp');
                const isProspectusLink = text === 'rhp' || text === 'drhp' ||
                  text.includes('rhp') || text.includes('prospectus') ||
                  text.includes('offer document') || text.includes('red herring');
                if (isProspectusLink && isPdfLike) directRhpUrl = href;
              });
              // Fallback: any direct .pdf link that contains the company name slug
              if (!directRhpUrl) {
                const nameSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
                $detail('a').each((_, el) => {
                  if (directRhpUrl) return false;
                  const href = ($detail(el).attr('href') || '').toLowerCase();
                  if (href.endsWith('.pdf') && href.includes(nameSlug.substring(0, 5))) directRhpUrl = href;
                });
              }

              // ─────────────────────────────────────────────
              // 2. Promoters extraction (3 strategies)
              // ─────────────────────────────────────────────
              let promotersText = '';

              // Strategy A: "Company Promoters: X, Y" on a single line
              const matchA = bodyText.match(/Company\s+Promoters\s*:\s*([^\n.]{3,})/i);
              if (matchA) promotersText = matchA[1].trim();

              // Strategy B: "Promoters:" label followed by names (used on some SME pages)
              if (!promotersText) {
                const matchB = bodyText.match(/^Promoters?\s*:\s*(.+)$/mi);
                if (matchB) promotersText = matchB[1].trim();
              }

              // Strategy C: look for a table row labelled "Promoter(s)" in overview tables
              if (!promotersText) {
                $detail('table tr').each((_, trEl) => {
                  if (promotersText) return false;
                  const cells = $detail(trEl).find('td');
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
                  await sql`INSERT INTO promoters (ipo_id, name) VALUES (${ipoId}, ${name})`;
                }
              }

              // ─────────────────────────────────────────────
              // 3. Lot size and Min investment (4 strategies)
              // ─────────────────────────────────────────────
              let lotSize = '';
              let minInvestment: number | null = null;

              // Strategy A: table with "Lot Size" and any of several paired headers
              $detail('table').each((_, tableEl) => {
                if (lotSize) return false;
                const text = $detail(tableEl).text();
                if (text.includes('Lot Size')) {
                  $detail(tableEl).find('tr').each((_, trEl) => {
                    if (lotSize) return false;
                    const label = $detail(trEl).find('td, th').first().text().trim().toLowerCase();
                    if (label.includes('lot size')) {
                      // pick the first non-empty td after the label
                      $detail(trEl).find('td').each((cIdx, cEl) => {
                        if (cIdx === 0) return; // skip label cell
                        const val = $detail(cEl).text().trim().replace(/[^\d]/g, '');
                        if (val && parseInt(val) > 0) {
                          lotSize = val + ' Shares';
                          return false;
                        }
                      });
                    }
                  });
                }
              });

              // Strategy B: Application table with "Retail (Min)" row
              $detail('table').each((_, tableEl) => {
                const headerText = $detail(tableEl).find('tr').first().text();
                if (headerText.toLowerCase().includes('application') || headerText.toLowerCase().includes('lot')) {
                  $detail(tableEl).find('tr').each((_, trEl) => {
                    const cells = $detail(trEl).find('td');
                    const rowLabel = cells.first().text().trim().toLowerCase();
                    if (rowLabel.includes('retail') && rowLabel.includes('min')) {
                      // shares in col 2, amount in col 3
                      const shares = cells.eq(2).text().trim().replace(/,/g, '').replace(/[^\d]/g, '');
                      const amt = cells.eq(3).text().trim().replace(/[^\d]/g, '');
                      if (!lotSize && shares && parseInt(shares) > 0) lotSize = shares + ' Shares';
                      if (amt && parseInt(amt) > 0) minInvestment = parseFloat(amt);
                    }
                    // Also try "Min Bid Quantity" / "Market Lot" on some SME pages
                    if (!lotSize && (rowLabel.includes('market lot') || rowLabel.includes('min bid') || rowLabel.includes('bid lot'))) {
                      const val = cells.eq(1).text().trim().replace(/[^\d]/g, '');
                      if (val && parseInt(val) > 0) lotSize = val + ' Shares';
                    }
                  });
                }
              });

              // Strategy C: body text regex fallback
              if (!lotSize) {
                const lotMatch = bodyText.match(/Lot\s+Size\s*[:\-]?\s*(\d[\d,]*)\s*(?:shares?)?/i);
                if (lotMatch) lotSize = lotMatch[1].replace(/,/g, '') + ' Shares';
              }

              // Strategy D: min investment from body text
              if (!minInvestment) {
                const minMatch = bodyText.match(/Min(?:imum)?\s+(?:Investment|Application)\s*[:\-]?\s*₹?\s*([\d,]+)/i);
                if (minMatch) minInvestment = parseFloat(minMatch[1].replace(/,/g, ''));
              }

              // ─────────────────────────────────────────────
              // 4. About Company / Description (3 strategies)
              // ─────────────────────────────────────────────
              let companyDescription = '';

              // Strategy A: any h1/h2/h3/h4 that says "About" (regardless of Ltd/Limited/Instruments etc.)
              $detail('h1, h2, h3, h4').each((_, el) => {
                if (companyDescription) return false;
                const heading = $detail(el).text().trim().toLowerCase();
                if (heading.startsWith('about ') || heading === 'about' || heading.includes('company overview') || heading.includes('business overview')) {
                  // Try the immediate next sibling paragraph or div
                  let next = $detail(el).next();
                  while (next.length && !companyDescription) {
                    const tag = next[0]?.tagName?.toLowerCase();
                    if (tag === 'p' || tag === 'div') {
                      const text = next.text().trim();
                      if (text.length > 40) companyDescription = text;
                    }
                    // Stop if we hit another heading
                    if (tag && ['h1','h2','h3','h4'].includes(tag)) break;
                    next = next.next();
                  }
                }
              });

              // Strategy B: section/div with class or id containing "about" or "overview"
              if (!companyDescription) {
                $detail('[class*="about"], [id*="about"], [class*="overview"], [id*="overview"]').each((_, el) => {
                  if (companyDescription) return false;
                  const text = $detail(el).text().trim();
                  if (text.length > 60 && text.length < 3000) companyDescription = text.substring(0, 1500);
                });
              }

              // Strategy C: body text regex — grab the paragraph after "About [CompanyName]"
              if (!companyDescription) {
                const shortName = companyName.split(' ')[0]; // e.g. "Tempsens"
                const regex = new RegExp(`About\\s+${shortName}[\\w\\s,\\.\\-&]*?\\n([\\s\\S]{60,500}?)(?:\\n\\n|\\n[A-Z])`, 'i');
                const bodyMatch = bodyText.match(regex);
                if (bodyMatch) companyDescription = bodyMatch[1].trim();
              }

              // ─────────────────────────────────────────────
              // 5. Objects of the Issue (6 heading variants)
              // ─────────────────────────────────────────────
              let objectsText = '';
              const objectKeywords = [
                'objects of the offer',
                'objects of the issue',
                'issue objects',
                'objects of issue',
                'utilization of proceeds',
                'use of proceeds',
              ];

              $detail('table').each((_, tableEl) => {
                if (objectsText) return false;
                const tableText = $detail(tableEl).text().toLowerCase();
                if (objectKeywords.some(kw => tableText.includes(kw))) {
                  const items: string[] = [];
                  $detail(tableEl).find('tr').slice(1).each((_, trEl) => {
                    const cells = $detail(trEl).find('td');
                    // Try col 1 (desc) + col 2 (amount) — both mainboard and SME layouts
                    const desc = cells.eq(1).text().trim() || cells.eq(0).text().trim();
                    const amt = cells.eq(2).text().trim() || cells.eq(1).text().trim();
                    if (desc && desc.length > 3 && !/^(sr|no|#|\d+)$/i.test(desc)) {
                      items.push(amt && /[\d.]+/.test(amt) ? `${desc} (₹${amt} Cr)` : desc);
                    }
                  });
                  if (items.length > 0) objectsText = items.join('; ');
                }
              });

              // Fallback: h-tag followed by a list or paragraph describing objects
              if (!objectsText) {
                $detail('h2, h3, h4').each((_, el) => {
                  if (objectsText) return false;
                  const heading = $detail(el).text().trim().toLowerCase();
                  if (objectKeywords.some(kw => heading.includes(kw.split(' ')[0]))) {
                    const next = $detail(el).next('p, ul, ol, div');
                    const text = next.text().trim();
                    if (text.length > 10) objectsText = text.substring(0, 800);
                  }
                });
              }

              // ─────────────────────────────────────────────
              // 6. Restated Financials — broad keyword matching
              // ─────────────────────────────────────────────
              const financialsData: any[] = [];
              const financialKeywords = ['period ended', 'revenue', 'income', 'assets', 'profit', 'pat', 'ebitda', 'equity'];

              $detail('table').each((_, tableEl) => {
                if (financialsData.length > 0) return false; // take first matching table only
                const firstRowText = $detail(tableEl).find('tr').first().text().toLowerCase();
                const hasFinancialHeader = financialKeywords.some(kw => firstRowText.includes(kw));
                if (!hasFinancialHeader) return;

                // Make sure table has at least 3 rows (header + 2 data)
                const rows = $detail(tableEl).find('tr');
                if (rows.length < 3) return;

                rows.slice(1).each((_, trEl) => {
                  const cells = $detail(trEl).find('td');
                  if (cells.length < 2) return;
                  const metric = cells.first().text().trim();
                  if (!metric || metric.length > 80) return; // skip garbage rows
                  const values: string[] = [];
                  cells.slice(1).each((_, cEl) => {
                    values.push($detail(cEl).text().trim());
                  });
                  if (values.some(v => v !== '' && v !== '-')) {
                    financialsData.push({ metric, values });
                  }
                });
              });

              // ─────────────────────────────────────────────
              // 7. KPIs — works for both Mainboard and SME pages
              // ─────────────────────────────────────────────
              const kpiData: any[] = [];
              const kpiKeywords = ['ronw', 'roce', 'pat margin', 'ebitda margin', 'p/e', 'eps', 'nav', 'debt', 'return on'];

              $detail('table').each((_, tableEl) => {
                if (kpiData.length > 0) return false;
                const tableText = $detail(tableEl).text().toLowerCase();
                // Must contain "kpi" OR at least 2 of the kpi metric names
                const kpiHits = kpiKeywords.filter(kw => tableText.includes(kw)).length;
                if (!tableText.includes('kpi') && kpiHits < 2) return;

                $detail(tableEl).find('tr').each((rIdx, trEl) => {
                  const cells = $detail(trEl).find('td');
                  if (cells.length < 2) return;
                  const kpiName = cells.first().text().trim();
                  // Skip header-like rows
                  if (!kpiName || /^(kpi|metric|indicator|particulars)$/i.test(kpiName)) return;
                  const kpiVal = cells.eq(1).text().trim();
                  if (kpiName && kpiVal && kpiVal !== '-') {
                    kpiData.push({ kpi: kpiName, value: kpiVal });
                  }
                });
              });

              // ─────────────────────────────────────────────
              // Persist all extracted fields to DB
              // ─────────────────────────────────────────────
              await sql`
                UPDATE ipos
                SET 
                  lot_size        = COALESCE(${lotSize || null}, lot_size),
                  min_investment  = COALESCE(${minInvestment}, min_investment),
                  rhp_url         = COALESCE(${directRhpUrl || null}, rhp_url),
                  description     = COALESCE(${companyDescription || null}, description),
                  objects_of_issue = COALESCE(${objectsText || null}, objects_of_issue),
                  financials      = ${financialsData.length > 0 ? sql.json(financialsData) : sql`financials`},
                  kpis            = ${kpiData.length > 0 ? sql.json(kpiData) : sql`kpis`}
                WHERE id = ${ipoId}
              `;
              console.log(`    ✓ Detail scraped — desc:${!!companyDescription} fin:${financialsData.length} kpi:${kpiData.length} lot:${lotSize} promoters:${promotersText ? 'yes' : 'no'}`);

              // ─────────────────────────────────────────────
              // 8. Live Subscription & Anchor Allocations
              // ─────────────────────────────────────────────
              if (stage >= 2) {
                const subUrl = fullDetailUrl.replace('/ipo/', '/ipo_subscription/');
                await page.goto(subUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                await page.waitForSelector('table', { timeout: 3000 }).catch(() => {});

                const subHtml = await page.content();
                const $sub = cheerio.load(subHtml);

                await sql`DELETE FROM subscription_data WHERE ipo_id = ${ipoId}`;
                await sql`DELETE FROM anchor_investors WHERE ipo_id = ${ipoId}`;

                // Subscription rows — match any table with "Category" + "Subscription" or "Times" headers
                let subRows: any[] = [];
                $sub('table').each((_, tableEl) => {
                  const header = $sub(tableEl).find('tr').first().text().toLowerCase();
                  if (header.includes('category') && (header.includes('subscription') || header.includes('time') || header.includes('subscribed'))) {
                    $sub(tableEl).find('tr').slice(1).each((_, trEl) => {
                      subRows.push($sub(trEl));
                    });
                  }
                });

                for (const rowEl of subRows) {
                  const cells = rowEl.find('td');
                  if (cells.length < 2) continue;
                  const cat = cells.eq(0).text().trim().replace(/[^a-zA-Z\s>\/()]/g, '').trim();
                  // Times subscribed can be in col 1 or col 2 depending on layout
                  let multStr = cells.eq(1).text().trim().replace(/[^\d.]/g, '');
                  if (!multStr || isNaN(parseFloat(multStr))) {
                    multStr = cells.eq(2).text().trim().replace(/[^\d.]/g, '');
                  }
                  const mult = parseFloat(multStr);
                  if (!isNaN(mult) && mult >= 0) {
                    const catLower = cat.toLowerCase();
                    let dbCat: 'QIB' | 'HNI' | 'Retail' | 'Employee' | 'Total' | null = null;
                    if (catLower.includes('retail') || catLower.includes('rii')) dbCat = 'Retail';
                    else if (catLower.includes('qib') || catLower.includes('qualified institutional')) dbCat = 'QIB';
                    else if (catLower.includes('nii') || catLower.includes('non institutional') || catLower.includes('hni') || catLower.includes('non-institutional')) dbCat = 'HNI';
                    else if (catLower.includes('employee') || catLower.includes('ees')) dbCat = 'Employee';
                    else if (catLower.includes('total') || catLower.includes('overall')) dbCat = 'Total';

                    if (dbCat) {
                      await sql`
                        INSERT INTO subscription_data (ipo_id, category, times_subscribed)
                        VALUES (${ipoId}, ${dbCat}, ${mult})
                        ON CONFLICT DO NOTHING
                      `;
                    }
                  }
                }

                // Anchor Investors table — match "Anchor" + any amount/allocation header
                let anchorRowsList: any[] = [];
                $sub('table').each((_, tableEl) => {
                  const header = $sub(tableEl).find('tr').first().text().toLowerCase();
                  if (header.includes('anchor') && (header.includes('allot') || header.includes('amount') || header.includes('share'))) {
                    $sub(tableEl).find('tr').slice(1).each((_, trEl) => {
                      anchorRowsList.push($sub(trEl));
                    });
                  }
                });

                for (const rowEl of anchorRowsList) {
                  const cells = rowEl.find('td');
                  if (cells.length < 3) continue;
                  // Name can be in col 0 or col 1 depending on whether there's an index column
                  const name = cells.length >= 5 ? cells.eq(1).text().trim() : cells.eq(0).text().trim();
                  if (!name || name.toLowerCase() === 'total' || name.toLowerCase() === 'name') continue;
                  const shares = cells.length >= 5 ? cells.eq(3).text().trim() : cells.eq(1).text().trim();
                  const amtRaw = cells.length >= 5 ? cells.eq(4).text().trim() : cells.eq(2).text().trim();
                  const amt = amtRaw ? amtRaw + ' Cr' : '';
                  await sql`
                    INSERT INTO anchor_investors (ipo_id, investor_name, shares_allocated, amount)
                    VALUES (${ipoId}, ${name}, ${shares}, ${amt})
                    ON CONFLICT DO NOTHING
                  `;
                }
              }
            } catch (err: any) {
              console.log(`    Notice: Detail fetch skipped for ${companyName}: ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        console.error(`❌ Error scraping ${target.name}:`, err.message);
      }
    }

    console.log('\n🎉 Finished scraping all active Mainboard and SME IPOs with full rich overview data.');
  } finally {
    await browser.close();
  }
}
