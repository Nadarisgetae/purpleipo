import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { fetchCompanyNews, fetchMarketIPONews, detectStageFromHeadlines } from '@/lib/news-fetcher';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const startTime = Date.now();
    const results: {
      company: string;
      articles_saved: number;
      stage_updated: boolean;
      new_stage?: number;
      old_stage?: number;
    }[] = [];

    // 1. Fetch all active IPOs
    const ipos = await sql`
      SELECT i.id, i.current_stage, i.company_id, c.name as company_name, c.sector
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      ORDER BY i.current_stage ASC;
    `;

    // 2. For each IPO, fetch live news and detect stage changes
    for (const ipo of ipos) {
      try {
        const articles = await fetchCompanyNews(ipo.company_name);
        let savedCount = 0;
        let stageUpdated = false;
        let newStage: number | undefined;

        // Save new articles to DB (skip duplicates by headline)
        for (const article of articles) {
          try {
            const existing = await sql`
              SELECT id FROM news_articles
              WHERE headline = ${article.title} AND company_id = ${ipo.company_id}
              LIMIT 1;
            `;

            if (existing.length === 0) {
              await sql`
                INSERT INTO news_articles (ipo_id, company_id, headline, url, source, published_at, sentiment_score, topic_tag)
                VALUES (
                  ${ipo.id},
                  ${ipo.company_id},
                  ${article.title},
                  ${article.link},
                  ${article.source},
                  ${article.publishedAt},
                  NULL,
                  'IPO'
                );
              `;
              savedCount++;
            }
          } catch {
            // Skip duplicate/failed inserts
          }
        }

        // Detect stage from headlines
        const headlines = articles.map(a => a.title);
        const detectedStage = detectStageFromHeadlines(headlines);

        // Auto-advance stage only if detected stage is HIGHER than current
        if (detectedStage && detectedStage > ipo.current_stage) {
          await sql`
            UPDATE ipos
            SET current_stage = ${detectedStage}, updated_at = NOW()
            WHERE id = ${ipo.id};
          `;
          stageUpdated = true;
          newStage = detectedStage;
        }

        results.push({
          company: ipo.company_name,
          articles_saved: savedCount,
          stage_updated: stageUpdated,
          new_stage: newStage,
          old_stage: ipo.current_stage,
        });

        // Small delay to avoid hammering Google News
        await new Promise(r => setTimeout(r, 300));
      } catch {
        results.push({
          company: ipo.company_name,
          articles_saved: 0,
          stage_updated: false,
        });
      }
    }

    // 3. Also fetch general market IPO news
    const marketNews = await fetchMarketIPONews();
    let marketSaved = 0;
    for (const article of marketNews) {
      try {
        const existing = await sql`
          SELECT id FROM news_articles WHERE headline = ${article.title} AND ipo_id IS NULL LIMIT 1;
        `;
        if (existing.length === 0) {
          await sql`
            INSERT INTO news_articles (headline, url, source, published_at, topic_tag)
            VALUES (${article.title}, ${article.link}, ${article.source}, ${article.publishedAt}, 'Market');
          `;
          marketSaved++;
        }
      } catch { /* skip */ }
    }

    const elapsed = Date.now() - startTime;
    const stageChanges = results.filter(r => r.stage_updated);

    return NextResponse.json({
      success: true,
      message: `Synced ${ipos.length} IPOs in ${elapsed}ms`,
      ipos_synced: ipos.length,
      total_articles_saved: results.reduce((s, r) => s + r.articles_saved, 0) + marketSaved,
      stage_changes: stageChanges.length,
      stage_updates: stageChanges,
      results,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Returns the last sync stats from latest news_articles timestamp
  try {
    const [latest] = await sql`
      SELECT MAX(created_at) as last_synced, COUNT(*) as total_articles
      FROM news_articles;
    `;
    return NextResponse.json({
      success: true,
      last_synced: latest?.last_synced || null,
      total_articles: Number(latest?.total_articles) || 0,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Failed' }, { status: 500 });
  }
}
