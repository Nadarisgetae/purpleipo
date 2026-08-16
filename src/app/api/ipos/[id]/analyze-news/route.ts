import { NextResponse } from 'next/server';
import sql from '../../../../../lib/db';
import { fetchAndRankNews } from '../../../../../lib/scrapers/newsScraper';
import { callOpenRouterLLM } from '../../../../../lib/llmClient';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes for LLM calls

const SYSTEM_PROMPT = `You are a financial analyst engine. Score the following news articles regarding a specific IPO/company.
Respond ONLY with a JSON object in the following format:
{
  "results": [
    {
      "headline": "...",
      "sentiment": <number between -1.0 (very negative) and 1.0 (very positive)>,
      "topic": "<string (one of: 'business-performance', 'litigation-regulatory', 'macro-market', 'subscription-demand', 'governance-controversy', 'other')>",
      "relevance": <number between 0.0 (unrelated) and 1.0 (highly relevant to the specific company's IPO/stock)>,
      "consistent": <boolean (true if the headline seems to match typical content, false if clickbait)>
    }
  ]
}
Be objective. If an article just mentions the IPO in passing, give it a low relevance score.`;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ipoId = params.id;
  if (!ipoId) return NextResponse.json({ error: 'Missing IPO ID' }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    const force_refresh = body.force_refresh || false;

    // 1. Check cache if not forcing refresh
    if (!force_refresh) {
      const cacheCheck = await sql`
        SELECT * FROM news_sentiment_snapshots 
        WHERE ipo_id = ${ipoId} AND computed_at > NOW() - INTERVAL '6 hours'
        ORDER BY computed_at DESC LIMIT 1;
      `;
      if (cacheCheck.length > 0) {
        const snapshot = cacheCheck[0];
        const articles = await sql`
          SELECT * FROM news_articles WHERE analysis_run_id = ${snapshot.analysis_run_id} ORDER BY relevance_score DESC;
        `;
        return NextResponse.json({ cached: true, snapshot, articles });
      }
    }

    // 2. Fetch company name
    const ipoQuery = await sql`
      SELECT i.*, c.name as company_name 
      FROM ipos i JOIN companies c ON i.company_id = c.id 
      WHERE i.id = ${ipoId} LIMIT 1;
    `;
    if (ipoQuery.length === 0) return NextResponse.json({ error: 'IPO not found' }, { status: 404 });
    const companyName = ipoQuery[0].company_name;

    // 3. Fetch top 30 ranked articles
    const scrapedArticles = await fetchAndRankNews(companyName);
    if (scrapedArticles.length === 0) {
      return NextResponse.json({ error: 'No relevant news found' }, { status: 404 });
    }

    // 4. Batch Score with LLM (Batches of 10)
    const scoredResults: any[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < scrapedArticles.length; i += batchSize) {
      const batch = scrapedArticles.slice(i, i + batchSize);
      const prompt = `Analyze these articles for company: ${companyName}\n\n` + 
        batch.map((a, idx) => `Article ${idx + 1}:\nHeadline: ${a.headline}\nSource: ${a.source}\n`).join('\n');
      
      try {
        const responseText = await callOpenRouterLLM({
          prompt,
          systemPrompt: SYSTEM_PROMPT,
          responseFormat: 'json_object'
        });
        
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON object found in LLM response: ' + responseText.substring(0, 50));
        
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.results && Array.isArray(parsed.results)) {
          scoredResults.push(...parsed.results);
        }
      } catch (err: any) {
        console.error('LLM Batch Error:', err.message);
        // Continue with partial results if a batch fails (e.g. key exhaustion)
      }
    }

    if (scoredResults.length === 0) {
      return NextResponse.json({ error: 'LLM scoring failed for all batches. OpenRouter keys may be exhausted.' }, { status: 500 });
    }

    // 5. Aggregate Metrics
    let totalWeightedSentiment = 0;
    let totalWeight = 0;
    const sentiments: number[] = [];
    
    const finalArticles = scrapedArticles.slice(0, scoredResults.length).map((article, idx) => {
      const llmResult = scoredResults.find(r => r.headline === article.headline) || scoredResults[idx];
      if (!llmResult) return null;
      
      const sentiment = typeof llmResult.sentiment === 'number' ? llmResult.sentiment : 0;
      const relevance = typeof llmResult.relevance === 'number' ? llmResult.relevance : 0.5;
      const weight = relevance; 
      
      totalWeightedSentiment += sentiment * weight;
      totalWeight += weight;
      sentiments.push(sentiment);
      
      return {
        ...article,
        sentiment_score: sentiment,
        topic_tag: llmResult.topic || 'other',
        relevance_score: relevance,
        headline_body_consistent: typeof llmResult.consistent === 'boolean' ? llmResult.consistent : true
      };
    }).filter(Boolean) as any[];

    const weightedAvgSentiment = totalWeight > 0 ? totalWeightedSentiment / totalWeight : 0;
    
    // Variance (Dispersion)
    let dispersion = 0;
    if (sentiments.length > 1) {
      const mean = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
      dispersion = sentiments.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (sentiments.length - 1);
    }
    
    // News Sentiment Score (0-100)
    let score = (weightedAvgSentiment + 1) * 50;
    
    // Trend direction
    let trendDirection = 'flat';
    const lastSnapshot = await sql`
      SELECT weighted_avg_sentiment FROM news_sentiment_snapshots 
      WHERE ipo_id = ${ipoId} ORDER BY computed_at DESC LIMIT 1;
    `;
    if (lastSnapshot.length > 0) {
      const lastSent = lastSnapshot[0].weighted_avg_sentiment;
      if (weightedAvgSentiment - lastSent > 0.1) {
        trendDirection = 'up';
        score = Math.min(100, score + 5);
      } else if (lastSent - weightedAvgSentiment > 0.1) {
        trendDirection = 'down';
        score = Math.max(0, score - 5);
      }
    }

    const analysisRunId = crypto.randomUUID();
    const recentCount = finalArticles.filter(a => (Date.now() - new Date(a.published_at).getTime()) < 48 * 60 * 60 * 1000).length;

    // 6. DB Insertion
    await sql`
      INSERT INTO news_sentiment_snapshots (
        ipo_id, analysis_run_id, weighted_avg_sentiment, sentiment_trend_direction, 
        coverage_volume_recent, sentiment_dispersion, news_sentiment_score, 
        articles_scored_count, triggered_by
      ) VALUES (
        ${ipoId}, ${analysisRunId}, ${weightedAvgSentiment}, ${trendDirection},
        ${recentCount}, ${dispersion}, ${score}, ${finalArticles.length}, ${force_refresh ? 'manual_refresh' : 'user_click'}
      )
    `;

    for (const a of finalArticles) {
      await sql`
        INSERT INTO news_articles (
          ipo_id, analysis_run_id, headline, url, source, published_at, 
          sentiment_score, topic_tag, relevance_score, headline_body_consistent, scored_at
        ) VALUES (
          ${ipoId}, ${analysisRunId}, ${a.headline}, ${a.url}, ${a.source}, ${a.published_at},
          ${a.sentiment_score}, ${a.topic_tag}, ${a.relevance_score}, ${a.headline_body_consistent}, NOW()
        )
      `;
    }

    // 7. Return Result
    const newSnapshot = await sql`SELECT * FROM news_sentiment_snapshots WHERE analysis_run_id = ${analysisRunId}`;
    return NextResponse.json({ cached: false, snapshot: newSnapshot[0], articles: finalArticles });

  } catch (err: any) {
    console.error('News Sentiment API Error:', err.message);
    return NextResponse.json({ error: 'Server error processing news' }, { status: 500 });
  }
}
