import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exchangeCode } from '@/lib/instagram';
import { encrypt } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = process.env.APP_URL ?? 'http://localhost:3000';
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(`${origin}/?error=${error ?? 'missing_params'}`);
  }

  // Validate state (single-use, max 10 min)
  const stored = await db.oAuthState.findUnique({ where: { state } });
  if (!stored || stored.expiresAt < new Date()) {
    return NextResponse.redirect(`${origin}/?error=invalid_state`);
  }
  await db.oAuthState.delete({ where: { state } });

  try {
    const { accessToken, igUserId, username, expiresAt } = await exchangeCode(code);

    await db.igAccount.upsert({
      where: { igUserId },
      create: {
        igUserId,
        username,
        accessTokenEnc: encrypt(accessToken),
        tokenExpiresAt: expiresAt,
        status: 'active',
      },
      update: {
        username,
        accessTokenEnc: encrypt(accessToken),
        tokenExpiresAt: expiresAt,
        status: 'active',
      },
    });

    return NextResponse.redirect(`${origin}/?connected=1`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(`${origin}/?error=oauth_failed`);
  }
}
