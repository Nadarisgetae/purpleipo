import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchCompanyNews } from './news-fetcher';

export interface NewsSentimentResult {
  news_score: number; // 0–100
  article_count: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  top_headlines: {
    title: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    impact_score: number; // 0–10
    source: string;
    date: string;
  }[];
  summary: string;
}

const geminiKey = process.env.GEMINI_API_KEY;
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

/**
 * Analyzes news sentiment for an IPO using Gemini LLM.
 * In production, headlines would be fetched via RSS / news APIs.
 */
export async function calculateNewsScore(ipoData: {
  company_name: string;
  sector: string;
}): Promise<NewsSentimentResult> {
  // Fetch real headlines from RSS feeds
  const rssArticles = await fetchCompanyNews(ipoData.company_name);
  let realHeadlines = rssArticles.map(a => a.title);

  let top_headlines: NewsSentimentResult['top_headlines'] = [];
  let news_score = 50.0;
  let summary = 'No recent media coverage found for this company.';

  if (genAI) {
    try {
      let prompt = '';
      let model;

      if (realHeadlines.length > 0) {
        model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
        prompt = `You are an expert IPO analyst. Analyze these recent news headlines for "${ipoData.company_name}" (${ipoData.sector} sector):
${realHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

For each headline, classify as positive/negative/neutral and assign an impact_score (0-10).
Compute an aggregate news_score (0-100) based on weighted sentiment.
Write a 1-sentence summary of the media sentiment.`;
      } else {
        // If RSS is empty, use Gemini's built-in Google Search tool to fetch live news!
        // Note: The googleSearch tool provides live web grounding.
        // @ts-ignore - The types might be outdated but the API supports it.
        model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash', tools: [{ googleSearch: {} }] });
        prompt = `You are an expert IPO analyst. Search the latest news regarding the IPO of "${ipoData.company_name}" (${ipoData.sector} sector).
Find 3-5 real recent headlines about this company.
For each headline, classify as positive/negative/neutral and assign an impact_score (0-10).
Compute an aggregate news_score (0-100) based on weighted sentiment.
Write a 1-sentence summary of the media sentiment.`;
      }

      prompt += `\nRespond ONLY in valid JSON format:
{
  "news_score": number,
  "summary": "string",
  "headlines": [
    { "title": "string", "sentiment": "positive|negative|neutral", "impact_score": number, "source": "source name", "date": "YYYY-MM-DD" }
  ]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(cleanJson);

      if (parsed.headlines && parsed.headlines.length > 0) {
        news_score = Math.min(100, Math.max(0, Number(parsed.news_score) || 50.0));
        summary = parsed.summary || summary;
        top_headlines = parsed.headlines.slice(0, 5).map((h: any) => ({
          title: h.title || 'Unknown Headline',
          sentiment: (['positive', 'negative', 'neutral'].includes(h.sentiment) ? h.sentiment : 'neutral') as 'positive' | 'negative' | 'neutral',
          impact_score: Number(h.impact_score) || 5,
          source: h.source || 'Search Engine',
          date: h.date || new Date().toISOString().split('T')[0],
        }));
      }
    } catch (err) {
      console.warn('Gemini news scoring or search failed:', err instanceof Error ? err.message : err);
    }
  }

  const pos = top_headlines.filter((h) => h.sentiment === 'positive').length;
  const neg = top_headlines.filter((h) => h.sentiment === 'negative').length;
  const neu = top_headlines.filter((h) => h.sentiment === 'neutral').length;

  return {
    news_score,
    article_count: top_headlines.length,
    positive_count: pos,
    negative_count: neg,
    neutral_count: neu,
    top_headlines,
    summary,
  };
}
