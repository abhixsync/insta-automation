import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { buildAuthUrl } from '@/lib/instagram';

export async function GET() {
  const state = randomUUID();

  await db.oAuthState.create({
    data: {
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min TTL
    },
  });

  return NextResponse.json({ url: buildAuthUrl(state) });
}
