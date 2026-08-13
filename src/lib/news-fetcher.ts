/**
 * src/lib/news-fetcher.ts
 * Fetches live IPO news from Google News RSS — no API key required.
 * Also includes keyword-based stage detection from headlines.
 */

export interface RSSArticle {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
}

/** Extract CDATA or plain text from an XML tag */
function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`));
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return (plainMatch?.[1] || '').trim();
}

/** Parse raw RSS XML into article objects */
function parseRSS(xml: string): RSSArticle[] {
  const items: RSSArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source = extractTag(block, 'source') || 'Google News';
    const description = extractTag(block, 'description').replace(/<[^>]+>/g, '').substring(0, 200);

    if (title) {
      items.push({
        title,
        link,
        source,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        snippet: description,
      });
    }
  }

  return items.slice(0, 8); // max 8 per company
}

/**
 * Fetch live news headlines for a company from Google News RSS.
 * Query: "{companyName} IPO India"
 */
export async function fetchCompanyNews(companyName: string): Promise<RSSArticle[]> {
  try {
    const query = encodeURIComponent(`"${companyName}" IPO`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PurpleIPO/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml);
  } catch {
    return [];
  }
}

/**
 * Fetch general Indian IPO market news.
 */
export async function fetchMarketIPONews(): Promise<RSSArticle[]> {
  try {
    const query = encodeURIComponent('India IPO 2025 SEBI NSE BSE listing');
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PurpleIPO/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml);
  } catch {
    return [];
  }
}

/**
 * Keyword-based stage detection from news headlines.
 * Returns the minimum stage this company should be at, or null if no signal.
 */
export function detectStageFromHeadlines(headlines: string[]): number | null {
  const text = headlines.join(' ').toLowerCase();

  // Stage 12: Post-listing tracking
  if (text.match(/post.listing|trading|share price|market cap after/)) return 12;
  // Stage 11: Early post-listing
  if (text.match(/listed at|debut|first day trading|listing pop/)) return 11;
  // Stage 10: Listing
  if (text.match(/\blisting\b|\blisted\b|listing date|list on (nse|bse)/)) return 10;
  // Stage 9: Allotment
  if (text.match(/allotment|basis of allotment|refund|share credited/)) return 9;
  // Stage 8: Bidding open
  if (text.match(/subscription|bidding|ipo opens|issue opens|day [123] subscription|times subscribed/)) return 8;
  // Stage 7: Anchor allotment
  if (text.match(/anchor investor|anchor allotment|anchor book/)) return 7;
  // Stage 6: RHP filed
  if (text.match(/\brhp\b|red herring prospectus|final prospectus/)) return 6;
  // Stage 5: SEBI approved / DRHP public
  if (text.match(/sebi approv|sebi nod|sebi clears|ipo approved|ipo set to open/)) return 5;
  // Stage 4: SEBI review complete
  if (text.match(/sebi observation|sebi letter|sebi comment/)) return 4;
  // Stage 3: SEBI review
  if (text.match(/sebi review|sebi scrutin|under review|sebi examination/)) return 3;
  // Stage 2: DRHP filed
  if (text.match(/drhp filed|drhp submitted|draft prospectus|draft red herring/)) return 2;

  return null;
}
