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

              // 1. Direct RHP / PDF link extraction
              let directRhpUrl: string | null = null;
              $detail('a').each((idx, el) => {
                const text = $detail(el).text().trim();
                const href = $detail(el).attr('href') || '';
                if (
                  (text === 'RHP' || text.toLowerCase().includes('rhp') || text.toLowerCase().includes('prospectus')) &&
                  (href.endsWith('.pdf') || href.includes('/download/') || href.includes('bseindia.com') || href.includes('sebi.gov.in'))
                ) {
                  directRhpUrl = href;
                  return false;
                }
              });

              // 2. Promoters extraction
              const promoterMatch = bodyText.match(/Company Promoters:\s*([^\n.]+)/i);
              const promotersText = promoterMatch ? promoterMatch[1].trim() : '';
              if (promotersText) {
                await sql`DELETE FROM promoters WHERE ipo_id = ${ipoId}`;
                const names = promotersText.split(/,|\band\b/i).map(n => n.trim()).filter(Boolean);
                for (const name of names) {
                  await sql`INSERT INTO promoters (ipo_id, name) VALUES (${ipoId}, ${name})`;
                }
              }

              // 3. Lot size and Min investment
              let lotSize = '';
              let minInvestment: number | null = null;
              $detail('table').each((idx, tableEl) => {
                const text = $detail(tableEl).text();
                if (text.includes('Lot Size') && text.includes('Face Value')) {
                  $detail(tableEl).find('tr').each((rIdx, trEl) => {
                    const rowText = $detail(trEl).text();
                    if (rowText.includes('Lot Size')) {
                      lotSize = $detail(trEl).find('td').text().trim();
                    }
                  });
                }
              });

              // Check Retail (Min) application table
              $detail('table').each((idx, tableEl) => {
                const firstRowText = $detail(tableEl).find('tr').first().text();
                if (firstRowText.includes('Application') && firstRowText.includes('Lots')) {
                  $detail(tableEl).find('tr').each((rIdx, trEl) => {
                    const cells = $detail(trEl).find('td');
                    if (cells.first().text().includes('Retail (Min)')) {
                      const shares = cells.eq(2).text().trim().replace(/,/g, '');
                      const amt = cells.eq(3).text().trim().replace(/[^\d]/g, '');
                      if (!lotSize && shares) lotSize = shares + ' Shares';
                      if (amt) minInvestment = parseFloat(amt);
                    }
                  });
                }
              });

              // 4. About Company / Description extraction
              let companyDescription = '';
              $detail('h2, h3').each((idx, el) => {
                const heading = $detail(el).text().trim();
                if (heading.toLowerCase().includes('about') && heading.toLowerCase().includes('ltd')) {
                  companyDescription = $detail(el).next('p, div').text().trim();
                }
              });

              // 5. Objects of the Issue extraction
              let objectsText = '';
              $detail('table').each((idx, tableEl) => {
                const text = $detail(tableEl).text();
                if (text.includes('Issue Objects') || text.includes('Objects of the Issue')) {
                  const items: string[] = [];
                  $detail(tableEl).find('tr').slice(1).each((rIdx, trEl) => {
                    const objDesc = $detail(trEl).find('td').eq(1).text().trim();
                    const objAmt = $detail(trEl).find('td').eq(2).text().trim();
                    if (objDesc) items.push(`${objDesc} (${objAmt ? `₹${objAmt} Cr` : ''})`.trim());
                  });
                  if (items.length > 0) objectsText = items.join('; ');
                }
              });

              // 6. Restated Financials extraction
              const financialsData: any[] = [];
              $detail('table').each((idx, tableEl) => {
                const firstRow = $detail(tableEl).find('tr').first().text();
                if (firstRow.includes('Period Ended') || firstRow.includes('Assets') || firstRow.includes('Revenue')) {
                  const headers: string[] = [];
                  $detail(tableEl).find('tr').first().find('th, td').each((hIdx, hEl) => {
                    headers.push($detail(hEl).text().trim());
                  });

                  $detail(tableEl).find('tr').slice(1).each((rIdx, trEl) => {
                    const rowMetric = $detail(trEl).find('td').first().text().trim();
                    const values: string[] = [];
                    $detail(trEl).find('td').slice(1).each((cIdx, cEl) => {
                      values.push($detail(cEl).text().trim());
                    });
                    if (rowMetric) {
                      financialsData.push({ metric: rowMetric, values });
                    }
                  });
                }
              });

              // 7. Key Performance Indicators (KPIs)
              const kpiData: any[] = [];
              $detail('table').each((idx, tableEl) => {
                const text = $detail(tableEl).text();
                if (text.includes('KPI') && (text.includes('RoNW') || text.includes('ROCE') || text.includes('PAT Margin'))) {
                  $detail(tableEl).find('tr').slice(1).each((rIdx, trEl) => {
                    const kpiName = $detail(trEl).find('td').first().text().trim();
                    const kpiVal = $detail(trEl).find('td').eq(1).text().trim();
                    if (kpiName && kpiVal) {
                      kpiData.push({ kpi: kpiName, value: kpiVal });
                    }
                  });
                }
              });

              // Update rich scraped overview into IPO record
              await sql`
                UPDATE ipos
                SET 
                  lot_size = COALESCE(${lotSize || null}, lot_size),
                  min_investment = COALESCE(${minInvestment || null}, min_investment),
                  rhp_url = COALESCE(${directRhpUrl || null}, rhp_url),
                  description = COALESCE(${companyDescription || null}, description),
                  objects_of_issue = COALESCE(${objectsText || null}, objects_of_issue),
                  financials = ${financialsData.length > 0 ? sql.json(financialsData) : null},
                  kpis = ${kpiData.length > 0 ? sql.json(kpiData) : null}
                WHERE id = ${ipoId}
              `;

              // 8. Live Subscription & Anchor Allocations
              if (stage >= 2) {
                const subUrl = fullDetailUrl.replace('/ipo/', '/ipo_subscription/');
                await page.goto(subUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                await page.waitForSelector('table', { timeout: 3000 }).catch(() => {});

                const subHtml = await page.content();
                const $sub = cheerio.load(subHtml);

                await sql`DELETE FROM subscription_data WHERE ipo_id = ${ipoId}`;
                await sql`DELETE FROM anchor_investors WHERE ipo_id = ${ipoId}`;

                let subRows: any[] = [];
                $sub('table').each((idx, tableEl) => {
                  const header = $sub(tableEl).find('tr').first().text();
                  if (header.includes('Category') && header.includes('Subscription')) {
                    $sub(tableEl).find('tr').slice(1).each((rIdx, trEl) => {
                      subRows.push($sub(trEl));
                    });
                  }
                });

                for (const rowEl of subRows) {
                  const cells = rowEl.find('td');
                  if (cells.length >= 2) {
                    const cat = cells.eq(0).text().trim().replace(/[^a-zA-Z\s>]/g, '');
                    const mult = parseFloat(cells.eq(1).text().trim().replace(/[^\d.]/g, ''));
                    
                    if (!isNaN(mult)) {
                      let dbCat: 'QIB' | 'HNI' | 'Retail' | 'Employee' | 'Total' | null = null;
                      if (cat.includes('Retail')) dbCat = 'Retail';
                      else if (cat.includes('QIB') || cat.includes('Qualified Institutional')) dbCat = 'QIB';
                      else if (cat.includes('NII') || cat.includes('Non Institutional')) dbCat = 'HNI';
                      else if (cat.includes('Employee')) dbCat = 'Employee';
                      else if (cat.includes('Total')) dbCat = 'Total';

                      if (dbCat) {
                        await sql`
                          INSERT INTO subscription_data (ipo_id, category, times_subscribed)
                          VALUES (${ipoId}, ${dbCat}, ${mult})
                        `;
                      }
                    }
                  }
                }

                // Parse Anchor Investor Table
                let anchorRowsList: any[] = [];
                $sub('table').each((idx, tableEl) => {
                  const header = $sub(tableEl).find('tr').first().text();
                  if (header.includes('Anchor') && header.includes('Shares Allotted')) {
                    $sub(tableEl).find('tr').slice(1).each((rIdx, trEl) => {
                      anchorRowsList.push($sub(trEl));
                    });
                  }
                });

                for (const rowEl of anchorRowsList) {
                  const cells = rowEl.find('td');
                  if (cells.length >= 5) {
                    const name = cells.eq(1).text().trim();
                    const shares = cells.eq(3).text().trim();
                    const amt = cells.eq(4).text().trim() + ' Cr';
                    if (name && name !== 'Total') {
                      await sql`
                        INSERT INTO anchor_investors (ipo_id, investor_name, shares_allocated, amount)
                        VALUES (${ipoId}, ${name}, ${shares}, ${amt})
                      `;
                    }
                  }
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
