import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

console.log('\n=================================================');
console.log('  PURPLEIPO — GEMINI & CLOUDFLARE R2 VERIFIER    ');
console.log('=================================================\n');

// 1. Verify Gemini API
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey || geminiKey.includes('AIzaSy_YOUR')) {
  console.log('⚠️ GEMINI_API_KEY is missing or set to placeholder in .env.local');
} else {
  console.log('📡 Testing Google Gemini API key...');
  
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const result = await model.generateContent('Return JSON: {"status": "ok", "message": "Gemini API connected successfully"}');
    
    console.log('\n✅ GEMINI API SUCCESS! Output:');
    console.log(result.response.text().trim());
  } catch (err) {
    console.error('\n❌ GEMINI API ERROR:', err.message);
  }
}

// 2. Verify R2 credentials
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;

console.log('\n-------------------------------------------------');
if (!r2AccountId || !r2AccessKey || !r2SecretKey) {
  console.log('⚠️ R2 Credentials missing in .env.local (will use local upload fallback)');
} else {
  console.log('✅ R2 Credentials detected in .env.local');
}
console.log('=================================================\n');
