import * as cheerio from 'cheerio';

async function testFetch() {
  const query = "Gaja Alternative Asset Management DRHP filetype:pdf";
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  
  const text = await res.text();
  const $ = cheerio.load(text);
  
  const links = [];
  $('a.result__url').each((i, el) => {
    links.push($(el).attr('href'));
  });
  
  console.log(links);
}

testFetch();
