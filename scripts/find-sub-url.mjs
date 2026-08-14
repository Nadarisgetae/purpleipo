import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('ipowatch-sme.html', 'utf-8');
const $ = cheerio.load(html);

$('a').each((i, el) => {
  const text = $(el).text().toLowerCase();
  if (text.includes('subscription')) {
    console.log($(el).attr('href'));
  }
});
