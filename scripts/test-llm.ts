import { callOpenRouterLLM } from '../src/lib/llmClient.ts';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testLLM() {
  console.log('Testing OpenRouter LLM Call...');
  try {
    const result = await callOpenRouterLLM({
      prompt: 'Write a 1-sentence tagline for a modern IPO evaluation tool named PurpleIPO.',
      systemPrompt: 'You are a professional financial copywriter.',
    });
    console.log('\nResult from LLM:\n', result);
  } catch (err: any) {
    console.error('\n❌ LLM Call Failed:', err.message);
  }
}

testLLM();
