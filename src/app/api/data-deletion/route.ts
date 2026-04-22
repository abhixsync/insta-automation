import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/lib/db';

// Meta sends a signed_request when user deletes their Facebook data.
// We verify the signature, delete the user's data, and return a confirmation URL.

function parseSignedRequest(signedRequest: string, appSecret: string) {
  const [encodedSig, payload] = signedRequest.split('.');
  if (!encodedSig || !payload) throw new Error('Invalid signed_request format');

  // Verify signature
  const expectedSig = createHmac('sha256', appSecret)
    .update(payload)
    .digest('base64url');

  if (expectedSig !== encodedSig) throw new Error('Invalid signature');

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

export async function POST(request: NextRequest) {
  try {
    const appSecret = process.env.IG_APP_SECRET;
    if (!appSecret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    const body = await request.text();
    const params = new URLSearchParams(body);
    const signedRequest = params.get('signed_request');
    if (!signedRequest) {
      return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 });
    }

    const data = parseSignedRequest(signedRequest, appSecret);
    const userId = data.user_id as string | undefined;

    let confirmationCode = `del_${Date.now()}`;

    if (userId) {
      // Delete all accounts and posts for this IG user ID
      const account = await db.igAccount.findUnique({ where: { igUserId: userId } });
      if (account) {
        await db.post.deleteMany({ where: { igAccountId: account.id } });
        await db.igAccount.delete({ where: { igUserId: userId } });
        confirmationCode = `del_${userId}_${Date.now()}`;
      }
    }

    const appUrl = process.env.APP_URL ?? 'https://insta-automation-six.vercel.app';

    return NextResponse.json({
      url: `${appUrl}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    console.error('[data-deletion] error:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// Meta also does a GET request to verify the endpoint exists
export async function GET() {
  return NextResponse.json({ status: 'Data deletion endpoint active' });
}
