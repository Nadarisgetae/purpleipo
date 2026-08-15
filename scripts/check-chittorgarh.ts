import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function checkChittorgarh() {
  try {
    const res = await fetch('https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/mainboard/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    console.log('Response Status:', res.status);
    const html = await res.text();
    console.log('HTML Head:', html.substring(0, 800));
    const $ = cheerio.load(html);
    
    // Search raw HTML for table occurrences
    const htmlLower = html.toLowerCase();
    console.log('Count of "<table" in raw HTML:', (htmlLower.match(/<table/g) || []).length);
    console.log('Count of "table-bordered" in raw HTML:', (htmlLower.match(/table-bordered/g) || []).length);
    
    const tables: string[] = [];
    $('table').each((i, el) => {
      tables.push(`Table ${i}: class="${$(el).attr('class') || ''}" rows=${$(el).find('tr').length}`);
    });
    console.log('Tables found:', tables);
    
    // Log table 0 th and td if any
    const firstTable = $('table').first();
    const ths: string[] = [];
    firstTable.find('th').each((i, el) => ths.push($(el).text().trim()));
    console.log('First Table THs:', ths);

    const tds: string[] = [];
    firstTable.find('tr').eq(1).find('td').each((i, el) => tds.push($(el).text().trim()));
    console.log('First Table Row 1 TDs:', tds);
  } catch (e) {
    console.error(e);
  }
}

checkChittorgarh();
