export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { fetchMarketIPONews } from '@/lib/news-fetcher';

export async function GET() {
  try {
    // Try DB first
    const articles = await sql`
      SELECT
        n.id,
        n.headline,
        n.url,
        n.source,
        n.published_at,
        n.sentiment_score,
        n.topic_tag,
        c.name as company_name
      FROM news_articles n
      LEFT JOIN companies c ON n.company_id = c.id
      ORDER BY n.published_at DESC
      LIMIT 30;
    `;

    // If DB is empty, fetch live from Google News as fallback
    if (articles.length === 0) {
      const liveArticles = await fetchMarketIPONews();
      return NextResponse.json({
        success: true,
        source: 'live_rss',
        count: liveArticles.length,
        data: liveArticles.map(a => ({
          id: null,
          headline: a.title,
          url: a.link,
          source: a.source,
          published_at: a.publishedAt,
          sentiment_score: null,
          topic_tag: 'Market',
          company_name: null,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      source: 'database',
      count: articles.length,
      data: articles,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch news' }, { status: 500 });
  }
}
