import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { postImage } from '@/lib/instagram';

const BodySchema = z.object({
  accountId: z.string(),
  imageUrl: z.string().url(),
  caption: z.string().max(2200).default(''),
});

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { accountId, imageUrl, caption } = parsed.data;

  const account = await db.igAccount.findFirst({
    where: { id: accountId, status: 'active' },
  });
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const post = await db.post.create({
    data: { igAccountId: accountId, imageUrl, caption, status: 'pending' },
  });

  try {
    const token = decrypt(account.accessTokenEnc);
    const { mediaId, permalink } = await postImage(account.igUserId, token, imageUrl, caption);

    await db.post.update({
      where: { id: post.id },
      data: { status: 'published', mediaId, permalink, publishedAt: new Date() },
    });

    return NextResponse.json({ success: true, mediaId, permalink });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await db.post.update({
      where: { id: post.id },
      data: { status: 'failed', error: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
