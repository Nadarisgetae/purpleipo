import * as cheerio from 'cheerio';
import sql from '../db';

// ─────────────────────────────────────────────────────────
// PurpleIPO Scraper — fetch-only edition (Vercel-compatible)
//
// Data strategy:
//  1. ipowatch.in  → list of current IPOs (SSR, no JS needed)
//  2. chittorgarh.com/ipo/<slug>/ → detail page (SSR, no JS needed)
//
// Why not chittorgarh list page? It's a Next.js CSR page —
// tables are rendered by JS, invisible to plain fetch().
// ─────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchHtml(url: string, timeoutMs = 20000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Parse date strings to UTC midnight Date — avoids IST timezone shifts
function parseDateIST(dStr: string): Date | null {
  if (!dStr || dStr === '-' || dStr.toLowerCase().includes('tba') || dStr.trim() === '') return null;

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // "01-Sep-2026" (Chittorgarh detail format)
  let m = dStr.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  if (m) {
    const mo = months[m[2].toLowerCase().substring(0, 3)];
    if (mo) return new Date(`${m[3]}-${mo}-${m[1].padStart(2, '0')}T00:00:00.000Z`);
  }

  // "Sep 1, 2026" or "September 1, 2026"
  m = dStr.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = months[m[1].toLowerCase().substring(0, 3)];
    if (mo) return new Date(`${m[3]}-${mo}-${m[2].padStart(2, '0')}T00:00:00.000Z`);
  }

  // "1 Sep 2026"
  m = dStr.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const mo = months[m[2].toLowerCase().substring(0, 3)];
    if (mo) return new Date(`${m[3]}-${mo}-${m[1].padStart(2, '0')}T00:00:00.000Z`);
  }

  // "2026-08-29"
  m = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);

  // Fallback: native parse clamped to UTC midnight
  const parsed = new Date(dStr);
  if (!isNaN(parsed.getTime())) {
    return new Date(
      `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}T00:00:00.000Z`
    );
  }
  return null;
}

// Parse ipowatch "Date" column like "1-3 September" or "28-1 September" → open/close dates
function parseIpowatchDateRange(dateStr: string, year: number): { openDate: Date | null; closeDate: Date | null } {
  // e.g. "1-3 September" → Sep 1 to Sep 3
  // e.g. "31-2 September" → Aug 31 to Sep 2 (month boundary)
  const m = dateStr.match(/^(\d{1,2})-(\d{1,2})\s+([A-Za-z]+)$/);
  if (!m) return { openDate: null, closeDate: null };

  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const startDay = parseInt(m[1]);
  const endDay = parseInt(m[2]);
  const monthName = m[3].toLowerCase();
  const monthNum = months[monthName];

  if (!monthNum) return { openDate: null, closeDate: null };

  const closeDate = new Date(`${year}-${monthNum}-${String(endDay).padStart(2, '0')}T00:00:00.000Z`);

  // If start day > end day, open date is in the previous month
  let openYear = year;
  let openMonth = parseInt(monthNum);
  if (startDay > endDay) {
    openMonth -= 1;
    if (openMonth === 0) { openMonth = 12; openYear -= 1; }
  }
  const openDate = new Date(`${openYear}-${String(openMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}T00:00:00.000Z`);

  return { openDate, closeDate };
}

// Convert ipowatch status to our stage number
function statusToStage(status: string, openDate: Date | null, closeDate: Date | null, listingDate: Date | null): number {
  const s = status.toLowerCase().trim();
  const today = new Date();
  const todayUTC = new Date(`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}T00:00:00.000Z`);

  if (listingDate && todayUTC >= listingDate) return 4;
  if (s.includes('listed')) return 4;
  if (s.includes('allot') || s.includes('closed')) return 3;
  if (s.includes('open') || s === 'open') return 2;
  // Upcoming / Announced
  return 1;
}

// Determine if an IPO is mainboard or SME based on issue size and table source
function inferBoardType(priceBand: string, tableIndex: number): 'MAINBOARD' | 'SME' {
  // Table 0 from ipowatch = mainboard, Table 1 = SME
  return tableIndex === 0 ? 'MAINBOARD' : 'SME';
}

