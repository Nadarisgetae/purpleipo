import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('ipowatch-sub.html', 'utf-8');
const $ = cheerio.load(html);
console.log('Title:', $('title').text());
console.log('Body length:', $('body').text().length);
console.log('Number of figures:', $('figure').length);
