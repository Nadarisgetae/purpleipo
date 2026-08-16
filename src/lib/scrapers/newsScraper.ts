import Parser from 'rss-parser';

const parser = new Parser();

export interface ScrapedArticle {
  headline: string;
  url: string;
  source: string;
  published_at: Date;
  heuristicRelevance: number;
}

export async function fetchAndRankNews(companyName: string): Promise<ScrapedArticle[]> {
  const query = `${companyName} IPO`;
  // Using Google News RSS as the primary broad source for this implementation
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  
  const articles: ScrapedArticle[] = [];
  
  try {
    const feed = await parser.parseURL(url);
    
    feed.items.forEach(item => {
      if (item.title && item.link) {
        articles.push({
          headline: item.title,
          url: item.link,
          source: item.source || 'Google News',
          published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
          heuristicRelevance: 0
        });
      }
    });
  } catch (error) {
    console.error('Error fetching RSS:', error);
  }
  
  // Deduplicate by headline
  const uniqueArticles = new Map<string, ScrapedArticle>();
  articles.forEach(a => {
    // Basic deduplication
    const key = a.headline.toLowerCase().trim();
    if (!uniqueArticles.has(key)) {
      uniqueArticles.set(key, a);
    }
  });
  
  const deduped = Array.from(uniqueArticles.values());
  
  // Calculate heuristic relevance
  const companyTerms = companyName.toLowerCase().split(' ').filter(t => t.length > 2);
  
  deduped.forEach(a => {
    let score = 0;
    const headlineLower = a.headline.toLowerCase();
    
    // Check if company name is in headline
    if (headlineLower.includes(companyName.toLowerCase())) {
      score += 0.8;
    } else {
      let matches = 0;
      companyTerms.forEach(t => {
        if (headlineLower.includes(t)) matches++;
      });
      if (matches > 0) {
        score += 0.4 * (matches / companyTerms.length);
      }
    }
    
    // Check if IPO is in headline
    if (headlineLower.includes('ipo')) {
      score += 0.2;
    }
    
    // Time decay (newer is better)
    const ageMs = Date.now() - a.published_at.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 2) score += 0.3; // Last 48 hrs
    else if (ageDays < 7) score += 0.1; // Last week
    
    a.heuristicRelevance = score;
  });
  
  // Sort by relevance desc, then date desc
  deduped.sort((a, b) => {
    if (b.heuristicRelevance !== a.heuristicRelevance) {
      return b.heuristicRelevance - a.heuristicRelevance;
    }
    return b.published_at.getTime() - a.published_at.getTime();
  });
  
  // Return top 30 most relevant
  return deduped.slice(0, 30);
}
