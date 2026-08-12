import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const key = process.env.GEMINI_API_KEY;

console.log('Testing direct REST API with key:', key ? `${key.substring(0, 10)}...` : 'NONE');

try {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await res.json();
  if (data.error) {
    console.error('❌ API Error:', data.error);
  } else if (data.models) {
    console.log('✅ SUCCESS! Available Gemini Models:');
    data.models.forEach((m) => console.log(' -', m.name));
  } else {
    console.log('Response:', data);
  }
} catch (err) {
  console.error('Fetch error:', err.message);
}
