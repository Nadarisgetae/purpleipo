import { NextResponse } from 'next/server';
import { cleanupExpiredListedIPOs } from '@/lib/cleanup';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '3', 10);

    const result = await cleanupExpiredListedIPOs(days);
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.count} IPOs that exceeded ${days} days in Listing Day Debut.`,
      purged: result.purgedIpos,
    });
  } catch (err: any) {
    console.error('Cleanup failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
