import * as cheerio from 'cheerio';

async function testInvestorgain() {
  try {
    const res = await fetch('https://www.investorgain.com/report/live-ipo-gmp/331/ipo/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const ipos: any[] = [];
    $('table tbody tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 8) {
        ipos.push({
          company: $(tds[0]).text().trim(),
          open: $(tds[4]).text().trim(),
          close: $(tds[5]).text().trim(),
          price: $(tds[2]).text().trim(),
          gmp: $(tds[3]).text().trim(),
        });
      }
    });
    
    console.log(`Found ${ipos.length} IPOs:`);
    console.log(ipos.slice(0, 5));
  } catch (e) {
    console.error(e);
  }
}
testInvestorgain();
