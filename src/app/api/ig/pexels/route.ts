import { NextRequest, NextResponse } from 'next/server';
import { searchPexels } from '@/lib/pexels';
import { generateCaption } from '@/lib/caption';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const topic = new URL(request.url).searchParams.get('topic')?.trim();
  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

  try {
    // Load all previously used image URLs to avoid repeats
    const usedPosts = await db.post.findMany({ select: { imageUrl: true } });
    const usedUrls = new Set(usedPosts.map((p) => p.imageUrl));

    const [imageUrl, caption] = await Promise.all([
      searchPexels(topic, usedUrls),
      generateCaption(topic),
    ]);

    if (!imageUrl) return NextResponse.json({ error: `No images found for "${topic}"` }, { status: 404 });

    return NextResponse.json({ imageUrl, caption });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
