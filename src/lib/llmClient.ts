import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import sql from './db';

// Parse OpenRouter API keys from environment
function getOpenRouterKeys(): string[] {
  const keysStr = process.env.OPENROUTER_KEYS || '';
  const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
  if (keys.length === 0 && process.env.OPENROUTER_API_KEY) {
    keys.push(process.env.OPENROUTER_API_KEY);
  }
  return keys;
}

interface ChatCompletionOptions {
  prompt: string;
  systemPrompt?: string;
  responseFormat?: 'json_object';
}

/**
 * Universal LLM caller: Attempts Gemini API (primary if configured), then OpenRouter, with graceful fallback.
 */
export async function callOpenRouterLLM(options: ChatCompletionOptions): Promise<string> {
  // 1. Try Gemini API first if GEMINI_API_KEY is configured
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.1,
          responseMimeType: options.responseFormat === 'json_object' ? 'application/json' : 'text/plain'
        }
      });

      const fullPrompt = `${options.systemPrompt ? `${options.systemPrompt}\n\n` : ''}${options.prompt}`;
      const result = await model.generateContent(fullPrompt);
      const text = result.response.text();
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (geminiErr: any) {
      console.warn('Gemini API attempt warning:', geminiErr.message);
    }
  }

  // 2. Try OpenRouter if keys are available
  const openRouterKeys = getOpenRouterKeys();
  if (openRouterKeys.length > 0) {
    for (let i = 0; i < openRouterKeys.length; i++) {
      const apiKey = openRouterKeys[i];
      try {
        const openai = new OpenAI({
          apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          maxRetries: 0,
          timeout: 15000,
          defaultHeaders: {
            'HTTP-Referer': 'https://purpleipo.com',
            'X-Title': 'PurpleIPO'
          }
        });

        const response = await openai.chat.completions.create({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [
            ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
            { role: 'user' as const, content: options.prompt }
          ],
          temperature: 0.1
        });

        const content = response.choices[0]?.message?.content;
        if (content) return content;
      } catch (orErr: any) {
        console.warn(`OpenRouter key ${i} failed:`, orErr.message);
      }
    }
  }

  throw new Error('No LLM API keys configured or all providers rate-limited.');
}
