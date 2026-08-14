import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testSearch() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash', tools: [{ googleSearch: {} }] });
  
  const prompt = `Find the direct PDF link to the official SEBI DRHP (Draft Red Herring Prospectus) for "Gaja Alternative Asset Management". Return ONLY the URL.`;
  const res = await model.generateContent(prompt);
  console.log(res.response.text());
}
testSearch();
