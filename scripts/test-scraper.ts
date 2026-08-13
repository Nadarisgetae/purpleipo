import * as cheerio from 'cheerio';
import fs from 'fs';

async function testScrape() {
  try {
    const res = await fetch('https://www.chittorgarh.com/report/mainboard-ipo-list-in-india/29/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = await res.text();
    fs.writeFileSync('chittorgarh.html', html);
    
    const $ = cheerio.load(html);
    const ipos: any[] = [];
    
    $('table.table-bordered tbody tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 6) {
        ipos.push({
          company: $(tds[0]).text().trim(),
          open: $(tds[1]).text().trim(),
          close: $(tds[2]).text().trim(),
          issue_size: $(tds[3]).text().trim(),
          price_band: $(tds[4]).text().trim(),
          lot_size: $(tds[5]).text().trim(),
        });
      }
    });
    
    console.log(`Found ${ipos.length} IPOs:`);
    console.log(ipos.slice(0, 5));
  } catch (e) {
    console.error(e);
  }
}
testScrape();
