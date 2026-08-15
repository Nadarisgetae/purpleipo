export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSessionToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    const expectedPassword = process.env.APP_PASSWORD || 'purpleipo2026';

    if (!password || password !== expectedPassword) {
      return NextResponse.json(
        { success: false, message: 'Incorrect password. Please try again.' },
        { status: 401 }
      );
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ success: true, message: 'Authenticated successfully' });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
