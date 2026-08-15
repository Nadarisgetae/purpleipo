import { NextResponse } from 'next/server';
import { evaluateIPORHPScores } from '../../../../lib/scoring';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ipoId = body.ipoId;

    if (!ipoId) {
      return NextResponse.json({ error: 'Missing ipoId parameter in request body' }, { status: 400 });
    }

    console.log(`Manual trigger: Starting RHP evaluation for IPO ID: ${ipoId}...`);
    
    // We execute the scoring engine. Since it calls LLM APIs, let's await it
    // so we can return the computed score immediately to the UI!
    const finalScore = await evaluateIPORHPScores(ipoId);

    return NextResponse.json({ 
      message: 'IPO evaluated successfully',
      score: finalScore 
    });
  } catch (err: any) {
    console.error('Failed to run manual evaluation API:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
