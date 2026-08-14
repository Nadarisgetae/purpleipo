import yahooFinance from 'yahoo-finance2';
import * as cheerio from 'cheerio';

async function testMacro() {
  try {
    const nifty = await yahooFinance.quote('^NSEI');
    console.log('Nifty:', nifty.regularMarketPrice);

    const vix = await yahooFinance.quote('^INDIAVIX');
    console.log('VIX:', vix.regularMarketPrice);
  } catch (err) {
    console.error('Yahoo finance error:', err);
  }

  try {
    const res = await fetch('https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const text = await res.text();
    const $ = cheerio.load(text);
    
    // Attempt to extract FII DII text
    const fiiNet = $('td:contains("FII")').next('.net_val').text().trim();
    console.log('FII Net:', fiiNet);
    
  } catch(err) {
    console.error('FII fetch error:', err);
  }
}

testMacro();
