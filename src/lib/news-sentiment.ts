import { GoogleGenerativeAI } from '@google/generative-ai';

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
  // Simulated news headlines (in production these come from RSS feeds fetched in /api/news)
  const sampleHeadlines = [
    `${ipoData.company_name} IPO oversubscribed 28x on Day 1 — strong QIB demand`,
    `${ipoData.company_name} reports 32% revenue jump in Q1 ahead of public issue`,
    `Analysts divided over ${ipoData.company_name}'s IPO valuation premium`,
    `${ipoData.sector} sector tailwinds boost ${ipoData.company_name} market outlook`,
    `${ipoData.company_name} promoters pledge zero shares — clean governance signal`,
  ];

  let top_headlines: NewsSentimentResult['top_headlines'] = [];
  let news_score = 74.0;
  let summary = 'Broadly positive media coverage with moderate institutional confidence.';

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const prompt = `
You are an expert IPO market analyst. Analyze these news headlines for "${ipoData.company_name}" (${ipoData.sector} sector):
${sampleHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

For each headline, classify as positive/negative/neutral and assign an impact_score (0-10).
Then compute an aggregate news_score (0-100) based on the weighted sentiment.
Also write a 1-sentence summary of the overall media sentiment.

Respond ONLY in valid JSON format:
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

      news_score = Math.min(100, Math.max(0, Number(parsed.news_score) || 74.0));
      summary = parsed.summary || summary;
      top_headlines = (parsed.headlines || []).slice(0, 5).map((h: { title?: string; sentiment?: string; impact_score?: number; source?: string; date?: string }) => ({
        title: h.title || '',
        sentiment: (['positive', 'negative', 'neutral'].includes(h.sentiment || '') ? h.sentiment : 'neutral') as 'positive' | 'negative' | 'neutral',
        impact_score: Number(h.impact_score) || 5,
        source: h.source || 'Business Standard',
        date: h.date || new Date().toISOString().split('T')[0],
      }));
    } catch (err) {
      console.warn('Gemini news scoring fallback:', err instanceof Error ? err.message : err);
    }
  }

  if (top_headlines.length === 0) {
    top_headlines = sampleHeadlines.map((title, i) => ({
      title,
      sentiment: i < 3 ? 'positive' : i === 2 ? 'negative' : 'neutral',
      impact_score: 7 - i * 0.5,
      source: ['Moneycontrol', 'Economic Times', 'Business Standard', 'LiveMint', 'NDTV Profit'][i] || 'Moneycontrol',
      date: new Date().toISOString().split('T')[0],
    }));
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
