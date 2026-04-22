import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const posts = await db.post.findMany({
    include: { igAccount: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return NextResponse.json({ posts });
}
