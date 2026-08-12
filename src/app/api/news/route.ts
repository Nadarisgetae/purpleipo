import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    const articles = await sql`
      SELECT 
        n.*,
        c.name as company_name
      FROM news_articles n
      LEFT JOIN companies c ON n.company_id = c.id
      ORDER BY n.published_at DESC
      LIMIT 20;
    `;

    return NextResponse.json({ success: true, count: articles.length, data: articles });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch news' }, { status: 500 });
  }
}
