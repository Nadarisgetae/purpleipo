import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { uploadToR2 } from '@/lib/r2';
import { parseRHPBuffer } from '@/lib/pdf-parser';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: ipoId } = params;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const docType = (formData.get('type') as string) || 'RHP';

    if (!file) {
      return NextResponse.json({ success: false, message: 'No PDF file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload to Cloudflare R2 / S3
    const fileUrl = await uploadToR2(buffer, file.name, file.type);

    // 2. Parse PDF Text into Sections
    const sections = await parseRHPBuffer(buffer);

    // 3. Save to ipo_documents table
    const [doc] = await sql`
      INSERT INTO ipo_documents (ipo_id, type, file_url, filed_date, parsed_at)
      VALUES (${ipoId}, ${docType}, ${fileUrl}, NOW(), NOW())
      RETURNING *;
    `;

    // 4. If RHP uploaded, update IPO stage to 5 (RHP Filed) if lower
    if (docType === 'RHP') {
      await sql`
        UPDATE ipos 
        SET current_stage = GREATEST(current_stage, 5), updated_at = NOW()
        WHERE id = ${ipoId};
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'Document uploaded and parsed successfully!',
      document: doc,
      sections_parsed: {
        raw_text_length: sections.raw_text_length,
        has_risk_factors: Boolean(sections.risk_factors),
        has_financials: Boolean(sections.financial_statements),
      },
    });
  } catch (error) {
    console.error('Error uploading/parsing document:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: ipoId } = params;
    const docs = await sql`
      SELECT * FROM ipo_documents WHERE ipo_id = ${ipoId} ORDER BY filed_date DESC;
    `;
    return NextResponse.json({ success: true, documents: docs });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Failed to fetch documents' }, { status: 500 });
  }
}
