/**
 * src/lib/news-fetcher.ts
 * Fetches live IPO news from Indian financial RSS feeds.
 * Uses Economic Times, Business Standard, Moneycontrol — no API key required.
 * Google News RSS is NOT used (blocked from Vercel/cloud server IPs).
 */

export interface RSSArticle {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
}

// Reliable RSS feeds that allow server-side fetching from Vercel/cloud IPs
const MARKET_RSS_FEEDS = [
  { url: 'https://economictimes.indiatimes.com/markets/ipos/fpos/rssfeeds/12985590.cms', source: 'Economic Times' },
  { url: 'https://economictimes.indiatimes.com/markets/stocks/news/rssfeeds/2143429.cms', source: 'Economic Times' },
  { url: 'https://www.business-standard.com/rss/markets-106.rss', source: 'Business Standard' },
  { url: 'https://www.moneycontrol.com/rss/latestnews.xml', source: 'Moneycontrol' },
  { url: 'https://www.livemint.com/rss/markets', source: 'Livemint' },
];

/** Extract CDATA or plain text from an XML tag */
function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`));
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return (plainMatch?.[1] || '').trim();
}

/** Clean HTML entities and tags from text */
function cleanText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/** Parse raw RSS XML into article objects */
function parseRSS(xml: string, defaultSource: string): RSSArticle[] {
  const items: RSSArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = cleanText(extractTag(block, 'title'));
    const link = extractTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate');
    const source = cleanText(extractTag(block, 'source')) || defaultSource;
    const description = cleanText(extractTag(block, 'description')).substring(0, 200);

    if (title && title.length > 10) {
      items.push({
        title,
        link,
        source,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        snippet: description,
      });
    }
  }

  return items.slice(0, 10);
}

/** Fetch a single RSS feed with timeout */
async function fetchFeed(url: string, source: string): Promise<RSSArticle[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml, source);
  } catch {
    return [];
  }
}

/**
 * Fetch general Indian IPO/market news from multiple sources in parallel.
 * Merges all results, filters for IPO relevance, deduplicates.
 */
export async function fetchMarketIPONews(): Promise<RSSArticle[]> {
  const results = await Promise.allSettled(
    MARKET_RSS_FEEDS.map(f => fetchFeed(f.url, f.source))
  );

  const allArticles: RSSArticle[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allArticles.push(...result.value);
    }
  }

  // Prefer IPO-relevant articles
  const ipoKeywords = /ipo|sebi|listing|drhp|rhp|subscription|allotment|nse|bse|public issue/i;
  const filtered = allArticles.filter(a => ipoKeywords.test(a.title));
  const articles = filtered.length >= 5 ? filtered : allArticles;

  // Deduplicate by title
  const seen = new Set<string>();
  return articles.filter(a => {
    if (seen.has(a.title)) return false;
    seen.add(a.title);
    return true;
  }).slice(0, 25);
}

/**
 * Fetch news for a specific company — searches the market feeds for mentions.
 */
export async function fetchCompanyNews(companyName: string): Promise<RSSArticle[]> {
  const allNews = await fetchMarketIPONews();
  const company = companyName.toLowerCase().split(' ').slice(0, 2).join(' ');
  const mentions = allNews.filter(a => a.title.toLowerCase().includes(company));
  return mentions;
}

/**
 * Keyword-based IPO stage detection from news headlines.
 * Returns the minimum stage this company should be at, or null if no signal found.
 */
export function detectStageFromHeadlines(headlines: string[]): number | null {
  const text = headlines.join(' ').toLowerCase();

  if (text.match(/post.listing|trading|share price|market cap after/)) return 12;
  if (text.match(/listed at|debut|first day trading|listing pop/)) return 11;
  if (text.match(/\blisting\b|\blisted\b|listing date|list on (nse|bse)/)) return 10;
  if (text.match(/allotment|basis of allotment|refund|share credited/)) return 9;
  if (text.match(/subscription|bidding|ipo opens|issue opens|day [123] subscription|times subscribed/)) return 8;
  if (text.match(/anchor investor|anchor allotment|anchor book/)) return 7;
  if (text.match(/\brhp\b|red herring prospectus|final prospectus/)) return 6;
  if (text.match(/sebi approv|sebi nod|sebi clears|ipo approved|ipo set to open/)) return 5;
  if (text.match(/sebi observation|sebi letter|sebi comment/)) return 4;
  if (text.match(/sebi review|sebi scrutin|under review/)) return 3;
  if (text.match(/drhp filed|drhp submitted|draft prospectus|draft red herring/)) return 2;

  return null;
}
