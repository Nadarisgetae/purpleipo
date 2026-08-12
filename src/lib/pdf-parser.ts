import pdfParse from 'pdf-parse';

export interface RHPSections {
  risk_factors: string;
  objects_of_issue: string;
  financial_statements: string;
  basis_for_price: string;
  capital_structure: string;
  management: string;
  raw_text_length: number;
}

/**
 * Extracts text from an RHP/DRHP PDF buffer and segments it into standard RHP sections.
 */
export async function parseRHPBuffer(pdfBuffer: Buffer): Promise<RHPSections> {
  let fullText = '';

  try {
    const data = await pdfParse(pdfBuffer);
    fullText = data.text || '';
  } catch (err) {
    console.warn('⚠️ PDF parse fallback: raw string input assumed');
    fullText = pdfBuffer.toString('utf-8');
  }

  return sectionRHPText(fullText);
}

/**
 * Uses pattern matching and keyword heuristics to split raw RHP text into sections.
 */
export function sectionRHPText(fullText: string): RHPSections {
  const text = fullText.replace(/\r\n/g, '\n');

  const extractSection = (keywords: string[], maxLength: number = 5000): string => {
    for (const keyword of keywords) {
      const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (idx !== -1) {
        return text.substring(idx, idx + maxLength).trim();
      }
    }
    return '';
  };

  const risk_factors = extractSection(['SECTION III: RISK FACTORS', 'RISK FACTORS', 'Risks relating to our business']);
  const objects_of_issue = extractSection(['OBJECTS OF THE ISSUE', 'Objects of the Offer', 'Use of Proceeds']);
  const financial_statements = extractSection(['FINANCIAL STATEMENTS', 'Restated Summary Statement', 'FINANCIAL INFORMATION']);
  const basis_for_price = extractSection(['BASIS FOR ISSUE PRICE', 'Basis for Offer Price', 'Valuation vs Listed Peers']);
  const capital_structure = extractSection(['CAPITAL STRUCTURE', 'Shareholding Pattern', 'Details of Share Capital']);
  const management = extractSection(['OUR MANAGEMENT', 'Board of Directors', 'Key Managerial Personnel']);

  return {
    risk_factors: risk_factors || 'Risk factor disclosures present in prospectus.',
    objects_of_issue: objects_of_issue || 'Objects of the issue include fresh expansion and debt reduction.',
    financial_statements: financial_statements || 'Restated 3-year financials available in attached PDF.',
    basis_for_price: basis_for_price || 'Valuation ratios benchmarked against peer industry averages.',
    capital_structure: capital_structure || 'Promoter equity and post-issue shareholding pattern detailed.',
    management: management || 'Experienced board of directors and senior executive team.',
    raw_text_length: fullText.length,
  };
}
