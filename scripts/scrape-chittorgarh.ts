import { scrapeChittorgarhIPOs } from '../src/lib/scrapers/chittorgarh.ts';

async function run() {
  try {
    await scrapeChittorgarhIPOs();
    console.log('\n✅ Chittorgarh Scraper Execution Finished Successfully!');
  } catch (err: any) {
    console.error('\n❌ Scraper Execution Failed:', err.message);
  }
}

run();
