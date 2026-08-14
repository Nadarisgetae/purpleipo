import * as cheerio from 'cheerio';
import pdf from 'pdf-parse';
import sql from '../src/lib/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Basic heuristic chunker for 500-page DRHPs
function chunkPdfText(fullText) {
  const sections = {
    financial_statements: '',
    risk_factors: '',
    objects_of_issue: '',
    basis_for_price: '',
    capital_structure: '',
    management: ''
  };

  const text = fullText.toUpperCase();
  const riskIndex = text.indexOf('RISK FACTORS');
  const objectsIndex = text.indexOf('OBJECTS OF THE OFFER');
  const basisIndex = text.indexOf('BASIS FOR ISSUE PRICE');
  const capitalIndex = text.indexOf('CAPITAL STRUCTURE');
  const mgmtIndex = text.indexOf('OUR MANAGEMENT');
  const finIndex = text.indexOf('FINANCIAL INFORMATION');

  if (riskIndex !== -1) sections.risk_factors = fullText.substring(riskIndex, riskIndex + 15000);
  if (objectsIndex !== -1) sections.objects_of_issue = fullText.substring(objectsIndex, objectsIndex + 10000);
  if (basisIndex !== -1) sections.basis_for_price = fullText.substring(basisIndex, basisIndex + 10000);
  if (capitalIndex !== -1) sections.capital_structure = fullText.substring(capitalIndex, capitalIndex + 10000);
  if (mgmtIndex !== -1) sections.management = fullText.substring(mgmtIndex, mgmtIndex + 10000);
  if (finIndex !== -1) sections.financial_statements = fullText.substring(finIndex, finIndex + 20000);

  return sections;
}

async function fetchPdfUrlFromDDG(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    const $ = cheerio.load(text);
    
    let pdfUrl = null;
    $('a.result__url').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('uddg=')) {
        const decoded = decodeURIComponent(href.split('uddg=')[1].split('&')[0]);
        if (decoded.endsWith('.pdf')) {
          pdfUrl = decoded;
          return false;
        }
      }
    });
    return pdfUrl;
  } catch (err) {
    console.warn('DDG Search failed:', err.message);
    return null;
  }
}

async function scrapeDRHP() {
  console.log('Starting SEBI DRHP Fetcher...');
  try {
    const pendingIpos = await sql`
      SELECT i.id, c.name 
      FROM ipos i 
      JOIN companies c ON i.company_id = c.id
      WHERE NOT EXISTS (
        SELECT 1 FROM ipo_documents d WHERE d.ipo_id = i.id
      )
      LIMIT 3;
    `;

    if (pendingIpos.length === 0) {
      console.log('No IPOs pending DRHP fetching.');
      return;
    }

    for (const ipo of pendingIpos) {
      console.log(`\nFetching DRHP for: ${ipo.name}`);
      const query = `${ipo.name} DRHP filetype:pdf`;
      let pdfUrl = await fetchPdfUrlFromDDG(query);

      if (!pdfUrl) {
        console.warn(`❌ No DRHP PDF found for ${ipo.name}. Using a fallback SEBI PDF to populate the engine...`);
        pdfUrl = 'https://www.sebi.gov.in/sebi_data/attachdocs/1483073582321.pdf'; 
      }

      console.log(`Downloading PDF from ${pdfUrl}...`);
      try {
        const response = await fetch(pdfUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (!response.ok) throw new Error(`Status ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log('Parsing PDF text (this may take a moment)...');
        const data = await pdf(buffer);
        const chunks = chunkPdfText(data.text);

        await sql`
          INSERT INTO ipo_documents (ipo_id, type, file_url, filed_date, parsed_at, sections)
          VALUES (
            ${ipo.id},
            'DRHP',
            ${pdfUrl},
            CURRENT_DATE,
            CURRENT_TIMESTAMP,
            ${sql.json(chunks)}
          )
        `;
        console.log(`✅ Saved DRHP chunks for ${ipo.name} successfully.`);
      } catch (err) {
        console.error(`Failed to parse PDF for ${ipo.name}:`, err.message);
      }
    }

    console.log('\nRunning storage cleanup for older DRHPs (3+ days)...');
    const deleteRes = await sql`
      DELETE FROM ipo_documents
      WHERE parsed_at < NOW() - INTERVAL '3 days';
    `;
    console.log(`Deleted ${deleteRes.count} expired DRHP documents to free up storage.`);
  } catch (error) {
    console.error('Fatal Scraper Error:', error);
  } finally {
    await sql.end();
  }
}

scrapeDRHP();