// Build chittorgarh detail URL from company name (slug)
function buildChittorgarhSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/\s+ipo\s*$/i, '')
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── MAIN SCRAPER ────────────────────────────────────────
export async function scrapeChittorgarhIPOs() {
  console.log('🚀 Starting PurpleIPO Scraper (fetch-only, Vercel-compatible)...');

  const year = new Date().getUTCFullYear();

  // ── STEP 1: Get current IPO list from ipowatch.in ──────
  console.log('\n📡 Fetching IPO list from ipowatch.in...');
  const listHtml = await fetchHtml('https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/', 30000);
  const $list = cheerio.load(listHtml);

  interface IpoEntry {
    companyName: string;
    priceBand: string | null;
    dateStr: string;
    status: string;
    iwLink: string | null;
    boardType: 'MAINBOARD' | 'SME';
  }

  const entries: IpoEntry[] = [];

  // ipowatch.in has 2 tables: Table 0 = mainboard, Table 1 = SME
  $list('table').each((tableIdx, tableEl) => {
    if (tableIdx > 1) return false; // only first two tables
    const rows = $list(tableEl).find('tbody tr, tr').toArray();

    for (const trEl of rows) {
      const tds = $list(trEl).find('td');
      if (tds.length < 6) continue;

      const nameRaw = tds.eq(0).text().trim().replace(/\s+/g, ' ');
      // Skip header rows
      if (!nameRaw || nameRaw.toLowerCase() === 'ipo name') continue;

      const priceBandRaw = tds.eq(3).text().trim();
      const dateStr = tds.eq(5).text().trim();
      const status = tds.eq(6).text().trim();
      const iwLink = tds.eq(0).find('a').attr('href') || null;

      const companyName = nameRaw
        .replace(/\bIPO\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      const priceBand = priceBandRaw === '₹-' || priceBandRaw === '-' || !priceBandRaw ? null : priceBandRaw.replace('₹', '').trim();

      entries.push({
        companyName,
        priceBand,
        dateStr,
        status,
        iwLink,
        boardType: inferBoardType(priceBandRaw, tableIdx),
      });
    }
  });

  console.log(`Found ${entries.length} IPOs from ipowatch.in`);

  // ── STEP 2: Process each IPO ───────────────────────────
  const todayUTC = (() => {
    const t = new Date();
    return new Date(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}T00:00:00.000Z`);
  })();

  for (const entry of entries) {
    console.log(`\n🔍 [${entry.boardType}] Processing: ${entry.companyName}`);

    const { openDate, closeDate } = parseIpowatchDateRange(entry.dateStr, year);

    // We'll get listingDate from detail page scrape below
    let listingDate: Date | null = null;
    let issueSize: string | null = null;
    let lotSize: string | null = null;
    let minInvestment: number | null = null;
    let description: string | null = null;
    let objectsText: string | null = null;
    let promotersText = '';
    let rhpUrl: string | null = null;
    let financialsData: any[] = [];
    let kpiData: any[] = [];

    // Try fetching Chittorgarh detail page via slug
    const slug = buildChittorgarhSlug(entry.companyName);
    // Try common slug patterns
    const slugsToTry = [
      `https://www.chittorgarh.com/ipo/${slug}-ipo/`,
      `https://www.chittorgarh.com/ipo/${slug.replace(/-limited$/, '')}-ipo/`,
      `https://www.chittorgarh.com/ipo/${slug.replace(/-ltd$/, '')}-ipo/`,
    ];

    // Also try using ipowatch detail link to extract chittorgarh link
    let detailHtml: string | null = null;
    let detailUrl: string | null = null;

    for (const tryUrl of slugsToTry) {
      try {
        const html = await fetchHtml(tryUrl, 15000);
        // Verify it's a valid IPO page (not 404 redirect)
        if (html.includes('Lot Size') || html.includes('Price Band') || html.includes('Issue Size')) {
          detailHtml = html;
          detailUrl = tryUrl;
          console.log(`  ✓ Detail page found: ${tryUrl}`);
          break;
        }
      } catch {
        // try next slug
      }
    }

    // If slug-guessing failed, try ipowatch detail page for a chittorgarh link
    if (!detailHtml && entry.iwLink) {
      try {
        const iwDetail = await fetchHtml(entry.iwLink, 15000);
        // Look for a chittorgarh link in the ipowatch page
        const $iw = cheerio.load(iwDetail);
        $iw('a[href*="chittorgarh.com/ipo/"]').each((_, el) => {
          if (!detailUrl) detailUrl = $iw(el).attr('href') || null;
        });
        if (detailUrl) {
          try {
            detailHtml = await fetchHtml(detailUrl, 15000);
            console.log(`  ✓ Detail page via ipowatch link: ${detailUrl}`);
          } catch { detailUrl = null; }
        }
      } catch { /* ignore */ }
    }

    // ── Parse the Chittorgarh detail page ─────────────────
    if (detailHtml) {
      const $d = cheerio.load(detailHtml);
      const bodyText = $d('body').text().replace(/\s{3,}/g, '\n').trim();

      // Listing date — look for "IPO Listing Date" pattern in tables
      $d('table tr').each((_, trEl) => {
        if (listingDate) return false;
        const cells = $d(trEl).find('td');
        const label = cells.first().text().trim().toLowerCase();
        if (label.includes('listing') || label.includes('list date')) {
          const val = cells.eq(1).text().trim();
          if (val) listingDate = parseDateIST(val);
        }
      });
      // Also try regex in body text
      if (!listingDate) {
        const lm = bodyText.match(/(?:IPO\s+)?Listing\s+Date\s*[:\-]?\s*([A-Za-z0-9, -]+(?:2026|2025|2027))/i);
        if (lm) listingDate = parseDateIST(lm[1].trim());
      }

      // Issue size from tables
      $d('table tr').each((_, trEl) => {
        if (issueSize) return false;
        const cells = $d(trEl).find('td');
        const label = cells.first().text().trim().toLowerCase();
        if (label.includes('issue size') || label.includes('total issue')) {
          const val = cells.eq(1).text().trim().replace(/[^\d.,]/g, '');
          if (val) issueSize = val;
        }
      });

      // RHP link
      $d('a').each((_, el) => {
        if (rhpUrl) return false;
        const text = $d(el).text().trim().toLowerCase();
        const href = ($d(el).attr('href') || '').trim();
        const isPdfLike = href.endsWith('.pdf') || href.includes('bseindia.com') ||
          href.includes('nseindia.com') || href.includes('sebi.gov.in');
        const isProspectus = text === 'rhp' || text === 'drhp' ||
          text.includes('rhp') || text.includes('prospectus') ||
          text.includes('red herring') || text.includes('offer document');
        if (isProspectus && isPdfLike) rhpUrl = href;
      });

      // Promoters
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

      // Lot size & min investment
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
            const amt = cells.eq(3).text().trim().replace(/[^\d]/g, '');
            if (!lotSize && shares && parseInt(shares) > 0) lotSize = shares + ' Shares';
            if (amt && parseInt(amt) > 0) minInvestment = parseFloat(amt);
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

      // Description
      $d('h1, h2, h3, h4').each((_, el) => {
        if (description) return false;
        const heading = $d(el).text().trim().toLowerCase();
        if (heading.startsWith('about ') || heading === 'about' ||
            heading.includes('company overview') || heading.includes('business overview')) {
          let next = $d(el).next();
          while (next.length && !description) {
            const tag = (next[0] as any)?.tagName?.toLowerCase();
            if ((tag === 'p' || tag === 'div') && next.text().trim().length > 40) {
              description = next.text().trim().substring(0, 1500);
            }
            if (tag && ['h1','h2','h3','h4'].includes(tag)) break;
            next = next.next();
          }
        }
      });

      // Objects of Issue
      const OBJ_KEYWORDS = ['objects of the offer','objects of the issue','objects of issue','use of proceeds','utilization of proceeds'];
      $d('table').each((_, tableEl) => {
        if (objectsText) return false;
        const tableText = $d(tableEl).text().toLowerCase();
        if (!OBJ_KEYWORDS.some(kw => tableText.includes(kw))) return false;
        const items: string[] = [];
        $d(tableEl).find('tr').slice(1).each((_, trEl) => {
          const cells = $d(trEl).find('td');
          const desc = cells.eq(1).text().trim() || cells.eq(0).text().trim();
          const amt = cells.eq(2).text().trim() || cells.eq(1).text().trim();
          if (desc && desc.length > 3 && !/^(sr|no|#|\d+)$/i.test(desc)) {
            items.push(amt && /[\d.]+/.test(amt) ? `${desc} (₹${amt} Cr)` : desc);
          }
        });
        if (items.length > 0) objectsText = items.join('; ');
      });

      // Financials
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

      // KPIs
      const KPI_KW = ['ronw','roce','pat margin','ebitda margin','p/e','eps','nav','return on'];
      $d('table').each((_, tableEl) => {
        if (kpiData.length > 0) return false;
        const tableText = $d(tableEl).text().toLowerCase();
        const hits = KPI_KW.filter(kw => tableText.includes(kw)).length;
        if (!tableText.includes('kpi') && hits < 2) return;
        $d(tableEl).find('tr').each((_, trEl) => {
          const cells = $d(trEl).find('td');
          if (cells.length < 2) return;
          const kpiName = cells.first().text().trim();
          if (!kpiName || /^(kpi|metric|particulars)$/i.test(kpiName)) return;
          const kpiVal = cells.eq(1).text().trim();
          if (kpiName && kpiVal && kpiVal !== '-') kpiData.push({ kpi: kpiName, value: kpiVal });
        });
      });
    } else {
      console.log(`  ⚠️  No detail page found for ${entry.companyName}`);
    }

    // Determine stage
    const stage = statusToStage(entry.status, openDate, closeDate, listingDate);

    // Category tag
    let categoryTag: string;
    const priceNum = entry.priceBand ? parseFloat(entry.priceBand.replace(/[^\d.]/g, '')) : 0;
    if (entry.boardType === 'SME') {
      categoryTag = 'SME IPO';
    } else if (issueSize) {
      const size = parseFloat((issueSize as string).replace(/,/g, ''));
      categoryTag = size >= 1500 ? 'Mainboard - Large Cap' : size >= 500 ? 'Mainboard - Mid Cap' : 'Mainboard - Small Cap';
    } else {
      categoryTag = 'Mainboard - Small Cap';
    }

    // ── Upsert Company ──────────────────────────────────
    let companyId: string;
    const cleanName = entry.companyName.replace(/(Limited|Ltd\.|Ltd)\s*$/i, '').trim();
    const existingCompany = await sql`
      SELECT id FROM companies
      WHERE name ILIKE ${entry.companyName}
         OR name ILIKE ${'%' + cleanName + '%'}
      LIMIT 1
    `;
    if (existingCompany.length > 0) {
      companyId = existingCompany[0].id;
    } else {
      const [newComp] = await sql`
        INSERT INTO companies (name, sector, cin)
        VALUES (${entry.companyName}, ${entry.boardType === 'SME' ? 'SME Platform' : 'Mainboard Enterprise'}, NULL)
        RETURNING id
      `;
      companyId = newComp.id;
    }

    // ── Upsert IPO ──────────────────────────────────────
    let ipoId: string;
    const existingIpo = await sql`SELECT id FROM ipos WHERE company_id = ${companyId} LIMIT 1`;
    if (existingIpo.length > 0) {
      ipoId = existingIpo[0].id;
      await sql`
        UPDATE ipos SET
          current_stage       = ${stage},
          price_band          = COALESCE(${entry.priceBand}, price_band),
          issue_size          = COALESCE(${issueSize}, issue_size),
          board_type          = ${entry.boardType},
          category_tag        = ${categoryTag},
          detail_url          = COALESCE(${detailUrl}, detail_url),
          issue_open_date     = COALESCE(${openDate}, issue_open_date),
          issue_close_date    = COALESCE(${closeDate}, issue_close_date),
          listing_date        = COALESCE(${listingDate}, listing_date),
          lot_size            = COALESCE(${lotSize}, lot_size),
          min_investment      = COALESCE(${minInvestment}, min_investment),
          rhp_url             = COALESCE(${rhpUrl}, rhp_url),
          description         = COALESCE(${description}, description),
          objects_of_issue    = COALESCE(${objectsText}, objects_of_issue),
          financials          = ${financialsData.length > 0 ? sql.json(financialsData) : sql`financials`},
          kpis                = ${kpiData.length > 0 ? sql.json(kpiData) : sql`kpis`},
          updated_at          = CURRENT_TIMESTAMP
        WHERE id = ${ipoId}
      `;
    } else {
      const [newIpo] = await sql`
        INSERT INTO ipos (
          company_id, current_stage, price_band, issue_size, board_type, category_tag,
          detail_url, issue_open_date, issue_close_date, listing_date,
          lot_size, min_investment, rhp_url, description, objects_of_issue,
          financials, kpis
        ) VALUES (
          ${companyId}, ${stage}, ${entry.priceBand}, ${issueSize}, ${entry.boardType}, ${categoryTag},
          ${detailUrl}, ${openDate}, ${closeDate}, ${listingDate},
          ${lotSize}, ${minInvestment}, ${rhpUrl}, ${description}, ${objectsText},
          ${financialsData.length > 0 ? sql.json(financialsData) : null},
          ${kpiData.length > 0 ? sql.json(kpiData) : null}
        ) RETURNING id
      `;
      ipoId = newIpo.id;
    }

    // ── Promoters ───────────────────────────────────────
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

    // ── Subscription data (stage ≥ 2, detail page available) ──
    if (stage >= 2 && detailUrl) {
      const subUrl = detailUrl.replace('/ipo/', '/ipo_subscription/');
      try {
        const subHtml = await fetchHtml(subUrl, 12000);
        const $s = cheerio.load(subHtml);
        await sql`DELETE FROM subscription_data WHERE ipo_id = ${ipoId}`;
        await sql`DELETE FROM anchor_investors WHERE ipo_id = ${ipoId}`;

        // Collect subscription rows first (no async inside cheerio .each)
        const subEntries: { cat: string; mult: number }[] = [];
        $s('table').each((_, tableEl) => {
          const header = $s(tableEl).find('tr').first().text().toLowerCase();
          if (!header.includes('category') || (!header.includes('subscription') && !header.includes('subscribed'))) return;
          $s(tableEl).find('tr').slice(1).each((_, trEl) => {
            const cells = $s(trEl).find('td');
            if (cells.length < 2) return;
            const cat = cells.eq(0).text().trim().replace(/[^a-zA-Z\s>\/()]/g, '').trim();
            let multStr = cells.eq(1).text().trim().replace(/[^\d.]/g, '');
            if (!multStr || isNaN(parseFloat(multStr))) multStr = cells.eq(2).text().trim().replace(/[^\d.]/g, '');
            const mult = parseFloat(multStr);
            if (!isNaN(mult) && mult >= 0) subEntries.push({ cat, mult });
          });
        });
        for (const { cat, mult } of subEntries) {
          const cl = cat.toLowerCase();
          let dbCat: 'QIB' | 'HNI' | 'Retail' | 'Employee' | 'Total' | null = null;
          if (cl.includes('retail') || cl.includes('rii')) dbCat = 'Retail';
          else if (cl.includes('qib') || cl.includes('qualified institutional')) dbCat = 'QIB';
          else if (cl.includes('nii') || cl.includes('non institutional') || cl.includes('hni')) dbCat = 'HNI';
          else if (cl.includes('employee') || cl.includes('ees')) dbCat = 'Employee';
          else if (cl.includes('total') || cl.includes('overall')) dbCat = 'Total';
          if (dbCat) {
            await sql`INSERT INTO subscription_data (ipo_id, category, times_subscribed) VALUES (${ipoId}, ${dbCat}, ${mult}) ON CONFLICT DO NOTHING`;
          }
        }
      } catch (subErr: any) {
        console.log(`    Notice: Subscription fetch skipped: ${subErr.message}`);
      }
    }

    console.log(`  ✓ Saved: stage=${stage} lot=${lotSize} desc=${!!description} fin=${financialsData.length}`);
  }

  console.log('\n🎉 Finished scraping all IPOs.');
}
